// Modo loja (Figital): em qual loja física o cliente está. O botão fixo abre a loja guardada aqui; ler o QR de uma
// etiqueta ou da loja troca a loja. Sai sozinho depois de 4 horas, para o cliente não abrir o app em casa no modo loja.
// Também guarda a última lista de lojas (para abrir sem internet) e o comprovante do caixa de cada loja, até a reserva
// vencer.

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { api } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import type { LojaFisica, PagamentoFigital } from '@/lib/tipos';

const CHAVE = 'figital:v1';
const CHAVE_LOJAS = 'figital:lojas:v1';
const CHAVE_COMPROVANTES = 'figital:comprovantes:v1';
const VALIDADE_MS = 4 * 60 * 60 * 1000;

type Guardado = { loja: string; desde: number } | null;

/**
 * Comprovante do caixa: só o que o caixa precisa ver. Sem cartão e sem CPF. Com o backend, número, total, desconto e
 * validade passam a vir da resposta do POST do pedido da loja.
 */
export type ComprovanteLoja = {
  numero: string;
  expiraEm: string;
  total: number;
  /** Desconto do autoatendimento combinado para a forma de pagamento escolhida. */
  desconto: number;
  pagamento: PagamentoFigital;
  itens: { nome: string; quantidade: number }[];
};

const valido = (c: ComprovanteLoja | undefined) => (c && Date.parse(c.expiraEm) > Date.now() ? c : undefined);

/** Tira os comprovantes vencidos; devolve null quando nenhum saiu (quem chama não muda o estado à toa). */
function semVencidos(todos: Record<string, ComprovanteLoja>) {
  const vigentes = Object.fromEntries(Object.entries(todos).filter(([, c]) => valido(c)));
  return Object.keys(vigentes).length === Object.keys(todos).length ? null : vigentes;
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
  /** Comprovante do caixa da loja, só enquanto a reserva vale. */
  comprovante: (slug: string) => ComprovanteLoja | undefined;
  guardarComprovante: (slug: string, c: ComprovanteLoja) => void;
  descartarComprovante: (slug: string) => void;
};

const ContextoFigital = createContext<Contexto | null>(null);

export function ProvedorFigital({ children }: { children: ReactNode }) {
  const [lojas, setLojas] = useState<LojaFisica[]>([]);
  const [erroLojas, setErroLojas] = useState(false);
  const [guardado, setGuardado] = useState<Guardado>(null);
  const [comprovantes, setComprovantes] = useState<Record<string, ComprovanteLoja>>({});
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
    ler<Record<string, ComprovanteLoja>>(CHAVE_COMPROVANTES, {}).then((todos) => {
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
    const datas = Object.values(comprovantes).map((c) => Date.parse(c.expiraEm));
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

  const valor = useMemo<Contexto>(
    () => ({
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
      comprovante: (slug) => valido(comprovantes[slug]),
      guardarComprovante: (slug, c) => {
        const novos = { ...comprovantes, [slug]: c };
        setComprovantes(novos);
        gravar(CHAVE_COMPROVANTES, novos);
      },
      descartarComprovante: (slug) => {
        const novos = { ...comprovantes };
        delete novos[slug];
        setComprovantes(novos);
        gravar(CHAVE_COMPROVANTES, novos);
      },
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lojas, erroLojas, guardado, comprovantes],
  );

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
