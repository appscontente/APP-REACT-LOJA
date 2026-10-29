// Conta do cliente no app: login por código no e-mail (contrato, 17.1 e 17.2), CEP, favoritos e pedidos feitos aqui.
// Nesta versão de demonstração o login e os pedidos ficam só no celular; com o backend, o token da sessão vai para o
// cofre do celular (expo-secure-store) e os pedidos vêm de GET /clientes/eu/pedidos.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { gravar, ler } from '@/lib/armazenamento';
import { cores } from '@/lib/tema';
import type { ItemCarrinho } from './carrinho';

export type PedidoApp = {
  numero: string;
  criadoEm: string;
  itens: ItemCarrinho[];
  total: number;
  forma: 'pix' | 'cartao';
  entrega: 'entrega' | 'retirada';
  /** Como o site: "Pedido recebido, pagamento em análise" até a ClearSale e a captura. */
  situacao: 'em-analise' | 'aguardando-pix';
  loja?: string;
};

/** Como a situação aparece para o cliente. */
export const SITUACOES: Record<PedidoApp['situacao'], { texto: string; cor: string; fundo: string }> = {
  'em-analise': { texto: 'Pagamento em análise', cor: cores.aviso, fundo: cores.avisoFundo },
  'aguardando-pix': { texto: 'Aguardando o Pix', cor: cores.aviso, fundo: cores.avisoFundo },
};

type Dados = {
  email?: string;
  nome?: string;
  cep?: string;
  favoritos: string[];
  pedidos: PedidoApp[];
};

type Contexto = Dados & {
  logado: boolean;
  entrar: (email: string, nome?: string) => void;
  sair: () => void;
  definirCep: (cep: string) => void;
  alternarFavorito: (codprod: string) => void;
  favorito: (codprod: string) => boolean;
  registrarPedido: (pedido: PedidoApp) => void;
};

const CHAVE = 'conta:v1';
const ContextoConta = createContext<Contexto | null>(null);

export function ProvedorConta({ children }: { children: ReactNode }) {
  const [dados, setDados] = useState<Dados>({ favoritos: [], pedidos: [] });
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    ler<Dados>(CHAVE, { favoritos: [], pedidos: [] }).then((d) => {
      setDados(d);
      setPronto(true);
    });
  }, []);
  useEffect(() => {
    if (pronto) gravar(CHAVE, dados);
  }, [dados, pronto]);

  const valor = useMemo<Contexto>(
    () => ({
      ...dados,
      logado: Boolean(dados.email),
      entrar: (email, nome) => setDados((d) => ({ ...d, email, nome: nome ?? d.nome })),
      sair: () => setDados((d) => ({ ...d, email: undefined, nome: undefined, pedidos: [] })),
      definirCep: (cep) => setDados((d) => ({ ...d, cep })),
      alternarFavorito: (codprod) =>
        setDados((d) => ({
          ...d,
          favoritos: d.favoritos.includes(codprod) ? d.favoritos.filter((c) => c !== codprod) : [codprod, ...d.favoritos],
        })),
      favorito: (codprod) => dados.favoritos.includes(codprod),
      registrarPedido: (pedido) => setDados((d) => ({ ...d, pedidos: [pedido, ...d.pedidos] })),
    }),
    [dados],
  );

  return <ContextoConta.Provider value={valor}>{children}</ContextoConta.Provider>;
}

export function useConta() {
  const c = useContext(ContextoConta);
  if (!c) throw new Error('useConta fora do ProvedorConta');
  return c;
}
