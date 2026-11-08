// Contas do Cofrinho Contente no app, iguais às do site (loja/src/lib/cofrinho/regras.ts). Os números (mínimos, prazo)
// vêm de GET /api/app/cofrinho; o servidor confere tudo de novo em cada depósito.

import { arredondar, formatarPreco } from './formatar';
import type { RegrasCofrinho } from './tipos';

type Regras = RegrasCofrinho['regras'];

const DIA = 86_400_000;

/** Primeiro depósito mínimo: o % de entrada do preço, nunca menos que o depósito mínimo nem mais que o preço. */
export function entradaMinima(preco: number, r: Regras) {
  return Math.min(arredondar(preco), Math.max(r.depositoMinimo, Math.ceil((preco * r.entradaMinimaPercentual) / 100)));
}

/** Confere o valor do depósito; devolve a frase do erro ou o valor arredondado. */
export function conferirDeposito(valor: number, falta: number, primeiro: boolean, preco: number, r: Regras): { erro: string } | { erro?: undefined; valor: number } {
  if (!Number.isFinite(valor) || valor <= 0) return { erro: 'Digite o valor do depósito.' };
  const v = arredondar(valor);
  const restante = arredondar(falta);
  if (v > restante) return { erro: `Falta só ${formatarPreco(restante)} para completar.` };
  const minimo = primeiro ? entradaMinima(preco, r) : Math.min(r.depositoMinimo, restante);
  if (v < minimo)
    return {
      erro: primeiro
        ? `O primeiro depósito é de pelo menos ${formatarPreco(minimo)} (${r.entradaMinimaPercentual}% do preço).`
        : `O depósito mínimo é de ${formatarPreco(minimo)}.`,
    };
  return { valor: v };
}

/** Dias da semana do pagamento semanal (0 = domingo, como Date.getDay). */
export const DIAS_SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'] as const;

/**
 * Valor por semana que completa o cofrinho até o fim da garantia (só uma sugestão: o cliente digita o que quiser). Nunca
 * menos que o depósito mínimo nem mais que o que falta.
 */
export function valorSemanal(falta: number, garantidoAte: string, r: Regras, agora = Date.now()) {
  if (falta <= 0) return 0;
  const semanas = Math.max(1, Math.floor(diasAte(garantidoAte, agora) / 7) + 1);
  return Math.min(arredondar(falta), Math.max(r.depositoMinimo, Math.ceil(falta / semanas)));
}

/** Próximo dia da semana escolhido, às 9h, depois de `agora` (o Pix de hoje já sai na hora em que o plano começa). */
export function proximaSemana(diaSemana: number, agora = Date.now()) {
  const d = new Date(agora);
  d.setHours(9, 0, 0, 0);
  const dias = (diaSemana - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + dias);
  return d.toISOString();
}

/** Troca por escolha mantém o prazo; troca porque o produto esgotou recomeça a garantia. */
export const garantiaDaTroca = (motivo: 'escolha' | 'esgotado', atual: string, r: Regras, agora = Date.now()) =>
  motivo === 'esgotado' ? new Date(agora + r.prazoDias * DIA).toISOString() : atual;

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
