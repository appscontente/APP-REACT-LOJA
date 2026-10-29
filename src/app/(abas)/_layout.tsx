import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useCarrinho } from '@/estado/carrinho';
import { cores, fontes } from '@/lib/tema';

type NomeIcone = React.ComponentProps<typeof Ionicons>['name'];

function icone(cheio: NomeIcone, vazio: NomeIcone) {
  return function IconeAba({ focused, color }: { focused: boolean; color: ColorValue }) {
    return <Ionicons name={focused ? cheio : vazio} size={24} color={color as string} />;
  };
}

/** Cinco abas na barra de baixo, como no levantamento: Início, Categorias, Busca, Carrinho e Conta. */
export default function Abas() {
  const quantidade = useCarrinho().quantidadeTotal();
  const baixo = useSafeAreaInsets().bottom;
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: cores.marca,
        tabBarInactiveTintColor: cores.textoSuave,
        tabBarLabelStyle: { fontFamily: fontes.tituloMedio, fontSize: 12, lineHeight: 18 },
        tabBarStyle: { backgroundColor: cores.superficie, borderTopColor: cores.borda, height: 66 + baixo, paddingTop: 6, paddingBottom: baixo + 8 },
        tabBarBadgeStyle: { backgroundColor: cores.sorriso, color: cores.texto, fontFamily: fontes.titulo, fontSize: 11 },
      }}>
      <Tabs.Screen name="index" options={{ title: 'Início', tabBarIcon: icone('home', 'home-outline') }} />
      <Tabs.Screen name="categorias" options={{ title: 'Categorias', tabBarIcon: icone('grid', 'grid-outline') }} />
      <Tabs.Screen name="busca" options={{ title: 'Busca', tabBarIcon: icone('search', 'search-outline') }} />
      <Tabs.Screen
        name="carrinho"
        options={{ title: 'Carrinho', tabBarIcon: icone('cart', 'cart-outline'), tabBarBadge: quantidade || undefined }}
      />
      <Tabs.Screen name="conta" options={{ title: 'Conta', tabBarIcon: icone('person', 'person-outline') }} />
    </Tabs>
  );
}
