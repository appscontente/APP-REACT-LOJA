import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { cores } from '@/lib/tema';
import type { Imagem as Dados } from '@/lib/tipos';
import { Imagem } from './imagem';

/** Fotos do produto, deslizando para o lado. */
export function Galeria({ imagens, largura }: { imagens: Dados[]; largura: number }) {
  const [atual, setAtual] = useState(0);
  const lista = imagens.length ? imagens : [{ src: '', alt: 'Sem foto' }];
  return (
    <View style={{ backgroundColor: '#fff' }}>
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / largura))}
        scrollEventThrottle={32}>
        {lista.map((i, n) => (
          <Imagem key={`${i.src}${n}`} uri={i.src} accessibilityLabel={i.alt} style={{ width: largura, height: largura * 0.9 }} />
        ))}
      </ScrollView>
      {lista.length > 1 && (
        <View style={estilos.pontos}>
          {lista.map((_, n) => (
            <View key={n} style={[estilos.ponto, n === atual && estilos.atual]} />
          ))}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingVertical: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.borda },
  atual: { width: 18, backgroundColor: cores.marca },
});
