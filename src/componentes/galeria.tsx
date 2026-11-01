import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  useCompetingGestures,
  usePanGesture,
  usePinchGesture,
  useSimultaneousGestures,
  useTapGesture,
} from 'react-native-gesture-handler';
import Animated, { useAnimatedReaction, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

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
 * Fotos em tela cheia, começando na que o cliente tocou. Dá para ampliar com dois dedos: no iPhone com o zoom do próprio
 * ScrollView; no Android (e na web) com gestos próprios (FotoComZoom), porque o zoom do ScrollView só existe no iPhone.
 * Enquanto uma foto está ampliada, o deslize que troca de foto fica desligado; com a foto no tamanho normal, volta.
 * Trocar de foto zera o zoom.
 */
function FotosTelaCheia({ imagens, inicial, fechar }: { imagens: Dados[]; inicial: number; fechar: () => void }) {
  const { width, height } = useWindowDimensions();
  const topo = useSafeAreaInsets().top;
  const [atual, setAtual] = useState(inicial);
  const [comZoom, setComZoom] = useState(false);
  return (
    <Modal visible animationType="fade" onRequestClose={fechar} statusBarTranslucent>
      <StatusBar style="light" />
      {/* No Android, os gestos dentro de um Modal só funcionam com uma raiz do gesture-handler dentro dele. */}
      <GestureHandlerRootView style={estilos.telaCheia}>
        <ScrollView
          horizontal
          pagingEnabled
          scrollEnabled={!comZoom}
          showsHorizontalScrollIndicator={false}
          contentOffset={{ x: inicial * width, y: 0 }}
          onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / width))}
          scrollEventThrottle={32}>
          {imagens.map((i, n) => {
            const rotulo = `Foto ${n + 1} de ${imagens.length}: ${i.alt}`;
            const chave = `${i.src}${n}`;
            return Platform.OS === 'ios' ? (
              <FotoZoomNativo key={chave} uri={i.src} rotulo={rotulo} largura={width} altura={height} />
            ) : (
              <FotoComZoom
                key={chave}
                uri={i.src}
                rotulo={rotulo}
                largura={width}
                altura={height}
                ativa={n === atual}
                aoMudarZoom={setComZoom}
              />
            );
          })}
        </ScrollView>
        <View style={[estilos.topo, { top: topo + 8 }]}>
          <Texto variante="forte" cor="#fff">
            {atual + 1}/{imagens.length}
          </Texto>
          <Pressable onPress={fechar} style={estilos.fechar} accessibilityRole="button" accessibilityLabel="Fechar fotos">
            <Ionicons name="close" size={26} color="#fff" />
          </Pressable>
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

/** iPhone: o zoom do próprio ScrollView (até 3x), como o sistema faz nas fotos. */
function FotoZoomNativo({ uri, rotulo, largura, altura }: { uri: string; rotulo: string; largura: number; altura: number }) {
  return (
    <ScrollView
      style={{ width: largura, height: altura }}
      contentContainerStyle={{ width: largura, height: altura, justifyContent: 'center' }}
      maximumZoomScale={3}
      minimumZoomScale={1}
      centerContent
      showsHorizontalScrollIndicator={false}
      showsVerticalScrollIndicator={false}>
      <Imagem uri={uri} accessible accessibilityLabel={rotulo} style={{ width: largura, height: altura * 0.8 }} />
    </ScrollView>
  );
}

const ZOOM_MAXIMO = 4;
const ZOOM_TOQUE_DUPLO = 2.5;
/** Soltando os dedos abaixo disso, a foto volta ao tamanho normal. */
const ZOOM_MINIMO_PARA_FICAR = 1.1;

/** Mantém `valor` entre -limite e +limite. */
function limitar(valor: number, limite: number) {
  'worklet';
  return Math.min(limite, Math.max(-limite, valor));
}

/**
 * Android e web: uma foto com zoom por gestos. Pinça de 1x a 4x em volta do ponto entre os dedos (a foto acompanha os
 * dedos), arrasto só com a foto ampliada e sem passar das bordas dela, toque duplo alternando 1x e 2,5x no ponto tocado.
 * Soltar abaixo de 1,1x volta a 1x. Avisa a galeria quando entra e sai do zoom, para ela travar e soltar a troca de foto.
 */
