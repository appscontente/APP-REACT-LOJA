// Regras dos conjuntos (cozinha modulada, cama box, mesa + cadeiras), as mesmas do site (loja/src/lib/conjuntos.ts) e
// do backend, que recalcula tudo e recusa com "preco_alterado" se não bater.
//
// - O cliente escolhe uma opção por slot e a quantidade dentro da faixa do slot (0 = slot opcional não levado).
// - Preço = soma das peças escolhidas com o desconto do conjunto aplicado em cada uma (mesmo percentual em todas,
//   arredondado no preço unitário). Assim o rateio é exato: o total é sempre a soma das linhas que descem no pedido.
// - Estoque do conjunto = quantos conjuntos completos o estoque disponível monta.

import type { ItemCarrinho } from '@/estado/carrinho';
import { arredondar } from './formatar';
import type { ConjuntoCompleto, EscolhaConjunto, ItemCalculo, OrigemSaida } from './tipos';

export type LinhaConjunto = {
  slot: string;
  codprod: string;
  nome: string;
  quantidade: number;
  /** Preço unitário da peça sozinha. */
  precoUnitario: number;
  /** Preço unitário com o desconto do conjunto (o que desce no pedido). */
  precoRateado: number;
};

export type CalculoConjunto = {
  linhas: LinhaConjunto[];
  /** Soma das peças compradas separadas. */
  cheio: number;
  total: number;
  economia: number;
  /** Quantos conjuntos iguais a este o estoque permite. */
  estoque: number;
  erros: string[];
};

export function calcularConjunto(c: ConjuntoCompleto, escolhas: EscolhaConjunto[]): CalculoConjunto {
  const erros: string[] = [];
  const linhas: LinhaConjunto[] = [];
  for (const slot of c.slots) {
    const doSlot = escolhas.filter((e) => e.slot === slot.id && e.quantidade > 0);
    const quantidade = doSlot.reduce((s, e) => s + e.quantidade, 0);
    if (doSlot.length > 1) erros.push(`Escolha só uma opção em "${slot.nome}".`);
    if (quantidade < slot.quantidadeMin)
      erros.push(slot.quantidadeMin === 1 ? `Escolha ${slot.nome.toLowerCase()}.` : `${slot.nome}: mínimo ${slot.quantidadeMin}.`);
    if (quantidade > slot.quantidadeMax) erros.push(`${slot.nome}: máximo ${slot.quantidadeMax}.`);
    for (const e of doSlot) {
      const produto = c.componentes[e.codprod];
      if (!slot.opcoes.includes(e.codprod) || !produto) {
        erros.push(`Opção indisponível em "${slot.nome}".`);
        continue;
      }
      linhas.push({
        slot: slot.id,
        codprod: e.codprod,
        nome: produto.nome,
        quantidade: e.quantidade,
        precoUnitario: produto.preco,
        precoRateado: arredondar(produto.preco * (1 - c.desconto)),
      });
    }
  }
  if (escolhas.some((e) => !c.slots.some((s) => s.id === e.slot))) erros.push('Escolha fora do conjunto.');
  if (!linhas.length) erros.push('Monte o conjunto escolhendo pelo menos um item.');

  // A mesma peça pode aparecer em mais de um slot: o estoque conta o total pedido de cada uma.
  const porSku = new Map<string, number>();
  for (const l of linhas) porSku.set(l.codprod, (porSku.get(l.codprod) ?? 0) + l.quantidade);
  const estoque = linhas.length ? Math.min(...[...porSku].map(([codprod, q]) => Math.floor((c.componentes[codprod]?.estoque ?? 0) / q))) : 0;

  const cheio = arredondar(linhas.reduce((s, l) => s + l.precoUnitario * l.quantidade, 0));
  const total = arredondar(linhas.reduce((s, l) => s + l.precoRateado * l.quantidade, 0));
  return { linhas, cheio, total, economia: arredondar(cheio - total), estoque, erros };
}

/** Escolhas de uma combinação pronta (a primeira é a padrão); sem presets, a primeira opção de cada slot no mínimo. */
export const escolhasDoPreset = (c: ConjuntoCompleto, presetId?: string): EscolhaConjunto[] =>
  (c.presets.find((p) => p.id === presetId) ?? c.presets[0])?.escolhas.map((e) => ({ ...e })) ??
  c.slots.map((s) => ({ slot: s.id, codprod: s.opcoes[0], quantidade: s.quantidadeMin }));

const chaveEscolhas = (lista: EscolhaConjunto[]) =>
  [...lista.filter((e) => e.quantidade > 0).map((e) => `${e.slot}:${e.codprod}:${e.quantidade}`)].sort().join('|');

