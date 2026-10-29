// Conversa com a loja dentro do app, no lugar dos botões de WhatsApp. O vendedor atende pelo admin (Vendas >
// Conversas) ou pelo modo vendedor, e pode mandar cartões de produto que o cliente põe no carrinho com um toque.
// Nesta versão de demonstração as conversas ficam no celular e a loja responde com uma mensagem automática; com o
// backend, as mensagens vão para a seção de conversas do contrato da API (entrega em tempo real e aviso no celular).

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { gravar, ler } from '@/lib/armazenamento';
import type { CardProduto } from '@/lib/tipos';

export type Mensagem = {
  id: string;
  de: 'cliente' | 'loja';
  em: string;
  texto?: string;
  /** Cartão de produto: o cliente põe no carrinho direto da conversa. */
  produto?: Pick<CardProduto, 'codprod' | 'slug' | 'nome' | 'marca' | 'preco' | 'precoDe' | 'imagem' | 'estoque' | 'descontoPix'>;
  /** Nome de quem respondeu pela loja. */
  autor?: string;
};

export type Conversa = {
  id: string;
  /** Slug da loja física; sem loja, cai na fila do atendimento do site. */
  loja?: string;
  nomeLoja: string;
  assunto: string;
  pedido?: string;
  mensagens: Mensagem[];
  lidaEm?: string;
};

type Inicio = { loja?: string; nomeLoja: string; assunto: string; pedido?: string; produto?: Mensagem['produto'] };

type Contexto = {
  conversas: Conversa[];
  naoLidas: number;
  iniciar: (inicio: Inicio) => string;
  enviar: (id: string, texto: string) => void;
  marcarLida: (id: string) => void;
};

const CHAVE = 'conversas:v1';
const ContextoConversas = createContext<Contexto | null>(null);
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const agora = () => new Date().toISOString();

const naoLida = (c: Conversa) => c.mensagens.some((m) => m.de === 'loja' && (!c.lidaEm || m.em > c.lidaEm));

export function ProvedorConversas({ children }: { children: ReactNode }) {
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [pronto, setPronto] = useState(false);
  const respostas = useRef(new Set<string>());

  useEffect(() => {
    ler<Conversa[]>(CHAVE, []).then((c) => {
      setConversas(c);
      setPronto(true);
    });
  }, []);
  useEffect(() => {
    if (pronto) gravar(CHAVE, conversas);
  }, [conversas, pronto]);

  const valor = useMemo<Contexto>(() => {
    const acrescentar = (id: string, m: Mensagem) =>
      setConversas((lista) => lista.map((c) => (c.id === id ? { ...c, mensagens: [...c.mensagens, m] } : c)));

    /** Demonstração: a loja confirma que recebeu. No app real, quem responde é o vendedor. */
    const responderDemonstracao = (id: string, nomeLoja: string) => {
      if (respostas.current.has(id)) return;
      respostas.current.add(id);
      setTimeout(
        () =>
          acrescentar(id, {
            id: novoId(),
            de: 'loja',
            em: agora(),
            autor: `Equipe ${nomeLoja}`,
            texto: `Oi! Recebemos sua mensagem e um vendedor da ${nomeLoja} já vai responder por aqui. Você recebe um aviso no celular quando chegar.`,
          }),
        1200,
      );
    };

    return {
      conversas,
      naoLidas: conversas.filter(naoLida).length,
      iniciar: ({ produto, ...inicio }) => {
        const id = novoId();
        const mensagens: Mensagem[] = produto ? [{ id: novoId(), de: 'cliente', em: agora(), produto }] : [];
        setConversas((lista) => [{ id, ...inicio, mensagens }, ...lista]);
        return id;
      },
      enviar: (id, texto) => {
        const conversa = conversas.find((c) => c.id === id);
        acrescentar(id, { id: novoId(), de: 'cliente', em: agora(), texto });
        if (conversa) responderDemonstracao(id, conversa.nomeLoja);
      },
      marcarLida: (id) => setConversas((lista) => lista.map((c) => (c.id === id ? { ...c, lidaEm: agora() } : c))),
    };
  }, [conversas]);

  return <ContextoConversas.Provider value={valor}>{children}</ContextoConversas.Provider>;
}

export function useConversas() {
  const c = useContext(ContextoConversas);
  if (!c) throw new Error('useConversas fora do ProvedorConversas');
  return c;
}
