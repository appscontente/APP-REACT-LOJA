// Peças das telas do Cofrinho Contente: barra de progresso, cartão do cofrinho na lista e a chamada na página do
// produto ("Guardar no Cofrinho").

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Imagem } from '@/componentes/imagem';
import { Porquinho } from '@/componentes/porquinho';
import { Texto } from '@/componentes/texto';
import { contas, expirado, temPagamento, type Cofrinho, type Lembrete } from '@/estado/cofrinho';
import { DIAS_SEMANA, diasAte, formatarData, lerReais } from '@/lib/cofrinho';
import { formatarDataHora, formatarPreco, nomeLegivel, precoPix } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';

/** Menor preço à vista que vai para o cofrinho, enquanto a regra do site não chegou (o site confere de novo). */
const PRECO_MINIMO_PADRAO = 200;

export function Progresso({ percentual }: { percentual: number }) {
  const p = Math.round(percentual * 100);
  return (
    <View style={estilos.trilho} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: p }} accessibilityLabel={`${p}% juntado`}>
      <View style={[estilos.barra, { width: `${Math.max(p, 2)}%` }]} />
    </View>
  );
}

/** Uma linha sobre o momento do cofrinho: prazo do primeiro pagamento, proteção do preço, falta, fim. */
export function SituacaoCofrinho({ cofrinho: c }: { cofrinho: Cofrinho }) {
  if (c.situacao === 'concluido')
    return (
      <Texto variante="pequeno" cor={cores.sucesso}>
        Concluído{c.recebidoEm ? ` · recebido em ${formatarData(c.recebidoEm)}` : ''}
      </Texto>
    );
  if (c.situacao === 'desistido')
    return (
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Desistência com devolução integral · protocolo {c.protocolo}
      </Texto>
    );
  if (c.situacao === 'devolvido')
    return (
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Devolvido · protocolo {c.protocolo}
      </Texto>
    );
  if (c.situacao === 'credito')
    return (
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Virou crédito na loja · protocolo {c.protocolo}
      </Texto>
    );
  if (expirado(c))
    return (
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Expirou sem o primeiro pagamento, sem custo nenhum
      </Texto>
    );
  if (!temPagamento(c))
    return (
      <Texto variante="pequeno" cor={cores.aviso}>
        Faça o primeiro pagamento até {formatarDataHora(c.primeiroPagamentoAte)}
      </Texto>
    );
  if (c.situacao === 'em_falta')
    return (
      <Texto variante="pequeno" cor={cores.aviso}>
        {c.aguardarAte ? `Produto em falta: esperando até ${formatarData(c.aguardarAte)}` : 'Produto em falta: escolha o que prefere'}
      </Texto>
    );
  return (
    <Texto variante="pequeno" cor={cores.textoSuave}>
      Seu preço não sobe{c.protegidoAte && diasAte(c.protegidoAte) > 0 ? `. Avisamos cada alta até ${formatarData(c.protegidoAte)}` : ''}
    </Texto>
  );
}

/**
 * Lembrete opcional: dia da semana e, se o cliente quiser, um valor sugerido. Não gera Pix nem cobrança. Na abertura,
 * só o dia (o Happy aceita só o dia no `abrir`).
 */
