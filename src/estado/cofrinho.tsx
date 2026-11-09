// Cofrinho Contente (contrato do site, seção 39; regulamento v4): o cliente escolhe um produto, vê o pedido completo
// (frete, montagem, prazos, endereço), aceita o regulamento e guarda o dinheiro aos poucos. A loja garante o preço: ele
// não sobe nunca e baixa junto com as promoções. As regras, o regulamento e o preço vêm do site (/api/app/cofrinho*);
// o cofrinho em si, com o backend, vem de /api/app/cofrinhos/* (o Happy guarda o saldo, o extrato e os recebimentos).
//
// Nesta versão de demonstração o cofrinho fica só no celular e nada é cobrado. Cartão nunca é guardado: o pagamento só
// grava a forma e o valor. Itens do cofrinho não ganham nem usam cashback (só o bônus do crédito na falta do produto).

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { apagar, gravar, ler } from '@/lib/armazenamento';
import { novoProtocolo, precoDoCofrinho } from '@/lib/cofrinho';
import { arredondar } from '@/lib/formatar';
import { agendarLembrete, cancelarLembrete } from '@/lib/lembrete-cofrinho';
import type { FormaDeposito } from '@/lib/tipos';

export type ItemCofrinho = {
  codprod: string;
  slug: string;
  nome: string;
  imagem?: string;
};

/** Pedido aceito na abertura (regulamento, 3.2): vale até a entrega. */
export type PedidoCofrinho = {
  cep: string;
  endereco: string;
  frete: number;
  montagem: { incluida: boolean; valor: number; texto: string; prazo?: string };
  prazoEntrega: string;
  volumeM3?: number;
};

/**
 * Uma linha do extrato. `efeito` é quanto a linha muda o saldo (pagamento aprovado soma; devolução, transferência que
 * sai e crédito tiram; redução, troca e bônus não mexem no saldo). `valor` é o que a tela mostra.
 */
export type LinhaExtrato = {
  id: string;
  tipo: 'pagamento' | 'reducao' | 'troca' | 'transferencia' | 'devolucao' | 'credito' | 'bonus';
  valor: number;
  efeito: number;
  quando: string;
  texto: string;
  /** Pagamento: Pix (a pagar, aprovado ou vencido) ou no caixa (já aprovado). */
  forma?: FormaDeposito;
  situacao?: 'aprovado' | 'aguardando-pix';
  /** Pix: até quando o código vale. O do primeiro pagamento vence com o prazo de 24 horas. */
  venceEm?: string;
  protocolo?: string;
};

/** Lembrete opcional: o cliente escolhe o dia e, se quiser, um valor sugerido. Não gera Pix nem cobrança. */
export type Lembrete = { diaSemana: number; valorSugerido?: number };

export type Cofrinho = {
  /** CF-000123, como o Happy numera. Na demonstração, gerado no celular. */
  id: string;
  abertoEm: string;
  /** Prazo do primeiro pagamento (abertura + 24 h). Sem ele, o cofrinho expira sem ônus. */
  primeiroPagamentoAte: string;
  /** Fim da proteção do preço (avisos de alta), contada do primeiro pagamento aprovado. */
  protegidoAte?: string;
  item: ItemCofrinho;
  /** Preço do cofrinho: o à vista da abertura (ou da troca), que só baixa. */
  preco: number;
  pedido: PedidoCofrinho;
  extrato: LinhaExtrato[];
  lembrete?: Lembrete;
  /** Aceite: versão e hash do regulamento, declarações, ofertas e o hash das condições do bônus. */
  /** Aceite único: uma caixa cobre o pedido, o regulamento e as declarações do termo (usuário, 09/11/2026). */
  aceite: { versao: string; hash: string; em: string; aceitou: true; ofertas: boolean; hashCondicoesBonus: string };
  situacao: 'aberto' | 'em_falta' | 'concluido' | 'desistido' | 'devolvido' | 'credito';
  /** Produto em falta: a data combinada para esperar a reposição. */
  aguardarAte?: string;
  /** Sobra de uma troca por produto mais barato, até o cliente escolher o destino. */
  excedente?: number;
  concluidoEm?: string;
  recebidoEm?: string;
  protocolo?: string;
};

export type NovoPagamento = { forma: 'pix'; valor: number } | { forma: 'loja' };

