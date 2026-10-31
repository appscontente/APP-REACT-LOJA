// "Mais para você" no fim do início: produtos sorteados dos departamentos, chegando aos poucos conforme o cliente rola.
// Cada leva sorteia um departamento, embaralha os produtos disponíveis dele e mostra alguns; o resto fica guardado para a
// próxima. Para no teto de sugestões (a grade do início não é virtualizada) e recomeça quando o cliente puxa para atualizar.

import { useRef, useState } from 'react';

import { api } from './api';
import type { CardProduto, Departamento } from './tipos';

const POR_LEVA = 10;
/** Teto de sugestões no início: a grade fica numa ScrollView comum, sem virtualização. */
const MAXIMO = 60;
/** Depois de uma falha de rede, espera um pouco antes de tentar de novo (o onScroll chama a todo momento). */
const ESPERA_FALHA_MS = 10 * 1000;

function embaralhar<T>(lista: T[]) {
  const copia = [...lista];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function estadoInicial() {
  return { fila: [] as string[], reserva: [] as CardProduto[], vistos: new Set<string>(), total: 0, ocupado: false, iniciado: false, falhouEm: 0 };
}

/**
 * `jaNaTela`: códigos que o início já mostra (achados e vitrines), para não repetir. A primeira leva chega quando o
 * cliente rola perto do fim (carregarMais no onScroll do início).
 */
export function useMaisProdutos(departamentos: Departamento[], jaNaTela: string[]) {
  const [produtos, setProdutos] = useState<CardProduto[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [acabou, setAcabou] = useState(false);
  const estado = useRef(estadoInicial());

  const carregarMais = async () => {
    const e = estado.current;
    if (e.ocupado || acabou || !departamentos.length || e.total >= MAXIMO) return;
    if (e.falhouEm && Date.now() - e.falhouEm < ESPERA_FALHA_MS) return;
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
        let lista: CardProduto[];
        try {
          lista = await api.produtos({ departamento });
          e.falhouEm = 0;
        } catch {
          // Sem conexão ou site fora: o departamento volta para a fila e a próxima rolagem tenta de novo.
          e.fila.push(departamento);
          e.falhouEm = Date.now();
          break;
        }
        // Puxar para atualizar começou outra rodada enquanto esta esperava o site: descarta.
        if (estado.current !== e) return;
        // Só produtos disponíveis: esgotado não entra no sorteio.
        e.reserva.push(...lista.filter((p) => p.estoque > 0 && !e.vistos.has(p.codprod)));
        // Intercala os departamentos para a lista não ficar em blocos.
        e.reserva = embaralhar(e.reserva);
      }
      if (estado.current !== e) return;
      const leva = e.reserva.splice(0, Math.min(POR_LEVA, MAXIMO - e.total)).filter((p) => !e.vistos.has(p.codprod));
      leva.forEach((p) => e.vistos.add(p.codprod));
      e.total += leva.length;
      if (leva.length) setProdutos((atual) => [...atual, ...leva]);
      if (e.total >= MAXIMO || (!e.reserva.length && !e.fila.length)) setAcabou(true);
    } finally {
      e.ocupado = false;
      if (estado.current === e) setCarregando(false);
    }
  };

  /** Puxar para atualizar: novo sorteio, do zero. A primeira leva volta a chegar com a rolagem. */
  const reiniciar = () => {
    estado.current = estadoInicial();
    setProdutos([]);
    setAcabou(false);
    setCarregando(false);
  };

  return { produtos, carregando, acabou, carregarMais, reiniciar };
}
