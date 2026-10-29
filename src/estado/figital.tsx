// Modo loja (Figital): em qual loja física o cliente está. O botão fixo abre a loja guardada aqui; ler o QR de uma
// etiqueta ou da loja troca a loja. Sai sozinho depois de 4 horas, para o cliente não abrir o app em casa no modo loja.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { api } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import type { LojaFisica } from '@/lib/tipos';

const CHAVE = 'figital:v1';
const VALIDADE_MS = 4 * 60 * 60 * 1000;

type Guardado = { loja: string; desde: number } | null;

type Contexto = {
  lojas: LojaFisica[];
  lojaAtual?: LojaFisica;
  entrar: (slug: string) => void;
  sair: () => void;
  porEmpresa: (codigoEmpresa: number) => LojaFisica | undefined;
  carregarLojas: () => Promise<LojaFisica[]>;
};

const ContextoFigital = createContext<Contexto | null>(null);

export function ProvedorFigital({ children }: { children: ReactNode }) {
  const [lojas, setLojas] = useState<LojaFisica[]>([]);
  const [guardado, setGuardado] = useState<Guardado>(null);

  const carregarLojas = async () => {
    if (lojas.length) return lojas;
    const lista = await api.lojas().catch(() => [] as LojaFisica[]);
    setLojas(lista);
    return lista;
  };

  useEffect(() => {
    ler<Guardado>(CHAVE, null).then((g) => setGuardado(g && Date.now() - g.desde < VALIDADE_MS ? g : null));
    api
      .lojas()
      .then(setLojas)
      .catch(() => undefined);
  }, []);

  const valor = useMemo<Contexto>(
    () => ({
      lojas,
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
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lojas, guardado],
  );

  return <ContextoFigital.Provider value={valor}>{children}</ContextoFigital.Provider>;
}

export function useFigital() {
  const c = useContext(ContextoFigital);
  if (!c) throw new Error('useFigital fora do ProvedorFigital');
  return c;
}