/** Valor a juntar (preço do cofrinho + frete + montagem do pedido), saldo e quanto falta. */
export function contas(c: Cofrinho) {
  const alvo = arredondar(c.preco + c.pedido.frete + c.pedido.montagem.valor);
  const saldo = arredondar(c.extrato.reduce((s, l) => s + (l.situacao === 'aguardando-pix' ? 0 : l.efeito), 0));
  const pendente = arredondar(c.extrato.filter((l) => l.situacao === 'aguardando-pix' && !pixVencido(l)).reduce((s, l) => s + l.valor, 0));
  const falta = arredondar(Math.max(0, alvo - saldo));
  return { alvo, saldo, pendente, falta, completo: alvo > 0 && falta <= 0, percentual: alvo > 0 ? Math.min(1, saldo / alvo) : 0 };
}

export const pixVencido = (l: LinhaExtrato, agora = Date.now()) => l.situacao === 'aguardando-pix' && Boolean(l.venceEm) && new Date(l.venceEm!).getTime() < agora;
export const temPagamento = (c: Cofrinho) => c.extrato.some((l) => l.tipo === 'pagamento' && l.situacao === 'aprovado');
/** Sem o primeiro pagamento em 24 horas, o cofrinho expira, sem dívida nem cobrança. */
export const expirado = (c: Cofrinho, agora = Date.now()) => c.situacao === 'aberto' && !temPagamento(c) && new Date(c.primeiroPagamentoAte).getTime() < agora;
/** Cofrinho que ainda ocupa uma das 3 vagas. */
export const ativo = (c: Cofrinho, agora = Date.now()) => (c.situacao === 'aberto' || c.situacao === 'em_falta') && !expirado(c, agora);

type Contexto = {
  cofrinhos: Cofrinho[];
  pronto: boolean;
  ativos: Cofrinho[];
  buscar: (id: string) => Cofrinho | undefined;
  abrir: (dados: Omit<Cofrinho, 'id' | 'abertoEm' | 'extrato' | 'situacao'> & { pagamento: NovoPagamento }) => string;
  pagar: (id: string, pagamento: NovoPagamento, venceEm?: string) => void;
  /** Demonstração: o "banco" confirma o Pix. Com o backend, a confirmação vem da consulta à e.Rede. */
  confirmarPagamento: (id: string, linha: string, protegidoAte?: string) => void;
  /** Demonstração: o caixa da loja recebe pelo código do cofrinho. Com o backend, quem registra é o caixa no Happy. */
  registrarCaixa: (id: string, valor: number, protegidoAte?: string) => void;
  mudarLembrete: (id: string, lembrete: Lembrete | undefined) => void;
  /** Preço à vista do dia mudou (informar_preco): se caiu, o cofrinho baixa e a redução fica no extrato. */
  informarPreco: (id: string, avistaHoje: number) => void;
  trocar: (id: string, dados: { item: ItemCofrinho; preco: number; pedido: PedidoCofrinho; motivo: 'preferencia' | 'falha_fornecimento' }) => void;
  destinarExcedente: (id: string, partes: { transferir?: { valor: number; para: string }; devolver?: number; guardar?: number }) => void;
  marcarFalta: (id: string) => void;
  aguardarReposicao: (id: string, ate: string) => void;
  /** Arrependimento ou devolução na falta: devolve tudo e fecha com protocolo. */
  desistir: (id: string, motivo: 'arrependimento' | 'falha_fornecimento') => string;
  converterCredito: (id: string, principal: number, bonus: number) => string;
  concluir: (id: string) => void;
  /** Demonstração: o produto chegou (começa a contar o prazo de 7 dias do arrependimento). */
  marcarRecebido: (id: string) => void;
  limpar: () => void;
};

const CHAVE = 'cofrinho:v2';
const ContextoCofrinho = createContext<Contexto | null>(null);

const agoraIso = () => new Date().toISOString();
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const linha = (dados: Omit<LinhaExtrato, 'id' | 'quando'>): LinhaExtrato => ({ id: novoId('L'), quando: agoraIso(), ...dados });

/** Pix de demonstração vale 24 horas (o da e.Rede vale até 15 dias; o do primeiro pagamento, até o prazo dele). */
const VALIDADE_PIX = 24 * 3_600_000;

