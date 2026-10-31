// Botão fixo da Figital: a nossa versão do "modo loja". Fica no canto de baixo, acima da barra de menus, em todas as
// telas menos no checkout, no leitor e dentro de uma conversa. Com a loja conhecida (QR lido nas últimas horas), abre
// o portal dela; sem loja, pergunta em qual loja o cliente está ou abre o leitor do QR da etiqueta.

import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useFigital } from '@/estado/figital';
import { rotaLoja } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';
import { ALTURA_BARRA_COMPRA } from './barra-compra';
import { Botao } from './botao';
import { Texto } from './texto';

const ESCONDER = [/^\/checkout/, /^\/leitor/, /^\/conversas\/.+/, /^\/pedido-recebido/, /^\/loja\/[^/]+\/carrinho/];
/** Telas com a barra de menus embaixo: o botão sobe para não cobrir a barra. */
const COM_ABAS = ['/', '/categorias', '/busca', '/carrinho', '/conta'];
/** Páginas de produto têm a barra de compra fixa embaixo. */
const COM_BARRA = [/^\/[^/]+\/p$/, /^\/loja\/[^/]+\/p\//];

/** De quanto em quanto tempo o rótulo do botão troca entre "Na loja" e "Autoatendimento". */
const TROCA_MS = 2500;

/** Alterna os rótulos com um esmaecer curto, para o cliente entender que o botão é o autoatendimento. */
function useRotuloAlternado(rotulos: string[]) {
  const [indice, setIndice] = useState(0);
  const [opacidade] = useState(() => new Animated.Value(1));
  const quantos = rotulos.length;
  useEffect(() => {
    if (quantos < 2) return;
    const relogio = setInterval(() => {
      Animated.timing(opacidade, { toValue: 0, duration: 180, useNativeDriver: true }).start(() => {
        setIndice((i) => (i + 1) % quantos);
        Animated.timing(opacidade, { toValue: 1, duration: 180, useNativeDriver: true }).start();
      });
    }, TROCA_MS);
    return () => clearInterval(relogio);
  }, [quantos, opacidade]);
  return { rotulo: rotulos[indice % quantos], opacidade };
}

export function BotaoFigital() {
  const caminho = usePathname();
  const baixo = useSafeAreaInsets().bottom;
  const { lojaAtual } = useFigital();
  const [escolhendo, setEscolhendo] = useState(false);
  const { rotulo, opacidade } = useRotuloAlternado([lojaAtual ? lojaAtual.nome : 'Na loja', 'Autoatendimento']);
  if (ESCONDER.some((r) => r.test(caminho))) return null;
  const naLoja = lojaAtual && caminho.startsWith(rotaLoja(lojaAtual.slug));
  if (naLoja) return null;

  const noProduto = COM_BARRA.some((r) => r.test(caminho));
  const alturaAbas = COM_ABAS.includes(caminho) ? 66 : noProduto ? ALTURA_BARRA_COMPRA : 0;
  return (
    <>
      <Pressable
        onPress={() => (lojaAtual ? router.push(rotaLoja(lojaAtual.slug) as never) : setEscolhendo(true))}
        accessibilityRole="button"
        accessibilityLabel={lojaAtual ? `Abrir o autoatendimento da loja ${lojaAtual.nome}` : 'Estou na loja: autoatendimento'}
        style={({ pressed }) => [
          estilos.botao,
          noProduto && estilos.compacto,
          { bottom: baixo + alturaAbas + 16 },
          pressed && { transform: [{ scale: 0.96 }] },
        ]}>
        <Ionicons name="storefront" size={22} color={cores.texto} />
        {/* No produto o botão fica só com o ícone, para não cobrir o frete e o preço. */}
        {!noProduto && (
          <Animated.View style={{ opacity: opacidade }}>
            <Texto style={estilos.rotulo}>{rotulo}</Texto>
          </Animated.View>
        )}
      </Pressable>
      <GavetaLojas aberta={escolhendo} fechar={() => setEscolhendo(false)} />
    </>
  );
}

export function GavetaLojas({ aberta, fechar }: { aberta: boolean; fechar: () => void }) {
  const { lojas, entrar } = useFigital();
  const baixo = useSafeAreaInsets().bottom;
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable style={estilos.fundo} onPress={fechar} accessibilityLabel="Fechar" />
      <View style={[estilos.gaveta, { paddingBottom: baixo + 24 }]}>
        <Texto variante="subtitulo">Em qual loja você está?</Texto>
        <Texto cor={cores.textoSuave}>
          No modo loja você vê o estoque da loja e do CD, monta o carrinho e fecha no caixa ou pelo app.
        </Texto>
        <Botao
          titulo="Ler QR da etiqueta"
          variante="sorriso"
          icone={<Ionicons name="qr-code" size={20} color={cores.texto} />}
          onPress={() => {
            fechar();
            router.push('/leitor');
          }}
        />
        <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ gap: 8 }}>
          {lojas.map((l) => (
            <Pressable
              key={l.slug}
              style={({ pressed }) => [estilos.loja, pressed && { backgroundColor: cores.fundoAlt }]}
              onPress={() => {
                entrar(l.slug);
                fechar();
                router.push(rotaLoja(l.slug) as never);
              }}>
              <Ionicons name="storefront-outline" size={22} color={cores.marca} />
              <View style={{ flex: 1 }}>
                <Texto variante="forte">Loja {l.nome}</Texto>
                <Texto variante="pequeno" cor={cores.textoSuave} numberOfLines={1}>
                  {l.endereco}
                </Texto>
              </View>
              <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  botao: {
    position: 'absolute',
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: cores.sorriso,
    paddingHorizontal: 16,
    height: 52,
    borderRadius: raio.pilula,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  compacto: { width: 52, height: 52, paddingHorizontal: 0, justifyContent: 'center' },
  rotulo: { fontFamily: fontes.titulo, fontSize: 15, color: cores.texto },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  gaveta: { backgroundColor: cores.superficie, padding: 24, gap: 14, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  loja: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: raio.l,
    borderWidth: 1,
    borderColor: cores.borda,
  },
});
