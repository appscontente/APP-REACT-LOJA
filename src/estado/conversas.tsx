// Conversa com a loja dentro do app, no lugar dos botões de WhatsApp. O vendedor atende pelo admin (Vendas >
// Conversas) ou pelo modo vendedor, e pode mandar cartões de produto que o cliente põe no carrinho com um toque.
// Nesta versão de demonstração as conversas ficam no celular e a loja responde com uma mensagem automática; com o
// backend, as mensagens vão para a seção de conversas do contrato da API (entrega em tempo real e aviso no celular).

import * as Notifications from 'expo-notifications';
import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';

import { gravar, ler } from '@/lib/armazenamento';
import { formatarHora } from '@/lib/formatar';
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
  /**
   * Slug da loja física; sem loja, cai na fila do atendimento do site. Com o Blip dentro do Happy, é por ele que a
   * conversa entra na fila de atendimento daquela loja (a que o cliente escolheu ou onde ele está).
   */
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
  /** Não grava texto com número de cartão (veja pareceCartao). */
  enviar: (id: string, texto: string) => void;
  marcarLida: (id: string) => void;
  /** Apaga todas as conversas do celular (ao sair da conta). */
  limpar: () => void;
};

const CHAVE = 'conversas:v1';
const ContextoConversas = createContext<Contexto | null>(null);
const novoId = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const agora = () => new Date().toISOString();

/** Mensagem mostrada quando o texto parece ter número de cartão. */
export const AVISO_CARTAO = 'Por segurança, não mande dados do cartão aqui. Peça ao vendedor um link de pagamento.';

function passaLuhn(digitos: string) {
  let soma = 0;
  for (let i = 0; i < digitos.length; i++) {
    let d = Number(digitos[digitos.length - 1 - i]);
    if (i % 2 === 1) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    soma += d;
  }
  return soma % 10 === 0;
}

/**
 * true se o texto tem um número de cartão: 13 a 19 dígitos (com espaço, ponto, traço ou barra entre eles, até 3 seguidos,
 * ou em linhas de 4 dígitos) que passam no teste de Luhn. Confere cada trecho de grupos vizinhos, para pegar o cartão também depois
 * de um CPF ou telefone na linha de cima e antes da validade e do CVV. Grupo com menos de 4 dígitos só entra sozinho ou
 * no fim do trecho (cartão de 19 dígitos em 4-4-4-4-3): assim CPF, CEP e telefone não se juntam num falso cartão.
 * 13 dígitos só vale começando com 4 (Visa antigo): celular com +55 tem 13 dígitos e passaria no Luhn 1 vez em 10.
 * O cartão nunca pode ficar gravado na conversa (PCI).
 */
export function pareceCartao(texto: string) {
  const tamanhoOk = (c: string) => (c.length >= 14 || (c.length === 13 && c[0] === '4')) && c.length <= 19;
  // A quebra de linha só junta grupos de 4 dígitos (cartão digitado em linhas). Entre outros números (pedido, nota, CPF
  // numa linha e telefone na outra) ela separa, com um "|" que a busca abaixo não atravessa.
  const linhas = texto.split(/\r?\n/);
  let junto = linhas[0];
  for (let k = 1; k < linhas.length; k++)
    junto += (/(?:^|\D)\d{4}\s*$/.test(junto) && /^\s*\d{4}(?:\D|$)/.test(linhas[k]) ? ' ' : ' | ') + linhas[k];
  for (const [sequencia] of junto.matchAll(/\d(?:[\s.\-\/]{0,3}\d)*/g)) {
    const grupos = sequencia.split(/[\s.\-\/]+/);
    for (let i = 0; i < grupos.length; i++) {
      let candidato = '';
      for (let j = i; j < grupos.length && candidato.length <= 19; j++) {
        if (j > i && grupos[j - 1].length < 4) break;
        candidato += grupos[j];
        if (tamanhoOk(candidato) && /^[2-6]/.test(candidato) && passaLuhn(candidato)) return true;
      }
    }
  }
  return false;
}

