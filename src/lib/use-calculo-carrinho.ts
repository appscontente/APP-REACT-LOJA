// Promoções e cupom iguais aos do site: o servidor recalcula o carrinho (POST /api/app/carrinho/calcular, com o preço
// dele, nunca o do app) e o app só mostra o resultado. Espelho de loja/src/lib/promocoes/cliente.ts. O cupom digitado
// fica guardado no celular, como no site, para o checkout achar o mesmo código do carrinho.

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { disponiveis, type ItemCarrinho } from '@/estado/carrinho';
import { api } from './api';
import { apagar, gravar, ler } from './armazenamento';
import { itensParaCalculo } from './conjuntos';
import type { ContextoCalculo, ItemCalculo, ResultadoCalculo } from './tipos';

/** Espera depois da última mudança (quantidade, cupom, parcelas, CEP) antes de perguntar ao site. */
const ESPERA_MS = 400;

/** Sem resposta do site, a tela volta aos totais locais da vitrine e avisa com este texto. */
export const AVISO_SEM_CALCULO = 'Não conseguimos conferir as promoções agora. Os valores podem mudar no pagamento.';

type Estado = { chave: string; resultado?: ResultadoCalculo; erro?: string };

/**
 * Pede ao site o carrinho com as promoções e o cupom aplicados. Recalcula quando os itens disponíveis ou o contexto
 * (cupom, forma de pagamento, parcelas, CEP, cliente) mudam, 400 ms depois da última mudança; resposta de uma chave
 * antiga é ignorada. `resultado` guarda o último cálculo enquanto o novo não chega (`carregando`); se a chamada falhar
 * (sem internet, site fora), o cálculo anterior é descartado, porque seria de outro carrinho, e `erro` traz o aviso:
 * a tela cai nos totais locais de totais(). Lista vazia ou `ativo` falso: nada é pedido e `resultado` fica undefined.
 */
export function useCalculoCarrinho(itens: ItemCarrinho[], contexto: ContextoCalculo, ativo = true) {
  const [estado, setEstado] = useState<Estado>({ chave: '' });
  const [tentativa, setTentativa] = useState(0);
  const lista = itensParaCalculo(disponiveis(itens));
  // Texto estável: o efeito só roda quando o conteúdo muda, não a cada render. "Recalcular" muda só o sufixo.
  const corpo = ativo && lista.length ? JSON.stringify({ itens: lista, contexto }) : '';
  const chave = corpo ? `${corpo}#${tentativa}` : '';

  useEffect(() => {
    if (!chave) return;
    let vivo = true;
    const espera = setTimeout(() => {
      const pedido = JSON.parse(chave.slice(0, chave.lastIndexOf('#'))) as { itens: ItemCalculo[]; contexto: ContextoCalculo };
      api.calcularCarrinho(pedido.itens, pedido.contexto).then(
        (resultado) => vivo && setEstado({ chave, resultado }),
        // Sem internet (status 0) ou site fora: o resultado anterior sairia errado para este carrinho; some também.
        () => vivo && setEstado({ chave, erro: AVISO_SEM_CALCULO }),
      );
    }, ESPERA_MS);
    return () => {
      vivo = false;
      clearTimeout(espera);
    };
  }, [chave]);

  const recalcular = useCallback(() => setTentativa((t) => t + 1), []);
  const atual = estado.chave === chave;
  return {
    /** Último cálculo do site; undefined sem itens, antes da primeira resposta ou depois de uma falha. */
    resultado: chave ? estado.resultado : undefined,
    /** true enquanto o cálculo mostrado ainda não é o deste carrinho e contexto. */
    carregando: Boolean(chave) && !atual,
    erro: atual ? estado.erro : undefined,
    recalcular,
  };
}

// Cupom guardado no celular ------------------------------------------------------------------------------------------

const CHAVE_CUPOM = 'carrinho:cupom:v1';
const TAMANHO_CUPOM = 40;

/** Como o site guarda o código: maiúsculas, sem espaços, até 40 caracteres. */
export const limparCodigoCupom = (codigo: string) => codigo.toUpperCase().replace(/\s+/g, '').slice(0, TAMANHO_CUPOM);

type EstadoCupom = { cupom: string; pronto: boolean };

// Um valor só para o app inteiro: o carrinho e o checkout veem o mesmo cupom, e tirar numa tela tira na outra.
let cupomAtual: EstadoCupom = { cupom: '', pronto: false };
const ouvintes = new Set<() => void>();
let leitura: Promise<void> | undefined;

function trocarCupom(novo: EstadoCupom) {
  cupomAtual = novo;
  ouvintes.forEach((avisar) => avisar());
}

/** Lê o cupom guardado uma vez por abertura do app. Um `definir` antes da leitura terminar vale mais que o guardado. */
function lerCupomGuardado() {
  leitura ??= ler<unknown>(CHAVE_CUPOM, '').then((guardado) => {
    if (!cupomAtual.pronto) trocarCupom({ cupom: typeof guardado === 'string' ? limparCodigoCupom(guardado) : '', pronto: true });
  });
}

function assinar(avisar: () => void) {
  ouvintes.add(avisar);
  lerCupomGuardado();
  return () => {
    ouvintes.delete(avisar);
  };
}

const lerAtual = () => cupomAtual;

/**
 * Cupom do cliente, guardado no celular até ser tirado (como o site faz no navegador). `pronto` fica true depois de
 * ler o que estava guardado; até lá `cupom` é vazio.
 */
export function useCupom() {
  const { cupom, pronto } = useSyncExternalStore(assinar, lerAtual, lerAtual);
  const definir = useCallback((codigo: string) => {
    const limpo = limparCodigoCupom(codigo);
    trocarCupom({ cupom: limpo, pronto: true });
    if (limpo) gravar(CHAVE_CUPOM, limpo);
    else apagar([CHAVE_CUPOM]);
  }, []);
  const limpar = useCallback(() => definir(''), [definir]);
  return { cupom, pronto, definir, limpar };
}
