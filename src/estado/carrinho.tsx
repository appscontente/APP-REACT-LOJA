// Carrinhos do app: um do site e um por loja física (Figital), separados como no site. O preço aqui é o da vitrine;
// o servidor recalcula promoções, Pix e frete no checkout e só ele vale. O carrinho guardado no celular é conferido
// com o site ao abrir (atualizar): preço, desconto e disponibilidade do dia, e o item que sumiu fica indisponível.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, ErroApi } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import { DESCONTO_PIX, arredondar } from '@/lib/formatar';
import type { CardProduto, OrigemSaida } from '@/lib/tipos';

export type ItemCarrinho = Pick<
  CardProduto,
  'codprod' | 'slug' | 'nome' | 'marca' | 'preco' | 'precoDe' | 'descontoPix' | 'imagem' | 'sujeitoConfirmacao'
> & {
  quantidade: number;
  estoque: number;
  /** Figital: de onde sai a peça e se o cliente aceitou a de mostruário (peça única na loja). */
  origemEstoque?: OrigemSaida;
  mostruario?: boolean;
  /** Figital: false quando o produto só pode ser finalizado no caixa da loja (não entra no "Pagar pelo app"). */
  entregavel?: boolean;
  /** O site não tem mais o produto para vender (saiu do catálogo ou esgotou): fica fora dos totais e do pedido. */
  indisponivel?: boolean;
};

/** O que mudou num item quando o carrinho guardado foi conferido com o site. */
export type MudancaCarrinho =
  | { tipo: 'preco'; codprod: string; nome: string; de: number; para: number }
  | { tipo: 'quantidade' | 'indisponivel'; codprod: string; nome: string };

/** "site" ou o slug da loja (carrinho da Figital). */
export type Destino = 'site' | string;

type Carrinhos = Record<Destino, ItemCarrinho[]>;

type Contexto = {
  itens: (destino?: Destino) => ItemCarrinho[];
  adicionar: (produto: Omit<ItemCarrinho, 'quantidade'>, destino?: Destino, quantidade?: number) => void;
  alterar: (codprod: string, quantidade: number, destino?: Destino) => void;
  remover: (codprod: string, destino?: Destino) => void;
  esvaziar: (destino?: Destino) => void;
  quantidadeTotal: (destino?: Destino) => number;
  /**
   * Confere o carrinho guardado com o site (preço, desconto e disponibilidade de hoje) e devolve o que mudou.
   * Sem internet, rejeita e o carrinho fica como estava.
   */
  atualizar: (destino?: Destino) => Promise<MudancaCarrinho[]>;
};

const CHAVE = 'carrinhos:v1';
const ContextoCarrinho = createContext<Contexto | null>(null);

/** Itens que entram na conta e no pedido (os indisponíveis ficam de fora). */
export const disponiveis = (itens: ItemCarrinho[]) => itens.filter((i) => !i.indisponivel);

export function totais(todos: ItemCarrinho[]) {
  const itens = disponiveis(todos);
  const subtotal = arredondar(itens.reduce((t, i) => t + i.preco * i.quantidade, 0));
  const pix = arredondar(itens.reduce((t, i) => t + i.preco * (1 - (i.descontoPix ?? DESCONTO_PIX)) * i.quantidade, 0));
  const economia = arredondar(itens.reduce((t, i) => t + ((i.precoDe ?? i.preco) - i.preco) * i.quantidade, 0));
  return { subtotal, pix, economia };
}