export function EscolhaLembrete({ inicial, comValor, aoSalvar, aoDesligar }: { inicial?: Lembrete; comValor?: boolean; aoSalvar: (l: Lembrete) => void; aoDesligar?: () => void }) {
  const [dia, setDia] = useState<number | undefined>(inicial?.diaSemana);
  const [valor, setValor] = useState(inicial?.valorSugerido ? inicial.valorSugerido.toFixed(2).replace('.', ',') : '');
  const sugerido = lerReais(valor);
  return (
    <View style={{ gap: 10 }}>
      <View style={estilos.chips}>
        {DIAS_SEMANA.map((nome, i) => {
          const marcado = dia === i;
          return (
            <Pressable
              key={nome}
              onPress={() => {
                setDia(i);
                if (!comValor) aoSalvar({ diaSemana: i });
              }}
              style={[estilos.dia, marcado && estilos.diaMarcado]}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcado }}
              accessibilityLabel={nome}>
              <Texto variante="rotulo" cor={marcado ? cores.marca : cores.texto}>
                {nome.slice(0, 3)}
              </Texto>
            </Pressable>
          );
        })}
      </View>
      {comValor ? (
        <>
          <Campo rotulo="Valor sugerido (opcional, R$)" value={valor} onChangeText={(t) => setValor(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="Sem sugestão" />
          <View style={{ flexDirection: 'row', gap: 16 }}>
            <Botao
              titulo="Salvar lembrete"
              variante="contorno"
              disabled={dia === undefined}
              onPress={() => dia !== undefined && aoSalvar({ diaSemana: dia, ...(Number.isFinite(sugerido) && sugerido > 0 && { valorSugerido: Math.round(sugerido * 100) / 100 }) })}
            />
            {aoDesligar ? <Botao titulo="Desligar" variante="texto" onPress={aoDesligar} /> : null}
          </View>
        </>
      ) : null}
    </View>
  );
}

export function CartaoCofrinho({ cofrinho }: { cofrinho: Cofrinho }) {
  const { saldo, alvo, percentual, completo } = contas(cofrinho);
  const aberto = cofrinho.situacao === 'aberto' && !expirado(cofrinho);
  const item = cofrinho.item;
  return (
    <Pressable
      onPress={() => router.push(`/cofrinho/${cofrinho.id}`)}
      style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Cofrinho ${cofrinho.id}: ${nomeLegivel(item.nome)}, ${formatarPreco(saldo)} de ${formatarPreco(alvo)}`}>
      <Imagem uri={item.imagem} style={estilos.foto} contentFit="contain" />
      <View style={{ flex: 1, gap: 6 }}>
        <Texto variante="forte" numberOfLines={2}>
          {nomeLegivel(item.nome)}
        </Texto>
        <Progresso percentual={percentual} />
        <Texto variante="pequeno">
          <Texto variante="pequeno" style={{ fontFamily: fontes.textoForte }}>
            {formatarPreco(saldo)}
          </Texto>{' '}
          de {formatarPreco(alvo)}
          {completo && aberto ? ' · completo!' : ''}
        </Texto>
        <SituacaoCofrinho cofrinho={cofrinho} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

/**
 * Chamada na página do produto. Só aparece para produto que pode ir ao cofrinho pela conta local (estoque no CD,
 * vende sozinho, sem peça de exposição, preço à vista a partir do mínimo); a tela do cofrinho confere no site.
 */
export function ChamadaCofrinho({
  slug,
  preco,
  descontoPix,
  estoque,
  sujeitoConfirmacao,
  soConjunto,
  liberado,
}: {
  slug: string;
  preco: number;
  descontoPix?: number;
  estoque: number;
  sujeitoConfirmacao?: boolean;
  soConjunto: boolean;
  liberado?: boolean;
}) {
  const aVista = precoPix(preco, descontoPix);
  // Só produto que a equipe liberou no admin do site (todos começam desligados).
  if (!liberado || soConjunto || !(estoque > 0) || sujeitoConfirmacao || aVista < PRECO_MINIMO_PADRAO) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/cofrinho/novo', params: { slug } })}
      style={({ pressed }) => [estilos.chamada, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Guardar no Cofrinho Contente: garanta ${formatarPreco(aVista)} e junte aos poucos, sem parcela`}>
      <Porquinho largura={52} />
      <View style={{ flex: 1 }}>
        <Texto variante="forte">Guardar no Cofrinho Contente</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Garanta {formatarPreco(aVista)} e junte aos poucos, sem parcela
        </Texto>
      </View>
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  trilho: { height: 10, borderRadius: raio.pilula, backgroundColor: cores.fundoAlt, overflow: 'hidden' },
  barra: { height: '100%', borderRadius: raio.pilula, backgroundColor: cores.sorriso },
  cartao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  foto: { width: 72, height: 72, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dia: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  diaMarcado: { borderColor: cores.marca, backgroundColor: cores.creme },
  chamada: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: raio.l, backgroundColor: cores.creme, borderWidth: 1, borderColor: cores.sorriso },
});
