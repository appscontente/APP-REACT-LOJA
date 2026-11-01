// O app lê o site (EXPO_PUBLIC_SITE_URL), que entrega em JSON o que as páginas montam (loja/src/app/api/app). O site,
// por sua vez, lê o backend FastAPI; o app nunca fala com o Sankhya. Toda chamada leva X-Canal: app, para separar as
// vendas do app nos relatórios.

import type {
  CardProduto,
  ConjuntoApp,
  ContextoCalculo,
  DescontoFigital,
  Departamento,
  Exposto,
  Inicio,
  ItemCalculo,
  LojaFisica,
  OrcamentoApp,
  Pagamento,
  Produto,
  ProdutoFigital,
  RastreioApp,
  ResultadoBusca,
  ResultadoCalculo,
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

/** Tempo máximo de uma chamada ao site. No Android o fetch não tem limite: sem isto, conexão travada gira para sempre. */
const TEMPO_LIMITE = 15_000;

/** fetch com tempo limite; tempo esgotado rejeita como falha de rede (vira ErroApi com status 0, "sem conexão"). */
async function buscarComLimite(url: string, opcoes: RequestInit = {}, ms = TEMPO_LIMITE): Promise<Response> {
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), ms);
  try {
    return await fetch(url, { ...opcoes, signal: controle.signal });
  } finally {
    clearTimeout(relogio);
  }
}

async function obter<T>(caminho: string, params?: Record<string, string | undefined>): Promise<T> {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params ?? {})) if (valor) busca.set(chave, valor);
  const url = `${SITE_URL}${caminho}${busca.size ? `?${busca}` : ''}`;
  let resposta: Response;
  try {
    resposta = await buscarComLimite(url, { headers: { Accept: 'application/json', 'X-Canal': 'app' } });
  } catch {
    throw new ErroApi(0, 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (!resposta.ok) {
    const corpo = (await resposta.json().catch(() => undefined)) as { codigo?: string; mensagem?: string } | undefined;
    throw new ErroApi(resposta.status, corpo?.mensagem ?? 'Não conseguimos carregar agora. Tente de novo.', corpo?.codigo);
  }
  return resposta.json() as Promise<T>;
}

/** POST em JSON ao site, com o mesmo tratamento de erro do `obter` (ErroApi com o código e a mensagem do site). */
async function enviar<T>(caminho: string, corpo: unknown): Promise<T> {
  let resposta: Response;
  try {
    resposta = await buscarComLimite(`${SITE_URL}${caminho}`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', 'X-Canal': 'app' },
      body: JSON.stringify(corpo),
    });
  } catch {
    throw new ErroApi(0, 'Sem conexão. Confira a internet e tente de novo.');
  }
  if (!resposta.ok) {
    const erro = (await resposta.json().catch(() => undefined)) as { codigo?: string; mensagem?: string } | undefined;
    throw new ErroApi(resposta.status, erro?.mensagem ?? 'Não conseguimos carregar agora. Tente de novo.', erro?.codigo);
  }
  return resposta.json() as Promise<T>;
}

