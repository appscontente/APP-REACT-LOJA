// "Mais para você" no fim do início: produtos sorteados dos departamentos, chegando aos poucos conforme o cliente rola.
// Cada leva sorteia um departamento, embaralha os produtos dele e mostra alguns; o resto fica guardado para a próxima.

import { useEffect, useEffectEvent, useRef, useState } from 'react';

import { api } from './api';
import type { CardProduto, Departamento } from './tipos';

const POR_LEVA = 10;

function embaralhar<T>(lista: T[]) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

/** `jaNaTela`: códigos que o início já mostra (achados e vitrines), para não repetir. */
export function useMaisProdutos(departamentos: Departamento[], jaNaTela: string[]) {
  const [produtos, setProdutos] = useState<CardProduto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [acabou, setAcabou] = useState(false);
  const estado = useRef({ fila: [] as string[], reserva: [] as CardProduto[], vistos: new Set<string>(), ocupado: false, iniciado: false });

  const carregarMais = async () => {
    const e = estado.current;
    if (e.ocupado || acabou || !departamentos.length) return;
    if (!e.iniciado) {
      e.iniciado = true;
      e.fila = embaralhar(departamentos.map((d) => d.slug));
      jaNaTela.forEach((c) => e.vistos.add(c));
    }
    e.ocupado = true;
    setCarregando(true);
    try {
      while (e.reserva.length < POR_LEVA && e.fila.length) {
        const departamento = e.fila.shift()!;
        const lista = await api.produtos({ departamento }).catch(() => []);
        e.reserva.push(...embaralhar(lista.filter((p) => !e.vistos.has(p.codprod))));
        // Intercala os departamentos para a lista não ficar em blocos.
        e.reserva = embaralhar(e.reserva);
      }
      const leva = e.reserva.splice(0, POR_LEVA).filter((p) => !e.vistos.has(p.codprod));
      leva.forEach((p) => e.vistos.add(p.codprod));
      setProdutos((atual) => [...atual, ...leva]);
      if (!e.reserva.length && !e.fila.length) setAcabou(true);
    } finally {
      e.ocupado = false;
      setCarregando(false);
    }
  };

  const primeiraLeva = useEffectEvent(() => carregarMais());
  useEffect(() => {
    if (departamentos.length) primeiraLeva();
  }, [departamentos.length]);

  return { produtos, carregando, acabou, carregarMais };
}
