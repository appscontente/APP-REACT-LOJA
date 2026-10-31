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

/** CPF com os dois dígitos verificadores certos (como o cpfValido do site). Aceita com ou sem pontuação. */
export function cpfValido(cpf: string) {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false;
  const digito = (n: number) => {
    let soma = 0;
    for (let i = 0; i < n; i++) soma += Number(d[i]) * (n + 1 - i);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  return digito(9) === Number(d[9]) && digito(10) === Number(d[10]);
}

/** Nome e sobrenome (pelo menos duas palavras com 2 letras ou mais), como o checkout do site pede. */
export const nomeCompleto = (nome: string) => nome.trim().split(/\s+/).filter((p) => p.length >= 2).length >= 2;

/** CPF com a máscara 000.000.000-00 enquanto o cliente digita (guarde só os dígitos). */
export const formatarCpf = (cpf: string) => {
  const d = cpf.replace(/\D/g, '').slice(0, 11);
  if (d.length > 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length > 6) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  if (d.length > 3) return `${d.slice(0, 3)}.${d.slice(3)}`;
  return d;
};

/** Celular com DDD como (91) 99999-9999, ou (91) 3333-4444 para fixo (guarde só os dígitos). */
export const formatarCelular = (celular: string) => {
  const d = celular.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 2) return d;
  const corte = d.length === 11 ? 7 : 6;
  return d.length > corte ? `(${d.slice(0, 2)}) ${d.slice(2, corte)}-${d.slice(corte)}` : `(${d.slice(0, 2)}) ${d.slice(2)}`;
};

/** Telefone com DDD: 10 dígitos (fixo) ou 11 (celular, começando com 9 depois do DDD). */
export function celularValido(celular: string) {
  const d = celular.replace(/\D/g, '');
  if (d.length === 11) return d[2] === '9';
  return d.length === 10;
}
