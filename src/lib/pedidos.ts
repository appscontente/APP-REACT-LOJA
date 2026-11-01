// Textos e cores dos pedidos, iguais aos do site (loja/src/lib/pedidos.ts): rótulo de cada etapa e de cada canal,
// texto da entrega, da montagem e da equipe a caminho, e a cor da etiqueta da situação. Usados em Acompanhar entrega
// (/rastreio); a linha do tempo pronta (`passos`) e o tom da situação já vêm do site em POST /api/app/rastreio.

import { formatarHora } from './formatar';
import { cores } from './tema';
import type { CanalPedido, EtapaPedido, PedidoRastreio, RastreioApp } from './tipos';

/** Mesmos textos da área do cliente e do admin do site. */
export const ROTULO_ETAPA: Record<EtapaPedido, string> = {
  recebido: 'Pedido recebido',
  separacao_conferida: 'Conferência da separação',
  pagamento_aprovado: 'Pagamento aprovado',
  faturado: 'Nota emitida',
  em_separacao: 'Em separação',
  saiu_para_entrega: 'Saiu para entrega',
  entregue: 'Entregue',
  montagem_agendada: 'Montagem agendada',
  montado: 'Montagem concluída',
  retirado: 'Retirado na loja',
  cancelado: 'Cancelado',
};

export const ROTULO_CANAL: Record<CanalPedido, string> = { site: 'Site', figital: 'Loja (QR)', loja: 'Loja' };

const TURNO = { manha: 'de manhã', tarde: 'à tarde' } as const;

const diaMes = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', timeZone: 'America/Belem' });

/**
 * "12/11": só dia e mês, como o cliente lê uma previsão. Data sem hora ("2026-11-12") é lida como está, sem passar
 * pelo fuso (lida como UTC, ela viraria o dia anterior em Belém).
 */
export function formatarDiaMes(data: string) {
  const soDia = /^(\d{4})-(\d{2})-(\d{2})$/.exec(data);
  if (soDia) return `${soDia[3]}/${soDia[2]}`;
  return diaMes.format(new Date(data));
}

/** Etapas em que a entrega (ou a retirada) já aconteceu: previsão e agendamento não fazem mais sentido. */
const ENTREGA_FEITA = new Set<EtapaPedido>(['entregue', 'montagem_agendada', 'montado', 'retirado', 'cancelado']);

/**
 * Bloco da entrega: "Entrega em Belém, previsão 12/11", "Entrega em Belém, agendada para 12/11, de manhã" ou
 * "Retirada na loja". Só a cidade, nunca o endereço, como no site.
 */
export function textoEntrega(p: PedidoRastreio): string | undefined {
  const e = p.entrega;
  if (!e) return undefined;
  if (e.modalidade === 'retirada') return 'Retirada na loja';
  const onde = e.cidade ? `Entrega em ${e.cidade}` : 'Entrega em casa';
  if (ENTREGA_FEITA.has(p.situacao)) return onde;
  if (e.agendamento) return `${onde}, agendada para ${formatarDiaMes(e.agendamento.dia)}, ${TURNO[e.agendamento.turno]}`;
  if (e.previsao) return `${onde}, previsão ${formatarDiaMes(e.previsao)}`;
  return onde;
}

/** "Montagem incluída", "Montagem agendada para 12/11, a partir das 08:00" ou "Montagem concluída"; sem montagem, nada. */
export function textoMontagem(p: PedidoRastreio): string | undefined {
  const m = p.montagem;
  if (!m?.incluida) return undefined;
  if (p.situacao === 'montado') return 'Montagem concluída';
  if (!m.agendadaPara) return 'Montagem incluída';
  // Só com hora na data; um dia sem hora não vira "a partir das 21:00".
  const hora = m.agendadaPara.includes('T') ? `, a partir das ${formatarHora(m.agendadaPara)}` : '';
  return `Montagem agendada para ${formatarDiaMes(m.agendadaPara)}${hora}`;
}

/** Equipe em rota (Happy Service): "Saiu para entrega: chegada prevista às 14:30 (2 paradas antes)". */
export function textoACaminho(a: NonNullable<PedidoRastreio['aCaminho']>) {
  const quem = a.tipo === 'entrega' ? 'Saiu para entrega' : 'Montador a caminho';
  const paradas =
    a.paradasAntes === undefined
      ? ''
      : a.paradasAntes === 0
        ? ' (você é a próxima parada)'
        : a.paradasAntes === 1
          ? ' (1 parada antes)'
          : ` (${a.paradasAntes} paradas antes)`;
  return `${quem}: chegada prevista às ${formatarHora(a.chegadaPrevista)}${paradas}`;
}

/** Cor da etiqueta da situação pelo tom que o site mandou: concluído (verde), cancelado (vermelho) ou em andamento. */
export function corEtiqueta(tom: RastreioApp['tom']): { cor: string; fundo: string } {
  if (tom === 'ok') return { cor: cores.sucesso, fundo: cores.sucessoFundo };
  if (tom === 'erro') return { cor: cores.marca, fundo: cores.avisoFundo };
  return { cor: cores.aviso, fundo: cores.avisoFundo };
}
