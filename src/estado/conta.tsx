// Conta do cliente no app: login por código no e-mail (contrato, 17.1 e 17.2), CEP, favoritos e pedidos feitos aqui.
// Nesta versão de demonstração o login e os pedidos ficam só no celular; com o backend, o token da sessão vai para o
// cofre do celular (expo-secure-store) e os pedidos vêm de GET /clientes/eu/pedidos.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apagar, gravar, ler } from '@/lib/armazenamento';
import { cores } from '@/lib/tema';
import type { ItemCarrinho } from './carrinho';
import { useConversas } from './conversas';

export type PedidoApp = {
  numero: string;
  criadoEm: string;
  itens: ItemCarrinho[];
  total: number;
  /** Frete cotado, cheio (0 na retirada); pedido antigo não tem. O desconto da promoção de frete está em `descontos.frete`. */
  frete?: number;
  forma: 'pix' | 'cartao' | 'cartao-pix';
  entrega: 'entrega' | 'retirada';
  /** Como o site: "Pedido recebido, pagamento em análise" até a ClearSale e a captura. */
  situacao: 'em-analise' | 'aguardando-pix';
  loja?: string;
  /** Celular com DDD, só dígitos (cliente.celular do contrato 3.3). */
  celular?: string;
  /** Endereço de entrega (ou da nota, na retirada), no formato de `entrega` do contrato 3.3. */
  endereco?: { cep: string; logradouro: string; numero: string; complemento?: string; bairro: string; cidade: string; uf: string; referencia?: string };
  /** Pix que falta pagar (Pix sozinho ou cartão + Pix), com os nomes de pagamento.pendente.pix do contrato 17.12. */
  pix?: { valor: number; copiaECola?: string; imagemBase64?: string; expiraEm?: string };
  /**
   * Descontos que o checkout mostrou (o servidor recalcula no pedido real): promoções e cupom do site
   * (POST /api/app/carrinho/calcular) ou, no pedido do carrinho da loja pago pelo app, o autoatendimento (coluna
   * "site" do Happy), mais o desconto do Pix (`pix`) e o da promoção de frete (`frete`). Valores em reais, já somados.
   */
  descontos?: { promocoes?: number; cupom?: string; aplicadas?: string[]; autoatendimento?: number; frete?: number; pix?: number };
};

type Situacao = { texto: string; cor: string; fundo: string };

/**
 * Como a situação aparece para o cliente. Antes de ligar o backend, acrescentar as situações do contrato 17.5
 * (recebido, pagamento_aprovado, faturado, em_separacao, saiu_para_entrega, entregue, montagem_agendada, montado,
 * retirado, cancelado em vermelho) e desenhar as etapas do pedido pela linhaDoTempo.
 */
export const SITUACOES: Record<PedidoApp['situacao'], Situacao> = {
  'em-analise': { texto: 'Pagamento em análise', cor: cores.aviso, fundo: cores.avisoFundo },
  'aguardando-pix': { texto: 'Falta pagar o Pix', cor: cores.aviso, fundo: cores.avisoFundo },
};

const SITUACAO_DESCONHECIDA: Situacao = { texto: 'Em andamento', cor: cores.textoSuave, fundo: cores.fundoAlt };

/** Situação para mostrar; uma que o app ainda não conhece vira "Em andamento" em vez de derrubar a tela. */
export const situacaoDe = (s: string): Situacao => (SITUACOES as Record<string, Situacao | undefined>)[s] ?? SITUACAO_DESCONHECIDA;

/** Buscas recentes da aba Busca (mesma chave de src/app/(abas)/busca.tsx). */
const CHAVE_BUSCAS = 'busca:recentes';

type Dados = {
  email?: string;
  nome?: string;
  cep?: string;
  favoritos: string[];
  pedidos: PedidoApp[];
};

type Contexto = Dados & {
  /** true depois de ler do celular o que estava guardado (antes disso, pedidos e favoritos vêm vazios). */
  pronto: boolean;
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
      pronto,
      logado: Boolean(dados.email),
      entrar: (email, nome) => setDados((d) => ({ ...d, email, nome: nome ?? d.nome })),
      // Sai e apaga do celular o que é da pessoa: e-mail, nome, pedidos, favoritos, CEP e buscas recentes (as conversas
      // saem por useSairDaConta). O carrinho fica. Com o backend, também apaga o token do cofre.
      sair: () => {
        setDados({ favoritos: [], pedidos: [] });
        apagar([CHAVE_BUSCAS]);
      },
      definirCep: (cep) => setDados((d) => ({ ...d, cep })),
      alternarFavorito: (codprod) =>
        setDados((d) => ({
          ...d,
          favoritos: d.favoritos.includes(codprod) ? d.favoritos.filter((c) => c !== codprod) : [codprod, ...d.favoritos],
        })),
      favorito: (codprod) => dados.favoritos.includes(codprod),
      registrarPedido: (pedido) => setDados((d) => ({ ...d, pedidos: [pedido, ...d.pedidos] })),
    }),
    [dados, pronto],
  );

  return <ContextoConta.Provider value={valor}>{children}</ContextoConta.Provider>;
}

/** Sair da conta apagando também as conversas deste celular. Usado em "Sair da conta" e depois de excluir a conta. */
export function useSairDaConta() {
  const { sair } = useConta();
  const { limpar } = useConversas();
  return () => {
    sair();
    limpar();
  };
}

export function useConta() {
  const c = useContext(ContextoConta);
  if (!c) throw new Error('useConta fora do ProvedorConta');
  return c;
}