const FUSO = 'America/Belem';
const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });

/** 'Hoje', 'Ontem' ou a data (dd/mm, com o ano se não for o atual), no fuso das lojas. Separa os balões por dia. */
export function rotuloDia(iso: string) {
  const data = dia.format(new Date(iso));
  const agoraMs = Date.now();
  const hoje = dia.format(new Date(agoraMs));
  if (data === hoje) return 'Hoje';
  if (data === dia.format(new Date(agoraMs - 24 * 60 * 60 * 1000))) return 'Ontem';
  return data.slice(6) === hoje.slice(6) ? data.slice(0, 5) : data;
}

/** Hora se for hoje; senão 'Ontem' ou a data. Usado na lista de conversas. */
export function formatarQuando(iso: string) {
  const rotulo = rotuloDia(iso);
  return rotulo === 'Hoje' ? formatarHora(iso) : rotulo;
}

/** Permissão de aviso no celular já concedida (sem ela, a conversa não promete aviso). */
export async function avisosPermitidos() {
  try {
    return (await Notifications.getPermissionsAsync()).granted;
  } catch {
    return false;
  }
}

/** Produto com que a conversa começou (cartão mandado pelo cliente ao abrir a conversa pelo produto). */
const produtoInicial = (c: Conversa) => (c.mensagens[0]?.de === 'cliente' ? c.mensagens[0].produto?.codprod : undefined);

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
      setTimeout(async () => {
        const aviso = (await avisosPermitidos()) ? 'Você recebe um aviso no celular quando chegar.' : 'Volte aqui para ver a resposta.';
        acrescentar(id, {
          id: novoId(),
          de: 'loja',
          em: agora(),
          autor: `Equipe ${nomeLoja}`,
          texto: `Oi! Recebemos sua mensagem e um vendedor da ${nomeLoja} já vai responder por aqui. ${aviso}`,
        });
      }, 1200);
    };

    return {
      conversas,
      naoLidas: conversas.filter(naoLida).length,
      iniciar: ({ produto, ...inicio }) => {
        // Reaproveita a conversa com a mesma loja, o mesmo assunto, o mesmo pedido e o mesmo produto: cada toque em
        // "conversar" não cria outra conversa vazia (nem, com o backend, outro atendimento na fila do vendedor).
        const mesma = (c: Conversa) =>
          c.loja === inicio.loja && c.assunto === inicio.assunto && c.pedido === inicio.pedido && produtoInicial(c) === produto?.codprod;
        const existente = conversas.find(mesma);
        if (existente) return existente.id;
        const id = novoId();
        const mensagens: Mensagem[] = produto ? [{ id: novoId(), de: 'cliente', em: agora(), produto }] : [];
        setConversas((lista) => [{ id, ...inicio, mensagens }, ...lista]);
        return id;
      },
      enviar: (id, texto) => {
        // A tela já recusa e explica; aqui é a garantia de que nenhum caminho grava cartão no celular.
        if (pareceCartao(texto)) return;
        const conversa = conversas.find((c) => c.id === id);
        acrescentar(id, { id: novoId(), de: 'cliente', em: agora(), texto });
        if (conversa) responderDemonstracao(id, conversa.nomeLoja);
      },
      marcarLida: (id) => setConversas((lista) => lista.map((c) => (c.id === id ? { ...c, lidaEm: agora() } : c))),
      // O efeito acima grava a lista vazia em conversas:v1. Com o backend, sair também desliga o aparelho
      // (DELETE /clientes/eu/aparelhos, contrato 38.2).
      limpar: () => {
        respostas.current.clear();
        setConversas([]);
      },
    };
  }, [conversas]);

  return <ContextoConversas.Provider value={valor}>{children}</ContextoConversas.Provider>;
}

export function useConversas() {
  const c = useContext(ContextoConversas);
  if (!c) throw new Error('useConversas fora do ProvedorConversas');
  return c;
}