export function ProvedorCarrinho({ children }: { children: ReactNode }) {
  const [carrinhos, setCarrinhos] = useState<Carrinhos>({ site: [] });
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    ler<Carrinhos>(CHAVE, { site: [] }).then((c) => {
      setCarrinhos(c);
      setPronto(true);
    });
  }, []);
  useEffect(() => {
    if (pronto) gravar(CHAVE, carrinhos);
  }, [carrinhos, pronto]);
  // O atualizar lê a lista mais recente por aqui, para não mudar a cada toque no carrinho (a tela chama ao abrir).
  const ultimos = useRef(carrinhos);
  useEffect(() => {
    ultimos.current = carrinhos;
  }, [carrinhos]);

  const atualizar = useCallback(async (destino: Destino = 'site') => {
    const lista = ultimos.current[destino] ?? [];
    if (!lista.length) return [];
    const novos = destino === 'site' ? await conferirSite(lista) : await conferirLoja(destino, lista);
    const mudancas: MudancaCarrinho[] = [];
    for (const i of lista) {
      const novo = novos.get(i.codprod);
      const nome = novo?.nome ?? i.nome;
      if (!novo || novo.estoque <= 0) {
        if (!i.indisponivel) mudancas.push({ tipo: 'indisponivel', codprod: i.codprod, nome });
      } else {
        if (novo.preco !== i.preco) mudancas.push({ tipo: 'preco', codprod: i.codprod, nome, de: i.preco, para: novo.preco });
        if (i.quantidade > novo.estoque) mudancas.push({ tipo: 'quantidade', codprod: i.codprod, nome });
      }
    }
    setCarrinhos((c) => ({
      ...c,
      [destino]: (c[destino] ?? []).map((i) => {
        if (!lista.some((l) => l.codprod === i.codprod)) return i; // entrou no carrinho depois da consulta
        const novo = novos.get(i.codprod);
        if (!novo || novo.estoque <= 0) return { ...i, ...novo, quantidade: i.quantidade, indisponivel: true };
        return { ...i, ...novo, quantidade: Math.min(i.quantidade, novo.estoque), indisponivel: false };
      }),
    }));
    return mudancas;
  }, []);

  const valor = useMemo<Contexto>(() => {
    const mudar = (destino: Destino, f: (lista: ItemCarrinho[]) => ItemCarrinho[]) =>
      setCarrinhos((c) => ({ ...c, [destino]: f(c[destino] ?? []) }));
    return {
      itens: (destino = 'site') => carrinhos[destino] ?? [],
      adicionar: (produto, destino = 'site', quantidade = 1) =>
        mudar(destino, (lista) => {
          const atual = lista.find((i) => i.codprod === produto.codprod);
          const limite = Math.max(1, produto.estoque);
          // Adicionar de novo traz o preço e a disponibilidade de agora.
          if (atual)
            return lista.map((i) =>
              i.codprod === produto.codprod
                ? { ...i, ...produto, quantidade: Math.min(limite, (i.indisponivel ? 0 : i.quantidade) + quantidade), indisponivel: false }
                : i,
            );
          return [...lista, { ...produto, quantidade: Math.min(limite, quantidade) }];
        }),
      alterar: (codprod, quantidade, destino = 'site') =>
        mudar(destino, (lista) =>
          quantidade <= 0
            ? lista.filter((i) => i.codprod !== codprod)
            : lista.map((i) => (i.codprod === codprod ? { ...i, quantidade: Math.min(Math.max(1, i.estoque), quantidade) } : i)),
        ),
      remover: (codprod, destino = 'site') => mudar(destino, (lista) => lista.filter((i) => i.codprod !== codprod)),
      esvaziar: (destino = 'site') => mudar(destino, () => []),
      quantidadeTotal: (destino = 'site') => (carrinhos[destino] ?? []).reduce((t, i) => t + i.quantidade, 0),
      atualizar,
    };
  }, [carrinhos, atualizar]);

  return <ContextoCarrinho.Provider value={valor}>{children}</ContextoCarrinho.Provider>;
}

type Atual = Partial<Pick<ItemCarrinho, 'nome' | 'preco' | 'precoDe' | 'descontoPix' | 'imagem' | 'estoque' | 'entregavel'>> & {
  nome: string;
  preco: number;
  estoque: number;
};

/** Carrinho do site: uma consulta com todos os códigos (GET /api/app/produtos?codprod=...). Fora da lista = saiu. */
async function conferirSite(lista: ItemCarrinho[]) {
  const produtos = await api.produtos({ codprods: lista.map((i) => i.codprod) });
  return new Map<string, Atual>(
    produtos.map((p) => [
      p.codprod,
      { nome: p.nome, preco: p.preco, precoDe: p.precoDe, descontoPix: p.descontoPix, imagem: p.imagem, estoque: p.estoque },
    ]),
  );
}

/** Carrinho de uma loja (Figital): o limite é o da saída que o cliente escolheu (loja, CD ou outra loja). */
async function conferirLoja(loja: string, lista: ItemCarrinho[]) {
  const novos = new Map<string, Atual>();
  await Promise.all(
    lista.map(async (i) => {
      try {
        const { produto: p, origem, entregavel } = await api.produtoNaLoja(loja, { codprod: i.codprod });
        const limite =
          !i.origemEstoque || i.origemEstoque === origem.origem
            ? origem.disponivel
            : origem.alternativa?.origem === i.origemEstoque
              ? origem.alternativa.disponivel
              : i.estoque;
        const atual: Atual = { nome: p.nome, preco: p.preco, precoDe: p.precoDe, descontoPix: p.descontoPix, estoque: limite, entregavel };
        if (p.imagens[0]?.src) atual.imagem = p.imagens[0].src;
        novos.set(i.codprod, atual);
      } catch (e) {
        // 404/410: o produto saiu da loja (fica fora do mapa = indisponível). Rede ou erro do site: não dá para conferir.
        if (!(e instanceof ErroApi && (e.status === 404 || e.status === 410))) throw e;
      }
    }),
  );
  return novos;
}

export function useCarrinho() {
  const c = useContext(ContextoCarrinho);
  if (!c) throw new Error('useCarrinho fora do ProvedorCarrinho');
  return c;
}
