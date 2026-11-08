// Cofrinho Contente (contrato do site, seção 39): o cliente garante o preço à vista de um produto por 90 dias e vai
// depositando aos poucos. As regras, os termos e o preço vêm do site (/api/app/cofrinho*); o cofrinho em si, com o
// backend, vem de /api/app/cofrinhos/* (o Happy guarda o saldo e os recebimentos).
//
// Nesta versão de demonstração o cofrinho fica só no celular e nada é cobrado. Cartão nunca é guardado: o depósito só
// grava a forma e o valor. Itens do cofrinho não ganham nem usam cashback.

import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Platform } from 'react-native';

import { apagar, gravar, ler } from '@/lib/armazenamento';
import { proximaSemana } from '@/lib/cofrinho';
import { agendarLembreteSemanal, cancelarLembreteSemanal } from '@/lib/lembrete-cofrinho';
import { arredondar } from '@/lib/formatar';
import type { FormaDeposito } from '@/lib/tipos';

export type ItemCofrinho = {
  codprod: string;
  slug: string;
  nome: string;
  imagem?: string;
  precoGarantido: number;
};

export type DepositoCofrinho = {
  id: string;
  forma: FormaDeposito;
  valor: number;
  quando: string;
  /** Pix gerado e ainda não pago não conta no saldo. */
  situacao: 'aprovado' | 'aguardando-pix' | 'devolvido';
  /** Pix gerado pelo pagamento semanal (não pelo cliente na hora). */
  semanal?: boolean;
};

/** Pagamento semanal: toda semana, no dia escolhido, o app gera o Pix do valor e avisa. Muda ou para quando quiser. */
export type PlanoSemanal = {
  valor: number;
  diaSemana: number;
  proximo: string;
};

export type TrocaCofrinho = {
  quando: string;
  motivo: 'escolha' | 'esgotado';
  de: string[];
  para: string[];
};

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
  plano?: PlanoSemanal;
};

/** O que o formulário de depósito devolve: o depósito de agora e, se o cliente escolheu, o pagamento semanal. */
export type NovoDeposito = {
  forma: FormaDeposito;
  valor: number;
  semanal?: { valor: number; diaSemana: number };
};

/** Valor do cofrinho (soma dos preços garantidos), saldo aprovado e quanto falta. */
export function contas(c: Cofrinho) {
  const alvo = arredondar(c.itens.reduce((s, i) => s + i.precoGarantido, 0));
  const saldo = arredondar(c.depositos.filter((d) => d.situacao === 'aprovado').reduce((s, d) => s + d.valor, 0));
  const pendente = arredondar(c.depositos.filter((d) => d.situacao === 'aguardando-pix').reduce((s, d) => s + d.valor, 0));
  const falta = arredondar(Math.max(0, alvo - saldo));
  return {
    alvo,
    saldo,
    pendente,
    falta,
    completo: alvo > 0 && falta <= 0,
    percentual: alvo > 0 ? Math.min(1, saldo / alvo) : 0,
  };
}

export const garantiaVencida = (c: Cofrinho, agora = Date.now()) => new Date(c.garantidoAte).getTime() < agora;

