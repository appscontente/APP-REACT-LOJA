// Carrinhos do app: um do site e um por loja física (Figital), separados como no site. O preço aqui é o da vitrine;
// o servidor recalcula promoções, Pix e frete no checkout e só ele vale. O carrinho guardado no celular é conferido
// com o site ao abrir (atualizar): preço, desconto e disponibilidade do dia, e o item que sumiu fica indisponível.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { api, ErroApi } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import { itemCarrinhoDoConjunto, type PecaConjuntoCarrinho } from '@/lib/conjuntos';
import { DESCONTO_PIX, arredondar, formatarPreco, nomeLegivel } from '@/lib/formatar';
import type { CardProduto, ConjuntoApp, ConjuntoCompleto, OrigemSaida } from '@/lib/tipos';

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
  /**
   * Linha de conjunto (cozinha, cama box, mesa + cadeiras): `codprod` é a chave da configuração (KIT-0001~a1b2c3),
   * `preco` é o total do conjunto e as escolhas são as peças com o preço rateado. O pedido desce uma linha por peça.
   */
  conjunto?: { id: string; escolhas: PecaConjuntoCarrinho[] };
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

/** Texto para o cliente de uma mudança achada na conferência do carrinho (site e loja). */
export const textoMudanca = (m: MudancaCarrinho) => {
  const nome = nomeLegivel(m.nome);
  if (m.tipo === 'preco') return `O preço de ${nome} mudou de ${formatarPreco(m.de)} para ${formatarPreco(m.para)}.`;
  if (m.tipo === 'quantidade') return `Ajustamos a quantidade de ${nome} ao que temos disponível.`;
  return `${nome} ficou indisponível.`;
};

export function totais(todos: ItemCarrinho[]) {
  const itens = disponiveis(todos);
  const subtotal = arredondar(itens.reduce((t, i) => t + i.preco * i.quantidade, 0));
  const pix = arredondar(itens.reduce((t, i) => t + i.preco * (1 - (i.descontoPix ?? DESCONTO_PIX)) * i.quantidade, 0));
  const economia = arredondar(itens.reduce((t, i) => t + ((i.precoDe ?? i.preco) - i.preco) * i.quantidade, 0));
  return { subtotal, pix, economia };
}

/**
 * Desconto do Pix do site só nas linhas de conjunto. No carrinho da loja pago pelo app, o autoatendimento (Happy)
 * substitui o desconto do Pix dos produtos que têm regra lá; o conjunto não tem (motivo "conjunto"), então mantém o
 * do site, como se fosse comprado no site.
 */
