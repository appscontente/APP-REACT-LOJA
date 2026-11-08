// Peças das telas do Cofrinho Contente: barra de progresso, cartão do cofrinho na lista e a chamada na página do
// produto ("Guardar no Cofrinho").

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { contas, garantiaVencida, type Cofrinho } from '@/estado/cofrinho';
import { diasAte, formatarData } from '@/lib/cofrinho';
import { formatarPreco, nomeLegivel, precoPix } from '@/lib/formatar';
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

export function SituacaoGarantia({ cofrinho }: { cofrinho: Cofrinho }) {
  if (cofrinho.situacao === 'concluido') return <Texto variante="pequeno" cor={cores.sucesso}>Concluído</Texto>;
  if (cofrinho.situacao === 'devolvido') return <Texto variante="pequeno" cor={cores.textoSuave}>Cancelado com devolução</Texto>;
  if (garantiaVencida(cofrinho))
    return (
      <Texto variante="pequeno" cor={cores.aviso}>
        Preço garantido acabou em {formatarData(cofrinho.garantidoAte)}
      </Texto>
    );
  const dias = diasAte(cofrinho.garantidoAte);
  return (
    <Texto variante="pequeno" cor={dias <= 15 ? cores.aviso : cores.textoSuave}>
      Preço garantido até {formatarData(cofrinho.garantidoAte)} ({dias === 1 ? 'falta 1 dia' : `faltam ${dias} dias`})
    </Texto>
  );
}

export function CartaoCofrinho({ cofrinho }: { cofrinho: Cofrinho }) {
  const { saldo, alvo, percentual, completo } = contas(cofrinho);
  const item = cofrinho.itens[0];
  return (
    <Pressable
      onPress={() => router.push(`/cofrinho/${cofrinho.id}`)}
      style={({ pressed }) => [estilos.cartao, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Cofrinho ${cofrinho.id}: ${nomeLegivel(item?.nome ?? '')}, ${formatarPreco(saldo)} de ${formatarPreco(alvo)}`}>
      <Imagem uri={item?.imagem} style={estilos.foto} contentFit="contain" />
      <View style={{ flex: 1, gap: 6 }}>
        <Texto variante="forte" numberOfLines={2}>
          {nomeLegivel(item?.nome ?? '')}
          {cofrinho.itens.length > 1 ? ` + ${cofrinho.itens.length - 1}` : ''}
        </Texto>
        <Progresso percentual={percentual} />
        <Texto variante="pequeno">
          <Texto variante="pequeno" style={{ fontFamily: fontes.textoForte }}>
            {formatarPreco(saldo)}
          </Texto>{' '}
          de {formatarPreco(alvo)}
          {completo && cofrinho.situacao === 'aberto' ? ' · completo!' : ''}
        </Texto>
        <SituacaoGarantia cofrinho={cofrinho} />
      </View>
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

/**
 * Chamada na página do produto. Só aparece para produto que pode ir ao cofrinho pela conta local (estoque no CD,
 * vende sozinho, sem peça de exposição, preço à vista a partir do mínimo); a tela do cofrinho confere no site.
 */
export function ChamadaCofrinho({ slug, preco, descontoPix, estoque, sujeitoConfirmacao, soConjunto }: { slug: string; preco: number; descontoPix?: number; estoque: number; sujeitoConfirmacao?: boolean; soConjunto: boolean }) {
  const aVista = precoPix(preco, descontoPix);
  if (soConjunto || !(estoque > 0) || sujeitoConfirmacao || aVista < PRECO_MINIMO_PADRAO) return null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/cofrinho/novo', params: { slug } })}
      style={({ pressed }) => [estilos.chamada, pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
      accessibilityLabel={`Guardar no Cofrinho Contente: garanta ${formatarPreco(aVista)} por 3 meses e junte aos poucos`}>
      <View style={estilos.icone}>
        <Ionicons name="wallet" size={22} color={cores.texto} />
      </View>
      <View style={{ flex: 1 }}>
        <Texto variante="forte">Guardar no Cofrinho Contente</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Garanta {formatarPreco(aVista)} por 3 meses e junte aos poucos
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
  chamada: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12, borderRadius: raio.l, backgroundColor: cores.creme, borderWidth: 1, borderColor: cores.sorriso },
  icone: { width: 40, height: 40, borderRadius: 20, backgroundColor: cores.sorriso, alignItems: 'center', justifyContent: 'center' },
});
