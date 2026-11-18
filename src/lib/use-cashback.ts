// Cashback do Happy no app (contrato 30.2 e 38.1): o % de cada item, pela margem dele, na página do produto, no
// carrinho e no checkout. Sem resposta do site ou do Happy, nada aparece: o app não promete cashback.

import { useEffect, useState } from 'react';

import { api } from './api';
import type { PreviaCashback } from './tipos';

/** Só os itens que o Happy conhece (código numérico, valor positivo), como a rota do site filtra. */
const validos = (itens: { codprod: string; total: number }[]) => itens.filter((i) => /^\d{1,12}$/.test(i.codprod) && Number.isFinite(i.total) && i.total > 0).slice(0, 300);

/** Prévia do cashback dos itens; espera o carrinho parar de mudar (300 ms) antes de perguntar ao site. */
export function usePreviaCashback(itens: { codprod: string; total: number }[]): PreviaCashback {
  const chave = validos(itens)
    .map((i) => `${i.codprod}:${Math.round(i.total * 100) / 100}`)
    .join(',');
  const [resultado, setResultado] = useState<{ chave: string; previa: PreviaCashback }>();

  useEffect(() => {
    if (!chave) return;
    let ativo = true;
    const espera = setTimeout(() => {
      const pedidos = chave.split(',').map((par) => {
        const [codprod, total] = par.split(':');
        return { codprod, total: Number(total) };
      });
      api.previaCashback(pedidos).then(
        (previa) => ativo && setResultado({ chave, previa }),
        () => ativo && setResultado({ chave, previa: {} }),
      );
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [chave]);

  // Resposta de outro carrinho não vale para este (evita mostrar o valor velho depois de mudar a quantidade).
  return chave && resultado?.chave === chave ? resultado.previa : {};
}

/** "2%", "1,5%": o % como o site escreve. */
export const textoPorcento = (p: number) => `${String(Math.round(p * 100) / 100).replace('.', ',')}%`;