export function descontoPixConjuntos(todos: ItemCarrinho[]) {
  return arredondar(
    disponiveis(todos)
      .filter((i) => i.conjunto)
      .reduce((t, i) => t + i.preco * (i.descontoPix ?? DESCONTO_PIX) * i.quantidade, 0),
  );
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
          if (!atual) return [...lista, { ...produto, quantidade: Math.min(Math.max(1, produto.estoque), quantidade) }];
          // Adicionar de novo traz o preço e os dados de vitrine de agora. A saída (loja, CD, outra loja ou mostruário)
          // que o cliente escolheu na loja fica: a página manda a saída padrão, que não deve apagar a escolha.
          const novo: ItemCarrinho = { ...atual, ...produto, quantidade: atual.quantidade + quantidade, indisponivel: false };
          if (atual.indisponivel) {
            // Item que ficou indisponível: a saída nova vem inteira do produto, sem herdar o mostruário antigo.
            novo.origemEstoque = produto.origemEstoque;
            novo.mostruario = produto.mostruario;
            novo.quantidade = quantidade;
          } else if (atual.origemEstoque && produto.origemEstoque && atual.origemEstoque !== produto.origemEstoque) {
            // Outra saída: fica a do item, com o limite dela.
            novo.origemEstoque = atual.origemEstoque;
            novo.estoque = atual.estoque;
            novo.mostruario = atual.mostruario;
          }
          novo.quantidade = Math.min(Math.max(1, novo.estoque), novo.quantidade);
          return lista.map((i) => (i.codprod === produto.codprod ? novo : i));
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

type Atual = Partial<
  Pick<ItemCarrinho, 'nome' | 'preco' | 'precoDe' | 'descontoPix' | 'imagem' | 'estoque' | 'entregavel' | 'origemEstoque' | 'mostruario' | 'conjunto'>
> & {
  nome: string;
  preco: number;
  estoque: number;
};

/**
 * Linha de conjunto conferida de novo: a mesma configuração com o preço e o estoque de agora do conjunto que o site
 * mandou (o do site ou o da loja). Sem conjunto, ou configuração que não serve mais, fica fora do mapa (indisponível).
 */
function conferirConjunto(
  i: ItemCarrinho,
  c: ConjuntoCompleto | undefined,
  novos: Map<string, Atual>,
  /** O que a resposta disse do conjunto: se pode ser pago pelo app (na loja, peça sem medidas = só no caixa) e a fração do Pix dele. */
  extra: { entregavel: boolean; descontoPix?: number },
) {
  if (!c || !i.conjunto) return;
  const novo = itemCarrinhoDoConjunto(c, i.conjunto.escolhas);
  if (!novo || novo.codprod !== i.codprod) return;
  const { nome, preco, precoDe, imagem, estoque, origemEstoque, mostruario, conjunto } = novo;
  novos.set(i.codprod, {
    nome,
    preco,
    precoDe,
    imagem,
    estoque,
    origemEstoque,
    mostruario,
    conjunto,
    entregavel: extra.entregavel,
    // Sem a fração na resposta, a linha fica com a que já tinha (não troca por undefined).
    ...(extra.descontoPix !== undefined && { descontoPix: extra.descontoPix }),
  });
}

/** Carrinho do site: uma consulta com todos os códigos (GET /api/app/produtos?codprod=...). Fora da lista = saiu. */
async function conferirSite(lista: ItemCarrinho[]) {
  const avulsos = lista.filter((i) => !i.conjunto);
  const conjuntos = lista.filter((i) => i.conjunto);
  const [produtos] = await Promise.all([
    avulsos.length ? api.produtos({ codprods: avulsos.map((i) => i.codprod) }) : Promise.resolve([]),
  ]);
  const novos = new Map<string, Atual>(
    produtos.map((p) => [
      p.codprod,
      { nome: p.nome, preco: p.preco, precoDe: p.precoDe, descontoPix: p.descontoPix, imagem: p.imagem, estoque: p.estoque },
    ]),
  );
  // Conjuntos: uma consulta por conjunto (GET /api/app/conjuntos/{id}); 404 = saiu do site, o resto é falha de rede.
  const ids = [...new Set(conjuntos.map((i) => i.conjunto!.id))];
  const porId = new Map<string, ConjuntoApp | undefined>();
  await Promise.all(
    ids.map(async (id) => {
      try {
        porId.set(id, await api.conjunto(id));
      } catch (e) {
        if (!(e instanceof ErroApi && (e.status === 404 || e.status === 410))) throw e;
        porId.set(id, undefined);
      }
    }),
  );
  for (const i of conjuntos) {
    const resposta = porId.get(i.conjunto!.id);
    conferirConjunto(i, resposta?.conjunto, novos, { entregavel: true, descontoPix: resposta?.taxaPix });
  }
  return novos;
}

/** Carrinho de uma loja (Figital): o limite é o da saída que o cliente escolheu (loja, CD ou outra loja). */
async function conferirLoja(loja: string, lista: ItemCarrinho[]) {
  const novos = new Map<string, Atual>();
  await Promise.all(
    lista.map(async (i) => {
      try {
        if (i.conjunto) {
          // Conjunto na loja: a rota do produto na loja pelo ID do conjunto devolve o conjunto com o estoque da loja.
          const resposta = await api.produtoNaLoja(loja, { codprod: i.conjunto.id });
          // `entregavel` da resposta vale para o conjunto; o `produto` que vem junto é o conjunto visto como produto, e
          // dele vale a fração do Pix.
          conferirConjunto(i, resposta.conjunto, novos, { entregavel: resposta.entregavel, descontoPix: resposta.produto.descontoPix });
          return;
        }
        const { produto: p, origem, entregavel } = await api.produtoNaLoja(loja, { codprod: i.codprod });
        const mesma = !i.origemEstoque || i.origemEstoque === origem.origem;
        const alternativa = origem.alternativa?.origem === i.origemEstoque ? origem.alternativa : undefined;
        // O site manda uma saída só, pela prioridade (CD, depois a loja, depois outra loja). Se a do item sumiu da resposta
        // e a de agora tem estoque sem pergunta (não é peça única), o item passa para ela. Peça única ou nada em estoque:
        // fica indisponível, e o cliente escolhe de novo na página do produto.
        const troca = !mesma && !alternativa && !origem.aviso && origem.disponivel > 0 && origem.origem;
        const limite = mesma || troca ? origem.disponivel : alternativa ? alternativa.disponivel : 0;
        const atual: Atual = { nome: p.nome, preco: p.preco, precoDe: p.precoDe, descontoPix: p.descontoPix, estoque: limite, entregavel };
        if (troca) {
          atual.origemEstoque = troca;
          atual.mostruario = false;
        }
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
