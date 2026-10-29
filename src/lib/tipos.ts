// Tipos que o app recebe do site (/api/app/*, loja/src/lib/app-api.ts). Espelham loja/src/lib/tipos.ts e o contrato da
// API (docs/CONTRATO-API.md); quando o backend completo existir, os formatos continuam os mesmos.

export type Categoria = { slug: string; nome: string };
export type Departamento = { slug: string; nome: string; descricao?: string; categorias: Categoria[] };

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

export type Pagamento = { maxParcelas: number; parcelaMinima: number; maiorPercentualPix?: number };

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

export type OrigemEstoque = {
  origem?: 'cd' | 'loja';
  disponivel: number;
  aviso?: 'estoque-loja' | 'ultima-peca';
};

export type ProdutoFigital = {
  produto: Produto;
  estoqueCD: number;
  estoqueLoja: number;
  publicadoNoSite: boolean;
  entregavel: boolean;
  origem: OrigemEstoque;
};

export type Exposto = CardProduto & { estoqueCD: number; estoqueLoja: number };
