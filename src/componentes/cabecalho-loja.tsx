import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Platform, Pressable, View } from 'react-native';

import { useCarrinho } from '@/estado/carrinho';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, fontes } from '@/lib/tema';
import type { LojaFisica } from '@/lib/tipos';
import { useFigital } from '@/estado/figital';
import { Botao } from './botao';
import { Texto } from './texto';

/**
 * No modo loja o topo fica amarelo com "Autoatendimento {loja}", o atalho do leitor (para ler a próxima etiqueta de
 * qualquer tela da loja) e o carrinho da loja. Sair da loja fica separado (BotaoSairDaLoja).
 */
export function CabecalhoLoja({ loja, titulo }: { loja: LojaFisica; titulo?: string }) {
  const quantidade = useCarrinho().quantidadeTotal(loja.slug);
  return (
    <Stack.Screen
      options={{
        title: titulo ?? `Autoatendimento ${loja.nome}`,
        headerStyle: { backgroundColor: cores.sorriso },
        headerTitleStyle: { fontFamily: fontes.titulo, fontSize: titulo === undefined ? 16 : 18 },
        headerRight: () => (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
            <Pressable onPress={() => router.push('/leitor')} hitSlop={8} accessibilityLabel="Ler etiqueta">
              <Ionicons name="qr-code" size={22} color={cores.texto} />
            </Pressable>
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
          </View>
        ),
      }}
    />
  );
}

/** Volta para a loja geral (sai do modo loja). Fica longe do carrinho, para ninguém tocar sem querer. */
export function BotaoSairDaLoja() {
  const { sair } = useFigital();
  return (
    <Botao
      titulo="Voltar para a loja geral"
      variante="contorno"
      icone={<Ionicons name="exit-outline" size={18} color={cores.marca} />}
      onPress={() => {
        sair();
        // O início é aba: volta para as abas em vez de empilhar outra cópia delas (#21).
        router.dismissTo('/');
      }}
    />
  );
}