export const api = {
  inicio: () => obter<Inicio>('/api/app/inicio'),
  departamentos: () => obter<Departamento[]>('/api/app/departamentos'),
  produtos: (filtro: {
    departamento?: string;
    categoria?: string;
    /** Vitrine do início (/colecao/{slug}); lista vazia se ela não estiver no ar. */
    colecao?: string;
    ordenacao?: string;
    oferta?: boolean;
    codprods?: string[];
  }) =>
    obter<CardProduto[]>('/api/app/produtos', {
      departamento: filtro.departamento,
      categoria: filtro.categoria,
      colecao: filtro.colecao,
      ordenacao: filtro.ordenacao,
      oferta: filtro.oferta ? '1' : undefined,
      codprod: filtro.codprods?.join(','),
    }),
  produto: (slug: string) =>
    obter<
      | { produto: Produto; combinaCom: CardProduto[]; pagamento: Pagamento; redirecionar?: undefined; conjunto?: undefined }
      // Slug de conjunto (cozinha, cama box, mesa + cadeiras): o app monta o conjunto na própria tela.
      | (ConjuntoApp & { produto?: undefined; combinaCom?: undefined; redirecionar?: undefined })
      // Endereço antigo ou renomeado: o site manda o caminho novo (como o 301 da página).
      | { redirecionar: string; produto?: undefined; combinaCom?: undefined; pagamento?: undefined; conjunto?: undefined }
    >(`/api/app/produtos/${encodeURIComponent(slug)}`),
  /** Conjunto pelo slug ou pelo ID (KIT-0001), com o estoque do site. */
  conjunto: (slugOuId: string) => obter<ConjuntoApp>(`/api/app/conjuntos/${encodeURIComponent(slugOuId)}`),
  /**
   * Promoções e cupom iguais ao site: o servidor recalcula o carrinho (preço dele, nunca o do app) e devolve os totais.
   * Chamado a cada mudança do carrinho do site e no checkout; o pedido real recalcula de novo.
   */
  calcularCarrinho: (itens: ItemCalculo[], contexto: ContextoCalculo = {}) =>
    enviar<ResultadoCalculo>('/api/app/carrinho/calcular', { itens, contexto }),
  /** Orçamento do vendedor pelo token do link; 404 quando não existe. */
  orcamento: (token: string) => obter<OrcamentoApp>(`/api/app/orcamentos/${encodeURIComponent(token)}`),
  /** Acompanhar entrega sem login: número do pedido + CPF ou e-mail da compra; 404 com mensagem genérica. */
  rastrear: (numero: string, documento: string) => enviar<RastreioApp>('/api/app/rastreio', { numero, documento }),
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
  | { atendido: true; cotacao: { faixa: string; valor: number; prazo: string }; endereco?: EnderecoCep }
  | { atendido: false; endereco?: EnderecoCep };

/** Endereço do CEP (ViaCEP pelo site). CEP geral de cidade vem sem rua e sem bairro: aí o cliente digita. */
export type EnderecoCep = { cidade: string; uf: string; bairro: string; logradouro?: string };

/** Frete pelo CEP (produto e checkout), pela regra do Sankhya. O valor final sai do servidor no pedido. */
export async function cotarFrete(cep: string, valorNota: number): Promise<CotacaoFrete> {
  const resposta = await buscarComLimite(`${SITE_URL}/api/app/frete`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Canal': 'app' },
    body: JSON.stringify({ cep: cep.replace(/\D/g, ''), valorNota }),
  }).catch(() => undefined);
  if (!resposta?.ok) throw new ErroApi(resposta?.status ?? 0, 'Não conseguimos calcular o frete agora. Tente de novo.');
  return resposta.json();
}

export type OpcaoRetirada = {
  loja: string;
  disponivel: boolean;
  diasUteis?: number;
  /** Texto pronto ("Pronto para retirar em até 2 dias úteis"). */
  prazo?: string;
  /** Por que não dá para retirar nesta loja. */
  motivo?: string;
  /** Usa peça de exposição: a loja confere o estado antes de confirmar o pedido. */
  exposicao: boolean;
  transferencia: boolean;
  sugerida: boolean;
  /** Motivos curtos ("Mais perto de você", "Fica pronta antes"). */
  destaques: string[];
};
export type ResultadoRetirada = { opcoes: OpcaoRetirada[]; sugerida?: string };

/** Em qual loja retirar e quando fica pronto, com a loja sugerida (CD da empresa 7 primeiro, como no site). */
export async function consultarRetirada(
  itens: { codprod: string; quantidade: number }[],
  { cep, preferida }: { cep?: string; preferida?: string } = {},
): Promise<ResultadoRetirada> {
  const resposta = await buscarComLimite(`${SITE_URL}/api/app/retirada`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Canal': 'app' },
    body: JSON.stringify({ itens, cep: cep?.replace(/\D/g, '') || undefined, preferida }),
  }).catch(() => undefined);
  if (!resposta?.ok) throw new ErroApi(resposta?.status ?? 0, 'Não conseguimos ver o prazo da retirada agora.');
  return resposta.json();
}
