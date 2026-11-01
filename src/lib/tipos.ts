// Tipos que o app recebe do site (/api/app/*, loja/src/lib/app-api.ts). Espelham loja/src/lib/tipos.ts e o contrato da
// API (docs/CONTRATO-API.md); quando o backend completo existir, os formatos continuam os mesmos.

export type Categoria = { slug: string; nome: string };
export type Departamento = { slug: string; nome: string; descricao?: string; categorias: Categoria[]; ilustracao?: string };

export type CorSelo = 'marca' | 'sorriso' | 'escuro' | 'verde';
export type SeloProduto = { texto: string; cor: CorSelo | string };

export type Imagem = { src: string; alt: string; recorte?: string };
export type Especificacao = { nome: string; valor: string };
export type Medidas = { altura?: number; largura?: number; profundidade?: number; peso?: number };

/** O que o card da vitrine mostra. */
export type CardProduto = {
  codprod: string;
  slug: string;
  nome: string;
  marca: string;
  departamento: string;
  categoria: string;
  preco: number;
  precoDe?: number;
  descontoPix?: number;
  estoque: number;
  sujeitoConfirmacao?: boolean;
  imagem?: string;
  selos?: SeloProduto[];
  tipo?: 'conjunto';
  descontoConjunto?: number;
};

export type Produto = Omit<CardProduto, 'imagem'> & {
  imagens: Imagem[];
  descricao?: string;
  especificacoes: Especificacao[];
  medidas?: Medidas;
  medidasProduto?: Medidas;
  videoYoutube?: string;
  lojasExposicao?: string[];
  vendeIndividualmente?: boolean;
};

export type Pagamento = {
  maxParcelas: number;
  parcelaMinima: number;
  maiorPercentualPix?: number;
  /** Mínimo de cada forma no pagamento em mais de uma forma (Parâmetros do admin). */
  minimoPorParte?: number;
};

export type BannerArte = { id: string; nome: string; imagem?: string; alt: string; link: string };

export type BannerAutomatico = {
  id: string;
  modelo: 'oferta' | 'destaque';
  produto: Pick<CardProduto, 'codprod' | 'slug' | 'nome' | 'marca' | 'preco' | 'precoDe'>;
  imagem?: string;
  recortada: boolean;
  desconto: number;
};

export type Inicio = {
  banners: BannerArte[];
  faixas: BannerArte[];
  automaticos: { carrossel: BannerAutomatico[]; fixos: BannerAutomatico[] };
  departamentos: Departamento[];
  achados: CardProduto[];
  vitrines: { slug: string; nome: string; produtos: CardProduto[] }[];
  pagamento: Pagamento;
};

export type ResultadoBusca = { termo?: string; produtos: CardProduto[]; corrigido?: string; redirecionar?: string };

export type LojaFisica = {
  slug: string;
  nome: string;
  codigoEmpresa: number;
  endereco: string;
  horario?: string;
  whatsapp: string;
  descontoAutoatendimento: number;
  horasReserva: number;
};

/** De onde sai a mercadoria na Figital: CD (empresa 7), a própria loja ou outra loja. */
export type OrigemSaida = 'cd' | 'loja' | 'outra-loja';

/**
 * Solução de compra na loja (o cliente não vê quantidades). `disponivel` é só o limite do carrinho. Com `aviso`, a loja
 * tem uma peça só, que pode ser a de mostruário: o cliente aceita ou escolhe a `alternativa` (CD ou outra loja).
 */
export type OrigemEstoque = {
  origem?: OrigemSaida;
  disponivel: number;
  aviso?: 'peca-unica';
  alternativa?: { origem: Exclude<OrigemSaida, 'loja'>; disponivel: number };
};