type Contexto = {
  cofrinhos: Cofrinho[];
  pronto: boolean;
  abertos: Cofrinho[];
  buscar: (id: string) => Cofrinho | undefined;
  abrir: (dados: { item: ItemCofrinho; garantidoAte: string; versaoTermos: string; deposito: NovoDeposito }) => string;
  depositar: (id: string, deposito: NovoDeposito) => DepositoCofrinho;
  /** Gera o Pix da semana quando chegou o dia do pagamento semanal (o app chama ao abrir o cofrinho). */
  gerarSemana: (id: string) => void;
  pararSemanal: (id: string) => void;
  /** Demonstração: o "banco" confirma o Pix. Com o backend, a confirmação vem da consulta à e.Rede. */
  confirmarPix: (id: string, deposito: string) => void;
  trocar: (id: string, itens: ItemCofrinho[], motivo: TrocaCofrinho['motivo'], garantidoAte: string) => void;
  concluir: (id: string) => void;
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

  // Tocar no aviso do pagamento semanal abre o cofrinho, com o Pix da semana já gerado.
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const id = r?.notification.request.content.data?.cofrinho;
      if (typeof id === 'string') router.push({ pathname: '/cofrinho/[id]', params: { id } });
    };
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, []);

  const valor = useMemo<Contexto>(() => {
    const mudar = (id: string, f: (c: Cofrinho) => Cofrinho) => setCofrinhos((lista) => lista.map((c) => (c.id === id ? f(c) : c)));
    const deposito = (forma: FormaDeposito, valor: number, semanal?: boolean): DepositoCofrinho => ({
      id: novoId('D'),
      forma,
      valor: arredondar(valor),
      quando: agoraIso(),
      // Cartão (demonstração): aprovado na hora. Com o backend, entra no saldo só depois da ClearSale e da captura.
      situacao: forma === 'pix' ? 'aguardando-pix' : 'aprovado',
      ...(semanal && { semanal }),
    });
    // O primeiro Pix do plano é o depósito de agora; o próximo sai no dia escolhido da semana seguinte.
    const plano = (d: NovoDeposito): PlanoSemanal | undefined =>
      d.semanal && {
        valor: arredondar(d.semanal.valor),
        diaSemana: d.semanal.diaSemana,
        proximo: proximaSemana(d.semanal.diaSemana),
      };
    const semanaNova = (c: Cofrinho): Cofrinho => {
      if (!c.plano) return c;
      const { falta, pendente } = contas(c);
      // Já tem Pix da semana sem pagar, ou o cofrinho completou: não gera outro.
      const valor = arredondar(Math.min(c.plano.valor, falta - pendente));
      const jaTem = c.depositos.some((d) => d.semanal && d.situacao === 'aguardando-pix');
      const seguinte = {
        ...c.plano,
        proximo: proximaSemana(c.plano.diaSemana),
      };
      if (jaTem || valor <= 0) return { ...c, plano: seguinte };
      return {
        ...c,
        depositos: [...c.depositos, deposito('pix', valor, true)],
        plano: seguinte,
      };
    };
    const lembrar = (id: string, nome: string, d: NovoDeposito) => {
      if (d.semanal) agendarLembreteSemanal(id, nome, d.semanal.valor, d.semanal.diaSemana);
    };
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
          {
            id,
            abertoEm: em,
            garantidoAte,
            itens: [item],
            depositos: [deposito(d.forma, d.valor, Boolean(d.semanal))],
            trocas: [],
            aceite: { versao: versaoTermos, em },
            situacao: 'aberto',
            ...(d.semanal && { plano: plano(d) }),
          },
          ...lista,
        ]);
        lembrar(id, item.nome, d);
        return id;
      },
      depositar: (id, d) => {
        const novo = deposito(d.forma, d.valor, Boolean(d.semanal));
        mudar(id, (c) => ({
          ...c,
          depositos: [...c.depositos, novo],
          ...(d.semanal && { plano: plano(d) }),
        }));
        const c = cofrinhos.find((x) => x.id === id);
        if (c) lembrar(id, c.itens.map((i) => i.nome).join(', '), d);
        return novo;
      },
      // Devolve a mesma lista quando não é dia de gerar: a tela chama a cada mudança e não pode entrar em laço.
      gerarSemana: (id) =>
        setCofrinhos((lista) => {
          const c = lista.find((x) => x.id === id);
          if (!c || c.situacao !== 'aberto' || !c.plano || new Date(c.plano.proximo).getTime() > Date.now()) return lista;
          return lista.map((x) => (x.id === id ? semanaNova(x) : x));
        }),
      pararSemanal: (id) => {
        cancelarLembreteSemanal(id);
        mudar(id, ({ plano: _plano, ...c }) => c);
      },
      confirmarPix: (id, dep) =>
        mudar(id, (c) => ({
          ...c,
          depositos: c.depositos.map((d) => (d.id === dep && d.situacao === 'aguardando-pix' ? { ...d, situacao: 'aprovado' } : d)),
        })),
      trocar: (id, itens, motivo, garantidoAte) =>
        mudar(id, (c) => ({
          ...c,
          itens,
          garantidoAte,
          trocas: [
            ...c.trocas,
            {
              quando: agoraIso(),
              motivo,
              de: c.itens.map((i) => i.nome),
              para: itens.map((i) => i.nome),
            },
          ],
        })),
      concluir: (id) => {
        cancelarLembreteSemanal(id);
        mudar(id, ({ plano: _plano, ...c }) => ({
          ...c,
          situacao: 'concluido',
          concluidoEm: agoraIso(),
        }));
      },
      limpar: () => {
        for (const c of cofrinhos) cancelarLembreteSemanal(c.id);
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
