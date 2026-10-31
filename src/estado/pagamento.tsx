// Regra de parcelas que o site manda (campo `pagamento` de /api/app/inicio e de /api/app/produtos/{slug}). Cards,
// banners, página do produto e checkout usam a mesma regra, para o número de parcelas bater em todas as telas.
// Enquanto o site não respondeu, vale o padrão do site (PARCELAMENTO_PADRAO).

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

import { PARCELAMENTO_PADRAO } from '@/lib/formatar';
import type { Pagamento } from '@/lib/tipos';

type Contexto = { regra: Pagamento; definirRegra: (regra?: Pagamento) => void };

const ContextoPagamento = createContext<Contexto | null>(null);

export function ProvedorPagamento({ children }: { children: ReactNode }) {
  const [regra, setRegra] = useState<Pagamento>(PARCELAMENTO_PADRAO);
  const valor = useMemo<Contexto>(
    () => ({
      regra,
      definirRegra: (nova) => {
        if (!nova || !(nova.maxParcelas > 0) || !(nova.parcelaMinima > 0)) return;
        setRegra((antes) =>
          antes.maxParcelas === nova.maxParcelas &&
          antes.parcelaMinima === nova.parcelaMinima &&
          antes.maiorPercentualPix === nova.maiorPercentualPix &&
          antes.minimoPorParte === nova.minimoPorParte
            ? antes
            : nova,
        );
      },
    }),
    [regra],
  );
  return <ContextoPagamento.Provider value={valor}>{children}</ContextoPagamento.Provider>;
}

/** Regra de parcelas vigente: { maxParcelas, parcelaMinima }. Use com calcularParcelas(valor, regra). */
export function useRegraPagamento() {
  const c = useContext(ContextoPagamento);
  if (!c) throw new Error('useRegraPagamento fora do ProvedorPagamento');
  return c.regra;
}

/** Guarda a regra que chegou do site (chamar quando /api/app/inicio ou a página do produto responder). */
export function useDefinirRegraPagamento() {
  const c = useContext(ContextoPagamento);
  if (!c) throw new Error('useDefinirRegraPagamento fora do ProvedorPagamento');
  return c.definirRegra;
}