function FotoComZoom({
  uri,
  rotulo,
  largura,
  altura,
  ativa,
  aoMudarZoom,
}: {
  uri: string;
  rotulo: string;
  largura: number;
  altura: number;
  /** false quando o cliente passou para outra foto: o zoom desta volta a 1x. */
  ativa: boolean;
  aoMudarZoom: (comZoom: boolean) => void;
}) {
  const alturaCaixa = altura * 0.8;
  const escala = useSharedValue(1);
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  // Onde cada gesto começou, para a conta partir dali.
  const escalaInicial = useSharedValue(1);
  const xInicial = useSharedValue(0);
  const yInicial = useSharedValue(0);
  const xArrasto = useSharedValue(0);
  const yArrasto = useSharedValue(0);
  /** Ponto entre os dedos no começo da pinça, em relação ao centro da tela. */
  const foco = useSharedValue<{ x: number; y: number } | null>(null);
  const pincando = useSharedValue(false);
  /** Liga o arrasto (e avisa a galeria) só com a foto ampliada. */
  const comZoom = useSharedValue(false);
  /** Tamanho da foto desenhada (cabe na caixa mantendo a proporção); até carregar, a caixa inteira. */
  const desenho = useSharedValue({ largura, altura: alturaCaixa });

  /** Até onde a foto pode andar em cada eixo nesta escala sem a borda dela entrar na tela. */
  const limiteX = (s: number) => {
    'worklet';
    return Math.max(0, (desenho.get().largura * s - largura) / 2);
  };
  const limiteY = (s: number) => {
    'worklet';
    return Math.max(0, (desenho.get().altura * s - altura) / 2);
  };
  const voltarAoNormal = () => {
    'worklet';
    escala.set(withTiming(1));
    x.set(withTiming(0));
    y.set(withTiming(0));
  };

  const pinca = usePinchGesture({
    onActivate: () => {
      pincando.set(true);
      escalaInicial.set(escala.get());
      xInicial.set(x.get());
      yInicial.set(y.get());
      foco.set(null);
    },
    onUpdate: (e) => {
      // O ponto da foto que estava entre os dedos no começo continua entre eles: amplia em volta da pinça e acompanha.
      const fx = e.focalX - largura / 2;
      const fy = e.focalY - altura / 2;
      const f0 = foco.get() ?? { x: fx, y: fy };
      if (foco.get() === null) foco.set(f0);
      const nova = Math.min(ZOOM_MAXIMO, Math.max(1, escalaInicial.get() * e.scale));
      const fator = nova / escalaInicial.get();
      x.set(limitar(fx - fator * (f0.x - xInicial.get()), limiteX(nova)));
      y.set(limitar(fy - fator * (f0.y - yInicial.get()), limiteY(nova)));
      escala.set(nova);
    },
    onDeactivate: () => {
      pincando.set(false);
      if (escala.get() < ZOOM_MINIMO_PARA_FICAR) voltarAoNormal();
    },
  });

  const arrasto = usePanGesture({
    enabled: comZoom,
    averageTouches: true,
    onActivate: () => {
      xArrasto.set(x.get());
      yArrasto.set(y.get());
    },
    onUpdate: (e) => {
      if (pincando.get()) {
        // Com dois dedos quem move a foto é a pinça; aqui só guarda de onde o arrasto continua quando sobrar um dedo.
        xArrasto.set(x.get() - e.translationX);
        yArrasto.set(y.get() - e.translationY);
        return;
      }
      const s = escala.get();
      x.set(limitar(xArrasto.get() + e.translationX, limiteX(s)));
      y.set(limitar(yArrasto.get() + e.translationY, limiteY(s)));
    },
  });

  const toqueDuplo = useTapGesture({
    numberOfTaps: 2,
    onActivate: (e) => {
      if (escala.get() > 1) {
        voltarAoNormal();
        return;
      }
      // Amplia em volta do ponto tocado, parando nas bordas da foto.
      const fx = e.x - largura / 2;
      const fy = e.y - altura / 2;
      escala.set(withTiming(ZOOM_TOQUE_DUPLO));
      x.set(withTiming(limitar(fx * (1 - ZOOM_TOQUE_DUPLO), limiteX(ZOOM_TOQUE_DUPLO))));
      y.set(withTiming(limitar(fy * (1 - ZOOM_TOQUE_DUPLO), limiteY(ZOOM_TOQUE_DUPLO))));
    },
  });

  const gestos = useCompetingGestures(toqueDuplo, useSimultaneousGestures(pinca, arrasto));

  // Entrou ou saiu do zoom: liga o arrasto e avisa a galeria (que trava a troca de foto enquanto está ampliada).
  useAnimatedReaction(
    () => escala.get() > 1.001,
    (agora, antes) => {
      if (antes === null || agora === antes) return;
      comZoom.set(agora);
      scheduleOnRN(aoMudarZoom, agora);
    },
  );

  // Trocou de foto: esta volta ao tamanho normal, para a próxima vez abrir sem zoom.
  useEffect(() => {
    if (ativa) return;
    escala.set(1);
    x.set(0);
    y.set(0);
  }, [ativa, escala, x, y]);

  const estiloZoom = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }, { translateY: y.get() }, { scale: escala.get() }],
  }));

  /** Leitor de tela: "ativar" alterna o zoom, já que a pinça e o toque duplo não chegam até aqui com ele ligado. */
  const alternarZoom = () => {
    const ampliar = escala.get() <= 1;
    escala.set(withTiming(ampliar ? ZOOM_TOQUE_DUPLO : 1));
    x.set(withTiming(0));
    y.set(withTiming(0));
  };

  return (
    <GestureDetector gesture={gestos}>
      <View style={{ width: largura, height: altura, justifyContent: 'center' }}>
        <Animated.View
          style={[{ width: largura, height: alturaCaixa }, estiloZoom]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={rotulo}
          accessibilityHint="Toque duas vezes para ampliar ou reduzir"
          accessibilityActions={[{ name: 'activate', label: 'Ampliar ou reduzir' }]}
          onAccessibilityAction={(e) => {
            if (e.nativeEvent.actionName === 'activate') alternarZoom();
          }}>
          <Imagem
            uri={uri}
            style={{ width: largura, height: alturaCaixa }}
            onLoad={(e) => {
              const { width: w, height: h } = e.source;
              if (!w || !h) return;
              const razao = Math.min(largura / w, alturaCaixa / h);
              desenho.set({ largura: w * razao, altura: h * razao });
            }}
          />
        </Animated.View>
      </View>
    </GestureDetector>
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
