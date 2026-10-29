// Carrinhos do app: um do site e um por loja física (Figital), separados como no site. O preço aqui é o da vitrine;
// o servidor recalcula promoções, Pix e frete no checkout e só ele vale.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

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
};

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
};

const CHAVE = 'carrinhos:v1';
const ContextoCarrinho = createContext<Contexto | null>(null);

export function totais(itens: ItemCarrinho[]) {
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

  const valor = useMemo<Contexto>(() => {
    const mudar = (destino: Destino, f: (lista: ItemCarrinho[]) => ItemCarrinho[]) =>
      setCarrinhos((c) => ({ ...c, [destino]: f(c[destino] ?? []) }));
    return {
      itens: (destino = 'site') => carrinhos[destino] ?? [],
      adicionar: (produto, destino = 'site', quantidade = 1) =>
        mudar(destino, (lista) => {
          const atual = lista.find((i) => i.codprod === produto.codprod);
          const limite = Math.max(1, produto.estoque);
          if (atual)
            return lista.map((i) =>
              i.codprod === produto.codprod ? { ...i, quantidade: Math.min(limite, i.quantidade + quantidade) } : i,
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
    };
  }, [carrinhos]);

  return <ContextoCarrinho.Provider value={valor}>{children}</ContextoCarrinho.Provider>;
}

export function useCarrinho() {
  const c = useContext(ContextoCarrinho);
  if (!c) throw new Error('useCarrinho fora do ProvedorCarrinho');
  return c;
}
