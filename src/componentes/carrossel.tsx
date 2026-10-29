import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { cores } from '@/lib/tema';

/** Carrossel que encaixa um item por vez, com os pontinhos embaixo. */
export function Carrossel({ largura, espaco = 12, children }: { largura: number; espaco?: number; children: ReactNode[] }) {
  const [atual, setAtual] = useState(0);
  return (
    <View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={largura + espaco}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: 16, gap: espaco }}
        onScroll={(e) => setAtual(Math.round(e.nativeEvent.contentOffset.x / (largura + espaco)))}
        scrollEventThrottle={32}>
        {children}
      </ScrollView>
      {children.length > 1 && (
        <View style={estilos.pontos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {children.map((_, i) => (
            <View key={i} style={[estilos.ponto, i === atual && estilos.pontoAtual]} />
          ))}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  pontos: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.borda },
  pontoAtual: { width: 18, backgroundColor: cores.marca },
});
