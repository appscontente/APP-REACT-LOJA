// Contas do Cofrinho Contente no app, iguais às do site (loja/src/lib/cofrinho/regras.ts). Os números (mínimos, prazo)
// vêm de GET /api/app/cofrinho; o servidor confere tudo de novo em cada pagamento.

import { arredondar, formatarPreco } from './formatar';
import type { RegrasCofrinho } from './tipos';

type Regras = RegrasCofrinho['regras'];

const DIA = 86_400_000;

/** Primeiro pagamento mínimo: o % de entrada do preço, nunca menos que o depósito mínimo nem mais que o preço. */
export function entradaMinima(preco: number, r: Regras) {
  return Math.min(arredondar(preco), Math.max(r.depositoMinimo, Math.ceil((preco * r.entradaMinimaPercentual) / 100)));
}

/** Confere o valor do pagamento; devolve a frase do erro ou o valor arredondado. */
export function conferirDeposito(valor: number, falta: number, primeiro: boolean, preco: number, r: Regras): { erro: string } | { erro?: undefined; valor: number } {
  if (!Number.isFinite(valor) || valor <= 0) return { erro: 'Digite quanto quer guardar.' };
  const v = arredondar(valor);
  const restante = arredondar(falta);
  if (v > restante) return { erro: `Falta só ${formatarPreco(restante)} para completar.` };
  const minimo = primeiro ? entradaMinima(preco, r) : Math.min(r.depositoMinimo, restante);
  if (v < minimo)
    return {
      erro: primeiro ? `O primeiro pagamento é de pelo menos ${formatarPreco(minimo)} (${r.entradaMinimaPercentual}% do preço).` : `O pagamento mínimo é de ${formatarPreco(minimo)}.`,
    };
  return { valor: v };
}

/** Dias da semana do lembrete (0 = domingo, como Date.getDay). */
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

const HORA = 3_600_000;

/** Até quando o primeiro pagamento pode ser feito: abertura + 24 horas (o Pix do primeiro pagamento vence aí). */
export const primeiroPagamentoAte = (abertura: string, r: Regras) => new Date(new Date(abertura).getTime() + r.primeiroPagamentoHoras * HORA).toISOString();

/** Fim da proteção do preço (os avisos de alta), contada do primeiro pagamento. */
export const protegidoAte = (primeiroPagamento: string, r: Regras) => new Date(new Date(primeiroPagamento).getTime() + r.prazoDias * DIA).toISOString();

/** O preço do cofrinho nunca sobe: fica com o menor entre o atual e o à vista do dia (a redução não volta). */
export const precoDoCofrinho = (atual: number, avistaHoje: number) => arredondar(Math.min(atual, avistaHoje));

/** Desconto do cofrinho: quanto o à vista do dia passa do preço do cofrinho. */
export const descontoDoCofrinho = (precoCofrinho: number, avistaHoje: number) => arredondar(Math.max(0, avistaHoje - precoCofrinho));

/** Arrependimento: sempre antes do recebimento; até 7 dias depois dele. */
export const dentroDoArrependimento = (recebidoEm: string | undefined, r: Regras, agora = Date.now()) => !recebidoEm || agora <= new Date(recebidoEm).getTime() + r.arrependimentoDiasAposEntrega * DIA;

/** Crédito com bônus na falta do produto: principal e bônus separados. */
export const creditoComBonus = (principal: number, r: Regras) => ({ principal: arredondar(principal), bonus: arredondar((principal * r.bonusCreditoPercentual) / 100) });

/** Protocolo mostrado na hora (arrependimento, devolução, crédito). Com o backend, quem numera é o Happy. */
export const novoProtocolo = (agora = Date.now()) => `CC${new Date(agora).toISOString().slice(0, 10).replace(/-/g, '')}${String(agora % 100000).padStart(5, '0')}`;

/** Dias que faltam até a data (0 no dia; negativo depois). */
export const diasAte = (iso: string, agora = Date.now()) => Math.ceil((new Date(iso).getTime() - agora) / DIA);

/** Valor digitado em reais ("150", "150,50", "1.200,00") → número. */
export function lerReais(texto: string) {
  const limpo = texto.replace(/[^\d,.]/g, '');
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return Number(normal);
}

const data = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeZone: 'America/Belem' });
export const formatarData = (iso: string) => data.format(new Date(iso));
