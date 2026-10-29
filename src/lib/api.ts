// O app lê o site (EXPO_PUBLIC_SITE_URL), que entrega em JSON o que as páginas montam (loja/src/app/api/app). O site,
// por sua vez, lê o backend FastAPI; o app nunca fala com o Sankhya. Toda chamada leva X-Canal: app, para separar as
// vendas do app nos relatórios.

import type {
  CardProduto,
  DescontoFigital,
  Departamento,
  Exposto,
  Inicio,
  LojaFisica,
  Pagamento,
  Produto,
  ProdutoFigital,
  ResultadoBusca,
} from './tipos';

export const SITE_URL = (process.env.EXPO_PUBLIC_SITE_URL ?? 'https://loja-casacontente.onrender.com').replace(/\/$/, '');

export class ErroApi extends Error {
  constructor(
    readonly status: number,
    mensagem: string,
    readonly codigo?: string,
  ) {
    super(mensagem);
  }
}

async function obter<T>(caminho: string, params?: Record<string, string | undefined>): Promise<T> {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) if (valor) busca.set(chave, valor);
  const url = `${SITE_URL}${caminho}${busca.size ? `?${busca}` : ''}`;
  let resposta: Response;
  try {
    resposta = await fetch(url, { headers: { Accept: 'application/json', 'X-Canal': 'app' } });
  } catch {
    throw new ErroApi(0, 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => undefined)) as { codigo?: string; mensagem?: string } | undefined;
    throw new ErroApi(resposta.status, corpo?.mensagem ?? 'Não conseguimos carregar agora. Tente de novo.', corpo?.codigo);
  }
  return resposta.json() as Promise<T>;
}

export const api = {
  inicio: () => obter<Inicio>('/api/app/inicio'),
  departamentos: () => obter<Departamento[]>('/api/app/departamentos'),
  produtos: (filtro: { departamento?: string; categoria?: string; ordenacao?: string; oferta?: boolean; codprods?: string[] }) =>
    obter<CardProduto[]>('/api/app/produtos', {
      departamento: filtro.departamento,
      categoria: filtro.categoria,
      ordenacao: filtro.ordenacao,
      oferta: filtro.oferta ? '1' : undefined,
      codprod: filtro.codprods?.join(','),
    }),
  produto: (slug: string) =>
    obter<{ produto: Produto; combinaCom: CardProduto[]; pagamento: Pagamento }>(`/api/app/produtos/${encodeURIComponent(slug)}`),
  busca: (termo: string, ordenacao?: string) => obter<ResultadoBusca>('/api/app/busca', { q: termo, ordenacao }),
  sugestoes: (termo: string) =>
    obter<{ produtos: { nome: string; href: string; preco: number; imagem?: string }[]; categorias: { nome: string; href: string }[] }>(
      '/api/busca/sugestoes',
      { q: termo },
    ),
  lojas: () => obter<LojaFisica[]>('/api/app/lojas'),
  produtoNaLoja: (loja: string, por: { slug?: string; codprod?: string }) =>
    obter<ProdutoFigital>(`/api/app/lojas/${encodeURIComponent(loja)}/produtos`, por),
  expostos: (loja: string) => obter<Exposto[]>(`/api/app/lojas/${encodeURIComponent(loja)}/expostos`),
  /** Desconto do autoatendimento (Happy) de cada item em cada forma de pagamento; sem resposta, sem desconto. */
  descontos: (loja: string, codprods: string[]) =>
    obter<{ itens: DescontoFigital[] }>(`/api/app/lojas/${encodeURIComponent(loja)}/descontos`, { itens: codprods.join(',') }),
};

/** Imagem do site com endereço completo (as rotas do app já mandam assim; isto cobre o "sem foto"). */
export const imagemSemFoto = `${SITE_URL}/img/sem-foto.svg`;

export type CotacaoFrete =
  | { atendido: true; cotacao: { faixa: string; valor: number; prazo: string }; endereco?: { cidade: string; uf: string; bairro: string } }
  | { atendido: false; endereco?: { cidade: string; uf: string; bairro: string } };

/** Frete pelo CEP (produto e checkout), pela regra do Sankhya. O valor final sai do servidor no pedido. */
export async function cotarFrete(cep: string, valorNota: number): Promise<CotacaoFrete> {
  const resposta = await fetch(`${SITE_URL}/api/app/frete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Canal': 'app' },
    body: JSON.stringify({ cep: cep.replace(/\D/g, ''), valorNota }),
  }).catch(() => undefined);
  if (!resposta?.ok) throw new ErroApi(resposta?.status ?? 0, 'Não conseguimos calcular o frete agora. Tente de novo.');
  return resposta.json();
}
