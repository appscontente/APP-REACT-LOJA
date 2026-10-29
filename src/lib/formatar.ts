// Preço, Pix e parcelas como o site mostra (loja/src/lib/formatar.ts). O servidor recalcula tudo no checkout.

const moeda = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const formatarPreco = (valor: number) => moeda.format(valor);

export const arredondar = (valor: number) => Math.round(valor * 100) / 100;

/** Desconto do Pix padrão (10%) quando o produto não traz o dele (regra de Marketing > Desconto no Pix). */
export const DESCONTO_PIX = 0.1;

export const precoPix = (preco: number, taxa = DESCONTO_PIX) => arredondar(preco * (1 - taxa));

export function percentualDesconto(preco: number, precoDe?: number) {
  if (!precoDe || precoDe <= preco) return 0;
  return Math.floor(((precoDe - preco) / precoDe) * 100);
}

export function descontoExibido(p: { preco: number; precoDe?: number; descontoConjunto?: number }) {
  if (p.descontoConjunto && p.precoDe && p.precoDe > p.preco) return Math.round(p.descontoConjunto * 100);
  return percentualDesconto(p.preco, p.precoDe);
}

export const PARCELAMENTO_PADRAO = { maxParcelas: 10, parcelaMinima: 100 };

export function calcularParcelas(preco: number, regra = PARCELAMENTO_PADRAO) {
  const quantidade = Math.max(1, Math.min(regra.maxParcelas, Math.floor(preco / regra.parcelaMinima)));
  return { quantidade, valor: arredondar(preco / quantidade) };
}

const MINUSCULAS = new Set(['a', 'o', 'e', 'de', 'da', 'do', 'das', 'dos', 'em', 'com', 'para', 'p/', 'c/', 's/']);
const SIGLAS = new Set(['MDF', 'MDP', 'PVC', 'TV', 'LED', 'LCD', 'UHD', 'HD', 'USB', 'HDMI', 'WIFI', 'LG', 'BT', 'PS']);

/** Nome do Sankhya em maiúsculas vira nome legível, como no site (loja/src/lib/nomes.ts). */
export function nomeLegivel(nome: string) {
  if (nome !== nome.toUpperCase()) return nome;
  return nome
    .split(/\s+/)
    .map((palavra, i) => {
      if (/\d/.test(palavra) || SIGLAS.has(palavra)) return palavra;
      const minuscula = palavra.toLowerCase();
      if (i > 0 && MINUSCULAS.has(minuscula)) return minuscula;
      return minuscula.replace(/(^|[/(-])(\p{L})/gu, (_, antes: string, letra: string) => antes + letra.toUpperCase());
    })
    .join(' ');
}

const dataHora = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Belem' });
export const formatarDataHora = (iso: string) => dataHora.format(new Date(iso));

const hora = new Intl.DateTimeFormat('pt-BR', { timeStyle: 'short', timeZone: 'America/Belem' });
export const formatarHora = (iso: string) => hora.format(new Date(iso));

export const formatarCep = (cep: string) => {
  const d = cep.replace(/\D/g, '').slice(0, 8);
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d;
};
