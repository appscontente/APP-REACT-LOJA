// Modo loja (Figital): em qual loja física o cliente está. O botão fixo abre a loja guardada aqui; ler o QR de uma
// etiqueta ou da loja troca a loja. Sai sozinho depois de 4 horas, para o cliente não abrir o app em casa no modo loja.
// Também guarda a última lista de lojas (para abrir sem internet) e os comprovantes do caixa de cada loja (pode haver
// mais de um por loja: cada compra separada gera o seu), até a reserva de cada um vencer.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';
import { apagar, gravar, ler } from '@/lib/armazenamento';
import type { LojaFisica, PagamentoFigital } from '@/lib/tipos';

const CHAVE = 'figital:v1';
const CHAVE_LOJAS = 'figital:lojas:v1';
/** v2: lista de comprovantes por loja. A v1 guardava um só por loja e é migrada na primeira abertura. */
const CHAVE_COMPROVANTES = 'figital:comprovantes:v2';
const CHAVE_COMPROVANTES_V1 = 'figital:comprovantes:v1';
const VALIDADE_MS = 4 * 60 * 60 * 1000;

type Guardado = { loja: string; desde: number } | null;

/**
 * Comprovante do caixa: só o que o caixa precisa ver. Sem cartão e sem CPF. Com o backend, número, total, desconto e
 * validade passam a vir da resposta do POST do pedido da loja.
 */
export type ComprovanteLoja = {
  numero: string;
  /** Quando foi gerado (ISO). Comprovantes antigos, de antes deste campo, não têm. */
  criadoEm?: string;
  expiraEm: string;
  total: number;
  /** Desconto do autoatendimento combinado para a forma de pagamento escolhida. */
  desconto: number;
  pagamento: PagamentoFigital;
  itens: { nome: string; quantidade: number }[];
};

/** Comprovantes por loja (slug), do mais recente para o mais antigo. */
type Comprovantes = Record<string, ComprovanteLoja[]>;

const valido = (c: ComprovanteLoja) => Date.parse(c.expiraEm) > Date.now();

/** Tira os comprovantes vencidos; devolve null quando nenhum saiu (quem chama não muda o estado à toa). */
function semVencidos(todos: Comprovantes): Comprovantes | null {
  let mudou = false;
  const vigentes: Comprovantes = {};
  for (const [slug, lista] of Object.entries(todos)) {
    const vivos = lista.filter(valido);
    if (vivos.length !== lista.length) mudou = true;
    if (vivos.length) vigentes[slug] = vivos;
    else mudou = true;
  }
  return mudou ? vigentes : null;
}

/** Lê os comprovantes guardados; a primeira vez depois da atualização converte o formato antigo (um por loja). */
async function lerComprovantes(): Promise<Comprovantes> {
  const v2 = await ler<Comprovantes | null>(CHAVE_COMPROVANTES, null);
  if (v2) return v2;
  const v1 = await ler<Record<string, ComprovanteLoja>>(CHAVE_COMPROVANTES_V1, {});
  const convertidos = Object.fromEntries(Object.entries(v1).map(([slug, c]) => [slug, [c]]));
  if (Object.keys(convertidos).length) await gravar(CHAVE_COMPROVANTES, convertidos);
  apagar([CHAVE_COMPROVANTES_V1]);
  return convertidos;
}

type Contexto = {
  lojas: LojaFisica[];
  /** A lista de lojas não veio (sem internet) e não há uma guardada no celular. */
  erroLojas: boolean;
  lojaAtual?: LojaFisica;
  entrar: (slug: string) => void;
  sair: () => void;
  porEmpresa: (codigoEmpresa: number) => LojaFisica | undefined;
  /** Busca a lista de lojas se ainda não tem. Rejeita quando a rede falha (quem chama mostra "Sem conexão"). */
  carregarLojas: () => Promise<LojaFisica[]>;
  /** Busca a lista no site mesmo já tendo uma (a guardada pode ser velha). Rejeita quando a rede falha. */
  atualizarLojas: () => Promise<LojaFisica[]>;
  /** Comprovante mais recente do caixa da loja, só enquanto a reserva vale. */
  comprovante: (slug: string) => ComprovanteLoja | undefined;
  /** Todos os comprovantes vigentes da loja, do mais recente para o mais antigo. */
  comprovantes: (slug: string) => ComprovanteLoja[];
  /** Comprovantes vigentes de todas as lojas (Meus pedidos), do mais recente para o mais antigo. */
  todosComprovantes: () => { loja: string; comprovante: ComprovanteLoja }[];
  guardarComprovante: (slug: string, c: ComprovanteLoja) => void;
  /** Tira um comprovante (pelo número) depois de pago; sem número, o mais recente. */
  descartarComprovante: (slug: string, numero?: string) => void;
};

const ContextoFigital = createContext<Contexto | null>(null);

