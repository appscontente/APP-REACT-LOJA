import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores } from '@/lib/tema';
import type { Imagem as Dados } from '@/lib/tipos';
import { Imagem } from './imagem';
import { Texto } from './texto';

/** Fotos do produto, deslizando para o lado. Um toque abre a foto em tela cheia. */
export function Galeria({ imagens, largura }: { imagens: Dados[]; largura: number }) {
  const [atual, setAtual] = useState(0);
  const [ampliada, setAmpliada] = useState<number>();
  const temFoto = imagens.length > 0;
  const lista = temFoto ? imagens : [{ src: '', alt: 'Sem foto' }];
  return (
    <View style={{ backgroundColor: '#fff' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / largura))}
        scrollEventThrottle={32}>
        {lista.map((i, n) => (
          <Pressable
            key={`${i.src}${n}`}
            disabled={!temFoto}
            onPress={() => setAmpliada(n)}
            accessibilityRole={temFoto ? 'imagebutton' : 'image'}
            accessibilityLabel={`Foto ${n + 1} de ${lista.length}: ${i.alt}`}
            accessibilityHint={temFoto ? 'Abre a foto em tela cheia' : undefined}>
            <Imagem uri={i.src} style={{ width: largura, height: largura * 0.9 }} />
          </Pressable>
        ))}
      </ScrollView>
      {lista.length > 1 && (
        <View style={estilos.pontos}>
          {lista.map((_, n) => (
            <View key={n} style={[estilos.ponto, n === atual && estilos.atual]} />
          ))}
        </View>
      )}
      {ampliada !== undefined ? <FotosTelaCheia imagens={lista} inicial={ampliada} fechar={() => setAmpliada(undefined)} /> : null}
    </View>
  );
}

/**
 * Fotos em tela cheia, começando na que o cliente tocou. No iPhone dá para ampliar com dois dedos (zoom do próprio
 * ScrollView); no Android, por enquanto, só a foto grande.
 */
function FotosTelaCheia({ imagens, inicial, fechar }: { imagens: Dados[]; inicial: number; fechar: () => void }) {
  const { width, height } = useWindowDimensions();
  const topo = useSafeAreaInsets().top;
  const [atual, setAtual] = useState(inicial);
  return (
    <Modal visible animationType="fade" onRequestClose={fechar} statusBarTranslucent>
      <StatusBar style="light" />
      <View style={estilos.telaCheia}>
        <ScrollView
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: inicial * width, y: 0 }}
          onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={32}>
          {imagens.map((i, n) => (
            <ScrollView
              key={`${i.src}${n}`}
              style={{ width, height }}
              contentContainerStyle={{ width, height, justifyContent: 'center' }}
              maximumZoomScale={3}
              minimumZoomScale={1}
              centerContent
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}>
              <Imagem
                uri={i.src}
                accessible
                accessibilityLabel={`Foto ${n + 1} de ${imagens.length}: ${i.alt}`}
                style={{ width, height: height * 0.8 }}
              />
            </ScrollView>
          ))}
        </ScrollView>
        <View style={[estilos.topo, { top: topo + 8 }]}>
          <Texto variante="forte" cor="#fff">
            {atual + 1}/{imagens.length}
          </Texto>
          <Pressable onPress={fechar} style={estilos.fechar} accessibilityRole="button" accessibilityLabel="Fechar fotos">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.borda },
  atual: { width: 18, backgroundColor: cores.marca },
  telaCheia: { flex: 1, backgroundColor: '#000' },
  topo: { position: 'absolute', left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fechar: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.15)' },
});
