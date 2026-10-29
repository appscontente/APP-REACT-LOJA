import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { useCarrinho } from '@/estado/carrinho';
import { useFigital } from '@/estado/figital';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, fontes } from '@/lib/tema';
import type { LojaFisica } from '@/lib/tipos';
import { Texto } from './texto';

/** No modo loja o topo fica amarelo com o nome da loja, o carrinho da loja e "Sair". */
export function CabecalhoLoja({ loja, titulo }: { loja: LojaFisica; titulo?: string }) {
  const { sair } = useFigital();
  const quantidade = useCarrinho().quantidadeTotal(loja.slug);
  return (
    <Stack.Screen
      options={{
        title: titulo ?? `Loja ${loja.nome}`,
        headerStyle: { backgroundColor: cores.sorriso },
        headerTitleStyle: { fontFamily: fontes.titulo, fontSize: 18 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
            <Pressable onPress={() => router.push(rotaCarrinhoLoja(loja.slug) as never)} hitSlop={8} accessibilityLabel="Carrinho da loja">
              <Ionicons name="cart" size={24} color={cores.texto} />
              {quantidade > 0 ? (
                <View style={{ position: 'absolute', top: -6, right: -10, backgroundColor: cores.marca, borderRadius: 9, minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
                  <Texto variante="pequeno" cor="#fff" style={{ fontFamily: fontes.titulo, fontSize: 11, lineHeight: 14 }}>
                    {quantidade}
                  </Texto>
                </View>
              ) : null}
            </Pressable>
            <Pressable
              onPress={() => {
                sair();
                router.replace('/');
              }}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Sair da loja">
              <Ionicons name="exit-outline" size={24} color={cores.texto} />
            </Pressable>
          </View>
        ),
      }}
    />
  );
}