export function ProvedorCofrinho({ children }: { children: ReactNode }) {
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    // A versão 1 da demonstração (antes do regulamento v4) não é lida: nenhum cliente depositou de verdade.
    apagar(['cofrinho:v1']);
    ler<Cofrinho[]>(CHAVE, []).then((lista) => {
      setCofrinhos(Array.isArray(lista) ? lista : []);
      setPronto(true);
    });
  }, []);
  useEffect(() => {
    if (pronto) gravar(CHAVE, cofrinhos);
  }, [cofrinhos, pronto]);

  // Tocar no lembrete abre o cofrinho.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const id = r?.notification.request.content.data?.cofrinho;
      if (typeof id === 'string') router.push({ pathname: '/cofrinho/[id]', params: { id } });
    };
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, []);

  const valor = useMemo<Contexto>(() => {
    const mudar = (id: string, f: (c: Cofrinho) => Cofrinho) => setCofrinhos((lista) => lista.map((c) => (c.id === id ? f(c) : c)));
    const pagamento = (p: NovoPagamento, venceEm?: string) =>
      p.forma === 'pix'
        ? [
            linha({
              tipo: 'pagamento',
              forma: 'pix',
              valor: arredondar(p.valor),
              efeito: arredondar(p.valor),
              situacao: 'aguardando-pix',
              venceEm: venceEm ?? new Date(Date.now() + VALIDADE_PIX).toISOString(),
              texto: 'Pix',
            }),
          ]
        : [];
    // A proteção de 90 dias começa no primeiro pagamento aprovado.
    const aprovar = (c: Cofrinho, protegidoAte?: string): Cofrinho => (c.protegidoAte || !protegidoAte ? c : { ...c, protegidoAte });
    const fechar = (id: string) => cancelarLembrete(id);

    return {
      cofrinhos,
      pronto,
      ativos: cofrinhos.filter((c) => ativo(c)),
      buscar: (id) => cofrinhos.find((c) => c.id === id),
      abrir: ({ pagamento: p, ...dados }) => {
        const numero = String(Math.floor(Date.now() / 1000) % 1_000_000).padStart(6, '0');
        const id = `CF-${numero}`;
        setCofrinhos((lista) => [{ ...dados, id, abertoEm: agoraIso(), extrato: pagamento(p, dados.primeiroPagamentoAte), situacao: 'aberto' }, ...lista]);
        if (dados.lembrete) agendarLembrete(id, dados.item.nome, dados.lembrete);
        return id;
      },
      pagar: (id, p, venceEm) => mudar(id, (c) => ({ ...c, extrato: [...c.extrato, ...pagamento(p, venceEm)] })),
      confirmarPagamento: (id, l, protegidoAte) =>
        mudar(id, (c) => aprovar({ ...c, extrato: c.extrato.map((x) => (x.id === l && x.situacao === 'aguardando-pix' && !pixVencido(x) ? { ...x, situacao: 'aprovado' } : x)) }, protegidoAte)),
      registrarCaixa: (id, v, protegidoAte) =>
        mudar(id, (c) => aprovar({ ...c, extrato: [...c.extrato, linha({ tipo: 'pagamento', forma: 'loja', valor: v, efeito: v, situacao: 'aprovado', texto: 'No caixa' })] }, protegidoAte)),
      mudarLembrete: (id, lembrete) => {
        const c = cofrinhos.find((x) => x.id === id);
        if (lembrete && c) agendarLembrete(id, c.item.nome, lembrete);
        else cancelarLembrete(id);
        mudar(id, ({ lembrete: _l, ...x }) => (lembrete ? { ...x, lembrete } : x));
      },
      // Devolve a mesma lista quando o preço não caiu: a tela chama a cada consulta e não pode entrar em laço.
      informarPreco: (id, avistaHoje) =>
        setCofrinhos((lista) => {
          const c = lista.find((x) => x.id === id);
          if (!c || precoDoCofrinho(c.preco, avistaHoje) >= c.preco) return lista;
          const reducao = arredondar(c.preco - avistaHoje);
          return lista.map((x) =>
            x.id === id ? { ...x, preco: arredondar(avistaHoje), extrato: [...x.extrato, linha({ tipo: 'reducao', valor: reducao, efeito: 0, texto: 'Redução de preço do produto' })] } : x,
          );
        }),
      trocar: (id, { item, preco, pedido, motivo }) =>
        mudar(id, (c) => {
          const { saldo } = contas(c);
          const alvo = arredondar(preco + pedido.frete + pedido.montagem.valor);
          const sobra = arredondar(Math.max(0, saldo - alvo));
          return {
            ...c,
            item,
            preco,
            pedido,
            situacao: 'aberto',
            aguardarAte: undefined,
            ...(sobra > 0 && { excedente: sobra }),
            extrato: [
              ...c.extrato,
              linha({ tipo: 'troca', valor: preco, efeito: 0, texto: `${motivo === 'falha_fornecimento' ? 'Troca pela falta do produto' : 'Troca de produto'}: ${c.item.nome} por ${item.nome}` }),
            ],
          };
        }),
      destinarExcedente: (id, { transferir, devolver, guardar }) =>
        setCofrinhos((lista) =>
          lista.map((c) => {
            if (c.id === id) {
              const novas = [
                transferir?.valor && linha({ tipo: 'transferencia', valor: transferir.valor, efeito: -transferir.valor, texto: `Sobra passada para o ${transferir.para}` }),
                devolver && linha({ tipo: 'devolucao', valor: devolver, efeito: -devolver, texto: 'Sobra devolvida pelo mesmo meio de pagamento', protocolo: novoProtocolo() }),
                guardar && linha({ tipo: 'credito', valor: guardar, efeito: -guardar, texto: 'Sobra guardada como crédito na loja' }),
              ].filter((l): l is LinhaExtrato => Boolean(l));
              return { ...c, excedente: undefined, extrato: [...c.extrato, ...novas] };
            }
            if (transferir && c.id === transferir.para)
              return { ...c, extrato: [...c.extrato, linha({ tipo: 'transferencia', valor: transferir.valor, efeito: transferir.valor, situacao: 'aprovado', texto: `Sobra recebida do ${id}` })] };
            return c;
          }),
        ),
      marcarFalta: (id) => mudar(id, (c) => (c.situacao === 'aberto' ? { ...c, situacao: 'em_falta' } : c)),
      aguardarReposicao: (id, ate) => mudar(id, (c) => ({ ...c, aguardarAte: ate })),
      desistir: (id, motivo) => {
        const protocolo = novoProtocolo();
        fechar(id);
        mudar(id, (c) => {
          const { saldo } = contas(c);
          return {
            ...c,
            situacao: motivo === 'arrependimento' ? 'desistido' : 'devolvido',
            protocolo,
            extrato: [
              ...c.extrato.filter((l) => l.situacao !== 'aguardando-pix'),
              linha({ tipo: 'devolucao', valor: saldo, efeito: -saldo, protocolo, texto: motivo === 'arrependimento' ? 'Devolução integral pelo arrependimento' : 'Devolução pela falta do produto' }),
            ],
          };
        });
        return protocolo;
      },
      converterCredito: (id, principal, bonus) => {
        const protocolo = novoProtocolo();
        fechar(id);
        mudar(id, (c) => ({
          ...c,
          situacao: 'credito',
          protocolo,
          extrato: [
            ...c.extrato.filter((l) => l.situacao !== 'aguardando-pix'),
            linha({ tipo: 'credito', valor: principal, efeito: -principal, protocolo, texto: 'Crédito na loja (principal)' }),
            linha({ tipo: 'bonus', valor: bonus, efeito: 0, protocolo, texto: 'Bônus no seu cashback' }),
          ],
        }));
        return protocolo;
      },
      concluir: (id) => {
        fechar(id);
        mudar(id, (c) => ({ ...c, situacao: 'concluido', concluidoEm: agoraIso() }));
      },
      marcarRecebido: (id) => mudar(id, (c) => ({ ...c, recebidoEm: agoraIso() })),
      limpar: () => {
        for (const c of cofrinhos) cancelarLembrete(c.id);
        setCofrinhos([]);
        apagar([CHAVE]);
      },
    };
  }, [cofrinhos, pronto]);

  return <ContextoCofrinho.Provider value={valor}>{children}</ContextoCofrinho.Provider>;
}

export function useCofrinho() {
  const c = useContext(ContextoCofrinho);
  if (!c) throw new Error('useCofrinho fora do ProvedorCofrinho');
  return c;
}
