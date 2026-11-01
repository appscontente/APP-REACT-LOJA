// Desconto do autoatendimento (Happy) nos carrinhos da loja: a tabela de /api/app/lojas/{loja}/descontos traz, por item
// e por forma de pagamento, o % pagando no caixa (`caixa`) e o % pagando pelo app ou pelo site (`site`). Quem decide o
// valor final é o servidor, no pedido; aqui é só o que a tela mostra.

import type { DescontoFigital, PagamentoFigital } from './tipos';

export type ColunaDesconto = 'site' | 'caixa';

/** Soma do desconto do carrinho numa forma de pagamento, em reais (centavos arredondados por item, como no site). */
export function descontoAutoatendimento(
  itens: { codprod: string; preco: number; quantidade: number; conjunto?: unknown }[],
  tabela: DescontoFigital[],
  pagamento: PagamentoFigital,
  coluna: ColunaDesconto,
) {
  const centavos = itens.reduce((s, i) => {
    // Conjunto já tem desconto próprio: o Happy responde motivo "conjunto" e zero, mas a linha do app usa a chave da
    // configuração (KIT-...~...), que não está na tabela; fica sem desconto de qualquer jeito.
    const pct = i.conjunto ? 0 : (tabela.find((d) => d.codprod === i.codprod)?.descontos[pagamento]?.[coluna] ?? 0);
    return s + Math.round(i.preco * i.quantidade * pct);
  }, 0);
  return centavos / 100;
}

/**
 * Forma de pagamento da tabela do Happy a partir da escolha do checkout: Pix é "pix"; cartão de crédito é o número de
 * parcelas (1 a 10). Acima de 10 parcelas a tabela não tem coluna: sem desconto.
 */
export function pagamentoFigitalDe(forma: 'pix' | 'cartao', parcelas = 1): PagamentoFigital | undefined {
  if (forma === 'pix') return 'pix';
  return parcelas >= 1 && parcelas <= 10 ? (String(parcelas) as PagamentoFigital) : undefined;
}

/** Maior % da tabela para um item (para dizer "até X% conforme o pagamento"). */
export const maiorDesconto = (tabela: DescontoFigital | undefined, coluna: ColunaDesconto) =>
  tabela ? Math.max(0, ...Object.values(tabela.descontos).map((d) => d[coluna])) : 0;