/** Desconto do autoatendimento (Happy), por item e por forma de pagamento: pix, debito e crédito de 1 a 10x. */
export const PAGAMENTOS_FIGITAL = ['pix', 'debito', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'] as const;
export type PagamentoFigital = (typeof PAGAMENTOS_FIGITAL)[number];
export type DescontoFigital = {
  codprod: string;
  linha: 'moveis' | 'eletro';
  motivo: 'promocao' | 'conjunto' | 'sem_custo' | null;
  /** `site` = % pagando pelo app/site; `caixa` = % finalizando no caixa. */
  descontos: Record<PagamentoFigital, { site: number; caixa: number }>;
};

export type ProdutoFigital = {
  produto: Produto;
  /** O site pode deixar de mandar as quantidades (o app só mostra a solução de compra, nunca o número). */
  estoqueCD?: number;
  estoqueLoja?: number;
  publicadoNoSite: boolean;
  entregavel: boolean;
  origem: OrigemEstoque;
  /** Conjunto publicado no site, visto pela loja: o estoque de cada peça já é o disponível para a loja. */
  conjunto?: ConjuntoCompleto;
};

export type Exposto = CardProduto & { estoqueCD?: number; estoqueLoja?: number };

// Conjuntos (cozinha modulada, cama box, mesa + cadeiras) ---------------------------------------------------------
// Espelho de loja/src/lib/tipos.ts (seção "Conjuntos"). O app monta o conjunto na própria tela com as regras de
// src/lib/conjuntos.ts; o servidor recalcula tudo no pedido.

/** Uma posição do conjunto (ex.: "Cadeiras"), com as opções aceitas e a faixa de quantidade. */
export type SlotConjunto = {
  id: string;
  nome: string;
  /** CODPRODs aceitos nesta posição. O cliente escolhe um. */
  opcoes: string[];
  quantidadeMin: number;
  quantidadeMax: number;
};

export type EscolhaConjunto = { slot: string; codprod: string; quantidade: number };

/** Combinação pronta (ex.: "Mesa + 4 cadeiras"). A primeira é a padrão da vitrine. */
export type PresetConjunto = { id: string; nome: string; escolhas: EscolhaConjunto[] };

/** O que o configurador precisa saber de cada peça do conjunto. */
export type ComponenteConjunto = Pick<Produto, 'codprod' | 'nome' | 'marca' | 'slug' | 'preco' | 'estoque' | 'medidas'> & {
  imagem?: string;
  /** Tem página própria no site (publicado e vende sozinho). */
  temPagina: boolean;
  /** Só na loja (Figital): `estoque` é o disponível para a loja e daqui sai a peça. */
  origemEstoque?: OrigemSaida;
  /** Peça única na loja, sem outra saída: o conjunto leva a peça de mostruário. */
  aviso?: 'peca-unica';
};

export type ConjuntoCompleto = {
  /** ID próprio em todos os canais (GA4, Google, Meta): KIT-0001. */
  id: string;
  /** Slug próprio e permanente, no mesmo espaço dos produtos (/{slug}/p). */
  slug: string;
  nome: string;
  departamento: string;
  categoria: string;
  descricao?: string;
  imagens: Imagem[];
  /** Desconto do conjunto (fração, ex.: 0.08), rateado entre as peças. */
  desconto: number;
  slots: SlotConjunto[];
  presets: PresetConjunto[];
  situacao: 'rascunho' | 'publicado' | 'despublicado' | 'encerrado';
  componentes: Record<string, ComponenteConjunto>;
};

/** Resposta de GET /api/app/conjuntos/{slugOuId} e de GET /api/app/produtos/{slug} quando o slug é de conjunto. */
export type ConjuntoApp = {
  conjunto: ConjuntoCompleto;
  pagamento: Pagamento;
  /** Fração do desconto no Pix do conjunto (regra do admin), como na página do site. */
  taxaPix?: number;
};

// Promoções e cupom (POST /api/app/carrinho/calcular, contrato seção 10) ---------------------------------------------

export type FormaPagamentoPromo = 'cartao' | 'pix';

/** O que o app manda para o cálculo. O preço nunca vai: o servidor usa o dele. */
export type ItemCalculo = {
  codprod: string;
  quantidade: number;
  /** Linha de conjunto: `codprod` é a chave da configuração (KIT-0001~...). */
  conjunto?: { id: string; escolhas: EscolhaConjunto[] };
};

export type ContextoCalculo = {
  cupom?: string;
  formaPagamento?: FormaPagamentoPromo;
  parcelas?: number;
  /** Só dígitos. */
  cep?: string;
  /** E-mail do cliente logado, para promoções de audiência. */
  cliente?: string;
};

/** Resultado do cálculo, igual ao do site (loja/src/lib/promocoes/tipos.ts). */
export type ResultadoCalculo = {
  /** desconto = promoções do item + rateio das promoções do pedido. */
  itens: { codprod: string; quantidade: number; bruto: number; desconto: number; total: number; promocoes: string[] }[];
  brindes: { codprod: string; nome: string; quantidade: number; promocao: string }[];
  /** Soma dos itens pelo preço de tabela. */
  subtotal: number;
  descontoItens: number;
  descontoPedido: number;
  /** Desconto sobre o frete: percentual (100 = grátis) ou valor, aplicado depois da cotação. */
  descontoFrete?: { modo: 'percentual' | 'valor'; valor: number; promocao: string };
  /** Produtos depois das promoções, antes do frete e do desconto da forma de pagamento. */
  totalProdutos: number;
  /** Desconto do Pix sobre `totalProdutos` inteiro e a fração média (descontoPix ÷ totalProdutos). */
  descontoPix?: number;
  taxaPix?: number;
  aplicadas: { id: string; nome: string; valor: number }[];
  cupom?: { codigo: string; valido: boolean; mensagem: string; afiliado?: string };
};

// Orçamento do vendedor (GET /api/app/orcamentos/{token}) ----------------------------------------------------------

export type ItemOrcamento = {
  codprod: string;
  nome: string;
  slug?: string;
  imagem?: string;
  quantidade: number;
  /** Preço unitário; numa peça de conjunto, já rateado. */
  preco: number;
  /** Peça vendida dentro de um conjunto: `chave`, `slot` e `quantidadeConjuntos` remontam a configuração. */
  conjunto?: { id: string; nome: string; chave?: string; slot?: string; quantidadeConjuntos?: number };
  origemEstoque?: OrigemSaida;
};

/** O que a página pública mostra: só o primeiro nome do cliente e do vendedor, nunca CPF, WhatsApp ou e-mail. */
export type OrcamentoPublico = {
  token: string;
  loja: string;
  vendedor: { primeiroNome: string };
  cliente: { primeiroNome: string };
  itens: ItemOrcamento[];
  /** Percentual combinado com o vendedor (0 a 1). Vale para pagar na loja. */
  desconto: number;
  totais: { produtos: number; descontos: number; total: number };
  criadoEm: string;
  validoAte: string;
  /** Preenchido quando o orçamento virou pedido (no caixa ou pelo site). */
  pedido?: string;
};

export type OrcamentoApp = {
  orcamento: OrcamentoPublico;
  loja?: { slug: string; nome: string; whatsapp?: string };
  vencido: boolean;
};

// Acompanhar entrega sem login (POST /api/app/rastreio, contrato seção 33) ------------------------------------------

export type CanalPedido = 'site' | 'figital' | 'loja';

/** Etapas na ordem em que acontecem. "cancelado" encerra em qualquer ponto. */
export type EtapaPedido =
  | 'recebido'
  | 'separacao_conferida'
  | 'pagamento_aprovado'
  | 'faturado'
  | 'em_separacao'
  | 'saiu_para_entrega'
  | 'entregue'
  | 'montagem_agendada'
  | 'montado'
  | 'retirado'
  | 'cancelado';

export type EventoPedido = { etapa: EtapaPedido; quando: string; detalhe?: string };

/** Só o andamento: sem endereço completo, valores, pagamento ou notas. */
export type PedidoRastreio = {
  numero: string;
  canal: CanalPedido;
  criadoEm: string;
  situacao: EtapaPedido;
  linhaDoTempo: EventoPedido[];
  primeiroNome: string;
  entrega?: { modalidade: 'entrega' | 'retirada'; cidade?: string; previsao?: string; agendamento?: { dia: string; turno: 'manha' | 'tarde' } };
  montagem?: { incluida: boolean; agendadaPara?: string };
  /** Link de rastreio da transportadora, quando houver. */
  acompanhamento?: string;
  aCaminho?: { tipo: 'entrega' | 'montagem'; chegadaPrevista: string; paradasAntes?: number; atualizadoEm: string };
  itens: { nome: string; quantidade: number; imagem?: string }[];
};

/** Linha do tempo pronta para a tela (calculada no site com lib/pedidos.ts). */
export type PassoPedido = { etapa: EtapaPedido; feito: boolean; atual: boolean; quando?: string; detalhe?: string };

export type RastreioApp = { pedido: PedidoRastreio; passos: PassoPedido[]; tom: 'ok' | 'erro' | 'andamento' };
