// Parte no cartão e parte no Pix, com a mesma conta do site (loja/src/lib/pagamento-dividido.ts): o cliente digita
// quanto vai no cartão e o Pix fica com o resto. O desconto do Pix vale só para a parte paga no Pix, proporcional ao
// que ela cobre do total. O servidor refaz a conta no pedido e recusa se não bater.

import { PARCELAMENTO_PADRAO, arredondar, calcularParcelas } from './formatar';

/** Mínimo de cada forma (exemplo do site; o valor real vem do site em pagamento.minimoPorParte). */
export const MINIMO_POR_PARTE = 100;

/** Regra de parcelas do site (useRegraPagamento) e, quando o site mandar, o mínimo de cada parte. */
export type RegraDivisao = { maxParcelas: number; parcelaMinima: number; minimoPorParte?: number };

export type Divisao = {
  cartao: number;
  pix: number;
  descontoPix: number;
  total: number;
  maxParcelas: number;
  erro?: string;
};

/** "1.234,56" ou "1234,56" para número; vazio vira NaN. */
export function lerValor(texto: string): number {
  const limpo = texto.replace(/[^\d,.]/g, '');
  if (!limpo) return NaN;
  const normal = limpo.includes(',') ? limpo.replace(/\./g, '').replace(',', '.') : limpo;
  return arredondar(Number(normal));
}

export const escreverValor = (valor: number) => valor.toFixed(2).replace('.', ',');

/**
 * `produtos` sem desconto, `frete` e `taxaPix` (fração de desconto no Pix do carrinho). `noCartao` é o que o cliente
 * digitou para o cartão. `regra` é a do site (parcelas e mínimo por parte); sem ela, vale o padrão.
 */
export function dividir(noCartao: number, produtos: number, frete: number, taxaPix: number, regra: RegraDivisao = PARCELAMENTO_PADRAO): Divisao {
  const minimo = regra.minimoPorParte && regra.minimoPorParte > 0 ? regra.minimoPorParte : MINIMO_POR_PARTE;
  const bruto = arredondar(produtos + frete);
  const cartao = Number.isFinite(noCartao) ? Math.max(noCartao, 0) : 0;
  const resto = arredondar(bruto - cartao);
  const descontoPix = bruto > 0 && resto > 0 ? arredondar(produtos * taxaPix * (resto / bruto)) : 0;
  const pix = Math.max(arredondar(resto - descontoPix), 0);
  let erro: string | undefined;
  if (bruto < minimo * 2) erro = `Para dividir, o pedido precisa ser de pelo menos R$ ${minimo * 2}.`;
  else if (!Number.isFinite(noCartao) || cartao < minimo) erro = `No cartão vai pelo menos R$ ${minimo}.`;
  else if (resto < minimo) erro = `Sobram só R$ ${escreverValor(Math.max(resto, 0))} para o Pix; o mínimo é R$ ${minimo}. Diminua o valor do cartão.`;
  return { cartao, pix, descontoPix, total: arredondar(bruto - descontoPix), maxParcelas: calcularParcelas(cartao, regra).quantidade, erro };
}

/** Para começar: metade no cartão (arredondada para baixo em reais). */
export const sugerirCartao = (produtos: number, frete: number) => Math.floor((produtos + frete) / 2);