/** Combinação pronta que bate exatamente com as escolhas (para destacar o botão), se houver. */
export function presetDasEscolhas(c: ConjuntoCompleto, escolhas: EscolhaConjunto[]) {
  const alvo = chaveEscolhas(escolhas);
  return c.presets.find((p) => chaveEscolhas(p.escolhas) === alvo);
}

/**
 * Cada configuração do conjunto é uma linha própria no carrinho: KIT-0001~a1b2c3. O que vem antes do "~" é o ID do
 * conjunto (GA4, Google, Meta); o resto só separa configurações diferentes do mesmo conjunto. Mesmo cálculo do site.
 */
export function chaveCarrinhoConjunto(id: string, escolhas: EscolhaConjunto[]) {
  const texto = chaveEscolhas(escolhas);
  let hash = 5381;
  for (let i = 0; i < texto.length; i++) hash = (hash * 33) ^ texto.charCodeAt(i);
  return `${id}~${(hash >>> 0).toString(36)}`;
}

/** "KIT-0001~a1b2c3" → "KIT-0001"; CODPROD comum fica igual. */
export const idAnalytics = (codprod: string) => codprod.split('~')[0];

export const ehConjunto = (codprod: string) => codprod.startsWith('KIT-');

/** Fotos do conjunto; sem foto própria, as fotos das peças da combinação padrão. */
export function fotosDoConjunto(c: ConjuntoCompleto) {
  if (c.imagens.length) return c.imagens;
  return escolhasDoPreset(c).flatMap((e) => {
    const p = c.componentes[e.codprod];
    return p?.imagem ? [{ src: p.imagem, alt: p.nome }] : [];
  });
}

/** Peças da linha do conjunto no carrinho, com o preço rateado de cada uma (o que desce no pedido). */
export type PecaConjuntoCarrinho = {
  slot: string;
  codprod: string;
  nome: string;
  quantidade: number;
  preco: number;
  origemEstoque?: OrigemSaida;
};

/** Linha do carrinho para uma configuração do conjunto, com preço e estoque de agora. Undefined se não serve mais. */
export function itemCarrinhoDoConjunto(c: ConjuntoCompleto, escolhas: EscolhaConjunto[]): Omit<ItemCarrinho, 'quantidade'> | undefined {
  const calculo = calcularConjunto(c, escolhas);
  if (calculo.erros.length || calculo.estoque < 1) return undefined;
  const pecas = calculo.linhas.map((l) => c.componentes[l.codprod]);
  // Na loja (Figital) a saída do conjunto é a das peças: se alguma sai da própria loja, a linha mostra "sai da loja".
  const origens = pecas.map((p) => p?.origemEstoque).filter((o): o is OrigemSaida => Boolean(o));
  const origemEstoque = origens.includes('loja') ? 'loja' : origens.includes('outra-loja') ? 'outra-loja' : origens[0];
  return {
    codprod: chaveCarrinhoConjunto(c.id, escolhas),
    slug: c.slug,
    nome: c.nome,
    marca: 'Casa Contente',
    preco: calculo.total,
    precoDe: calculo.economia > 0 ? calculo.cheio : undefined,
    imagem: fotosDoConjunto(c)[0]?.src,
    estoque: calculo.estoque,
    ...(origemEstoque && { origemEstoque }),
    ...(pecas.some((p) => p?.aviso === 'peca-unica') && { mostruario: true }),
    conjunto: {
      id: c.id,
      escolhas: calculo.linhas.map((l) => ({
        slot: l.slot,
        codprod: l.codprod,
        nome: l.nome,
        quantidade: l.quantidade,
        preco: l.precoRateado,
        ...(c.componentes[l.codprod]?.origemEstoque && { origemEstoque: c.componentes[l.codprod].origemEstoque }),
      })),
    },
  };
}

/** Itens do carrinho no formato do cálculo de promoções (POST /api/app/carrinho/calcular): sem preço, só o que identifica. */
export const itensParaCalculo = (itens: ItemCarrinho[]): ItemCalculo[] =>
  itens.map((i) => ({
    codprod: i.codprod,
    quantidade: i.quantidade,
    ...(i.conjunto && {
      conjunto: { id: i.conjunto.id, escolhas: i.conjunto.escolhas.map(({ slot, codprod, quantidade }) => ({ slot, codprod, quantidade })) },
    }),
  }));

/** Nome das peças para mostrar embaixo da linha do conjunto: "1 mesa, 4 cadeiras". */
export const resumoPecas = (escolhas: { nome: string; quantidade: number }[]) =>
  escolhas.map((e) => `${e.quantidade} × ${e.nome}`).join(' · ');