export function ProvedorFigital({ children }: { children: ReactNode }) {
  const [lojas, setLojas] = useState<LojaFisica[]>([]);
  const [erroLojas, setErroLojas] = useState(false);
  const [guardado, setGuardado] = useState<Guardado>(null);
  const [comprovantes, setComprovantes] = useState<Comprovantes>({});
  // Uma busca só por vez, mesmo com várias telas pedindo a lista ao mesmo tempo.
  const buscando = useRef<Promise<LojaFisica[]> | null>(null);

  const buscarLojas = () => {
    if (!buscando.current) {
      setErroLojas(false);
      buscando.current = api
        .lojas()
        .then((lista) => {
          setLojas(lista);
          gravar(CHAVE_LOJAS, lista);
          return lista;
        })
        .catch((e: unknown) => {
          setErroLojas(true);
          throw e;
        })
        .finally(() => {
          buscando.current = null;
        });
    }
    return buscando.current;
  };

  const carregarLojas = async () => (lojas.length ? lojas : buscarLojas());

  useEffect(() => {
    ler<Guardado>(CHAVE, null).then((g) => {
      const vale = g && Date.now() - g.desde < VALIDADE_MS ? g : null;
      setGuardado(vale);
      // Vencido: apaga, para não ficar no celular a loja e a hora da visita.
      if (g && !vale) gravar(CHAVE, null);
    });
    lerComprovantes().then((todos) => {
      const vigentes = semVencidos(todos);
      setComprovantes(vigentes ?? todos);
      if (vigentes) gravar(CHAVE_COMPROVANTES, vigentes);
    });
    // A última lista guardada abre o modo loja na hora, mesmo sem internet; a da rede substitui quando chegar.
    ler<LojaFisica[]>(CHAVE_LOJAS, []).then((salvas) => {
      if (salvas.length) setLojas((atual) => (atual.length ? atual : salvas));
    });
    buscarLojas().catch(() => undefined);
  }, []);

  // Sem lista, ou só com a guardada porque a busca falhou (abertura sem internet): tenta de novo quando o cliente volta
  // ao app. O buscarLojas zera o erro no começo; o efeito só assina o AppState, então não entra em laço.
  useEffect(() => {
    if (lojas.length && !erroLojas) return;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') buscarLojas().catch(() => undefined);
    });
    return () => assinatura.remove();
  }, [lojas.length, erroLojas]);

  // O comprovante sai sozinho quando a reserva vence: com o app aberto (timer até o primeiro que vence) e ao voltar ao
  // app (o timer não corre em segundo plano). Só muda o estado se algum saiu, para não entrar em laço.
  useEffect(() => {
    const limpar = () => {
      const vigentes = semVencidos(comprovantes);
      if (!vigentes) return;
      setComprovantes(vigentes);
      gravar(CHAVE_COMPROVANTES, vigentes);
    };
    const datas = Object.values(comprovantes)
      .flat()
      .map((c) => Date.parse(c.expiraEm));
    // Meio segundo de folga: o timer pode disparar um pouco antes da hora e o comprovante ainda valeria.
    const timer = datas.length ? setTimeout(limpar, Math.max(0, Math.min(...datas) - Date.now()) + 500) : undefined;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') limpar();
    });
    return () => {
      clearTimeout(timer);
      assinatura.remove();
    };
  }, [comprovantes]);

  const valor = useMemo<Contexto>(() => {
    const vigentes = (slug: string) => (comprovantes[slug] ?? []).filter(valido);
    const trocar = (novos: Comprovantes) => {
      setComprovantes(novos);
      gravar(CHAVE_COMPROVANTES, novos);
    };
    return {
      lojas,
      erroLojas: erroLojas && !lojas.length,
      lojaAtual: guardado ? lojas.find((l) => l.slug === guardado.loja) : undefined,
      entrar: (slug) => {
        const g = { loja: slug, desde: Date.now() };
        setGuardado(g);
        gravar(CHAVE, g);
      },
      sair: () => {
        setGuardado(null);
        gravar(CHAVE, null);
      },
      porEmpresa: (codigoEmpresa) => lojas.find((l) => l.codigoEmpresa === codigoEmpresa),
      carregarLojas,
      atualizarLojas: buscarLojas,
      comprovante: (slug) => vigentes(slug)[0],
      comprovantes: vigentes,
      todosComprovantes: () =>
        Object.entries(comprovantes)
          .flatMap(([loja, lista]) => lista.filter(valido).map((comprovante) => ({ loja, comprovante })))
          .sort((a, b) => Date.parse(b.comprovante.criadoEm ?? b.comprovante.expiraEm) - Date.parse(a.comprovante.criadoEm ?? a.comprovante.expiraEm)),
      guardarComprovante: (slug, c) => trocar({ ...comprovantes, [slug]: [c, ...(comprovantes[slug] ?? [])] }),
      descartarComprovante: (slug, numero) => {
        const lista = vigentes(slug);
        const alvo = numero ?? lista[0]?.numero;
        const restantes = lista.filter((c) => c.numero !== alvo);
        const novos = { ...comprovantes };
        if (restantes.length) novos[slug] = restantes;
        else delete novos[slug];
        trocar(novos);
      },
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojas, erroLojas, guardado, comprovantes]);

  return <ContextoFigital.Provider value={valor}>{children}</ContextoFigital.Provider>;
}

export function useFigital() {
  const c = useContext(ContextoFigital);
  if (!c) throw new Error('useFigital fora do ProvedorFigital');
  return c;
}

/**
 * Para as telas da loja: garante a lista de lojas (busca de novo se ainda não veio) e diz se a busca falhou, para a
 * tela mostrar "Tentar de novo" em vez de ficar carregando para sempre.
 */
export function useLojas() {
  const figital = useFigital();
  const { lojas, carregarLojas } = figital;
  const tentar = () => {
    carregarLojas().catch(() => undefined);
  };
  useEffect(() => {
    if (!lojas.length) carregarLojas().catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lojas.length]);
  return { ...figital, tentarLojas: tentar };
}
