// Cofrinho Contente (contrato do site, seção 39): o cliente garante o preço à vista de um produto por 90 dias e vai
// depositando aos poucos. As regras, os termos e o preço vêm do site (/api/app/cofrinho*); o cofrinho em si, com o
// backend, vem de /api/app/cofrinhos/* (o Happy guarda o saldo e os recebimentos).
//
// Nesta versão de demonstração o cofrinho fica só no celular e nada é cobrado. Cartão nunca é guardado: o depósito só
// grava a forma e o valor. Itens do cofrinho não ganham nem usam cashback.

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { apagar, gravar, ler } from '@/lib/armazenamento';
import { arredondar } from '@/lib/formatar';
import type { FormaDeposito } from '@/lib/tipos';

export type ItemCofrinho = { codprod: string; slug: string; nome: string; imagem?: string; precoGarantido: number };

export type DepositoCofrinho = {
  id: string;
  forma: FormaDeposito;
  valor: number;
  quando: string;
  /** Pix gerado e ainda não pago não conta no saldo. */
  situacao: 'aprovado' | 'aguardando-pix' | 'devolvido';
};

export type TrocaCofrinho = { quando: string; motivo: 'escolha' | 'esgotado'; de: string[]; para: string[] };

export type Cofrinho = {
  /** CF-000123, como o Happy numera. Na demonstração, gerado no celular. */
  id: string;
  abertoEm: string;
  garantidoAte: string;
  itens: ItemCofrinho[];
  depositos: DepositoCofrinho[];
  trocas: TrocaCofrinho[];
  /** Aceite dos termos: versão e quando (o servidor grava também o CPF, o IP e o aparelho). */
  aceite: { versao: string; em: string };
  situacao: 'aberto' | 'concluido' | 'devolvido';
  concluidoEm?: string;
};

/** Valor do cofrinho (soma dos preços garantidos), saldo aprovado e quanto falta. */
export function contas(c: Cofrinho) {
  const alvo = arredondar(c.itens.reduce((s, i) => s + i.precoGarantido, 0));
  const saldo = arredondar(c.depositos.filter((d) => d.situacao === 'aprovado').reduce((s, d) => s + d.valor, 0));
  const pendente = arredondar(c.depositos.filter((d) => d.situacao === 'aguardando-pix').reduce((s, d) => s + d.valor, 0));
  const falta = arredondar(Math.max(0, alvo - saldo));
  return { alvo, saldo, pendente, falta, completo: alvo > 0 && falta <= 0, percentual: alvo > 0 ? Math.min(1, saldo / alvo) : 0 };
}

export const garantiaVencida = (c: Cofrinho, agora = Date.now()) => new Date(c.garantidoAte).getTime() < agora;

type Contexto = {
  cofrinhos: Cofrinho[];
  pronto: boolean;
  abertos: Cofrinho[];
  buscar: (id: string) => Cofrinho | undefined;
  abrir: (dados: { item: ItemCofrinho; garantidoAte: string; versaoTermos: string; deposito: { forma: FormaDeposito; valor: number } }) => string;
  depositar: (id: string, deposito: { forma: FormaDeposito; valor: number }) => DepositoCofrinho;
  /** Demonstração: o "banco" confirma o Pix. Com o backend, a confirmação vem da consulta à e.Rede. */
  confirmarPix: (id: string, deposito: string) => void;
  trocar: (id: string, itens: ItemCofrinho[], motivo: TrocaCofrinho['motivo'], garantidoAte: string) => void;
  concluir: (id: string) => void;
  desistir: (id: string) => void;
  limpar: () => void;
};

const CHAVE = 'cofrinho:v1';
const ContextoCofrinho = createContext<Contexto | null>(null);

const agoraIso = () => new Date().toISOString();
const novoId = (prefixo: string) => `${prefixo}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function ProvedorCofrinho({ children }: { children: ReactNode }) {
  const [cofrinhos, setCofrinhos] = useState<Cofrinho[]>([]);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    ler<Cofrinho[]>(CHAVE, []).then((lista) => {
      setCofrinhos(Array.isArray(lista) ? lista : []);
      setPronto(true);
    });
  }, []);
  useEffect(() => {
    if (pronto) gravar(CHAVE, cofrinhos);
  }, [cofrinhos, pronto]);

  const valor = useMemo<Contexto>(() => {
    const mudar = (id: string, f: (c: Cofrinho) => Cofrinho) => setCofrinhos((lista) => lista.map((c) => (c.id === id ? f(c) : c)));
    const deposito = (forma: FormaDeposito, valor: number): DepositoCofrinho => ({
      id: novoId('D'),
      forma,
      valor: arredondar(valor),
      quando: agoraIso(),
      // Cartão (demonstração): aprovado na hora. Com o backend, entra no saldo só depois da ClearSale e da captura.
      situacao: forma === 'pix' ? 'aguardando-pix' : 'aprovado',
    });
    return {
      cofrinhos,
      pronto,
      abertos: cofrinhos.filter((c) => c.situacao === 'aberto'),
      buscar: (id) => cofrinhos.find((c) => c.id === id),
      abrir: ({ item, garantidoAte, versaoTermos, deposito: d }) => {
        const numero = String(Math.floor(Date.now() / 1000) % 1_000_000).padStart(6, '0');
        const id = `CF-${numero}`;
        const em = agoraIso();
        setCofrinhos((lista) => [
          { id, abertoEm: em, garantidoAte, itens: [item], depositos: [deposito(d.forma, d.valor)], trocas: [], aceite: { versao: versaoTermos, em }, situacao: 'aberto' },
          ...lista,
        ]);
        return id;
      },
      depositar: (id, d) => {
        const novo = deposito(d.forma, d.valor);
        mudar(id, (c) => ({ ...c, depositos: [...c.depositos, novo] }));
        return novo;
      },
      confirmarPix: (id, dep) =>
        mudar(id, (c) => ({ ...c, depositos: c.depositos.map((d) => (d.id === dep && d.situacao === 'aguardando-pix' ? { ...d, situacao: 'aprovado' } : d)) })),
      trocar: (id, itens, motivo, garantidoAte) =>
        mudar(id, (c) => ({
          ...c,
          itens,
          garantidoAte,
          trocas: [...c.trocas, { quando: agoraIso(), motivo, de: c.itens.map((i) => i.nome), para: itens.map((i) => i.nome) }],
        })),
      concluir: (id) => mudar(id, (c) => ({ ...c, situacao: 'concluido', concluidoEm: agoraIso() })),
      desistir: (id) =>
        mudar(id, (c) => ({
          ...c,
          situacao: 'devolvido',
          depositos: c.depositos.map((d) => (d.situacao === 'aprovado' ? { ...d, situacao: 'devolvido' } : d)),
        })),
      limpar: () => {
        setCofrinhos([]);
        apagar([CHAVE]);
      },
    };
  }, [cofrinhos, pronto]);

  return <ContextoCofrinho.Provider value={valor}>{children}</ContextoCofrinho.Provider>;
}

export function useCofrinho() {
  const c = useContext(ContextoCofrinho);
  if (!c) throw new Error('useCofrinho fora do ProvedorCofrinho');
  return c;
}
