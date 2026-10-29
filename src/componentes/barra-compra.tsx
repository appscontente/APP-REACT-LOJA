import { Ionicons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores } from '@/lib/tema';

/** Barra fixa embaixo da página do produto: conversar com a loja e o botão de compra. */
export function BarraCompra({ aoConversar, children }: { aoConversar: () => void; children: ReactNode }) {
  const baixo = useSafeAreaInsets().bottom;
  return (
    <View style={[estilos.barra, { paddingBottom: baixo + 10 }]}>
      <Pressable onPress={aoConversar} style={estilos.conversa} accessibilityRole="button" accessibilityLabel="Conversar com a loja">
        <Ionicons name="chatbubble-ellipses-outline" size={24} color={cores.marca} />
      </Pressable>
      <View style={{ flex: 1 }}>{children}</View>
    </View>
  );
}

export const ALTURA_BARRA_COMPRA = 76;

const estilos = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  conversa: {
    width: 52,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
