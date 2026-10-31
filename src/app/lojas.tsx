import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carregando, Erro } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { useLojas } from '@/estado/figital';
import { rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';

/** Nossas lojas: endereço, horário, rota no mapa e entrar no modo loja. */
export default function Lojas() {
  const { lojas, erroLojas, tentarLojas } = useLojas();
  const insets = useSafeAreaInsets();
  if (!lojas.length)
    return (
      <>
        <Stack.Screen options={{ title: 'Nossas lojas' }} />
        {erroLojas ? <Erro mensagem="Não conseguimos carregar as lojas." tentar={tentarLojas} /> : <Carregando />}
      </>
    );
  return (
    // Folga embaixo para o botão fixo "Na loja" não cobrir a última loja.
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 + insets.bottom }}>
      <Stack.Screen options={{ title: 'Nossas lojas' }} />
      {lojas.map((l) => (
        <View key={l.slug} style={estilos.loja}>
          <Texto variante="subtitulo">Loja {l.nome}</Texto>
          <Texto variante="pequeno">{l.endereco}</Texto>
          {l.horario ? (
            <Texto variante="pequeno" cor={cores.textoSuave}>
              {l.horario}
            </Texto>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 6 }}>
            <Pressable style={estilos.acao} onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(l.endereco)}`)}>
              <Ionicons name="navigate-outline" size={18} color={cores.marca} />
              <Texto variante="rotulo" cor={cores.marca}>
                Como chegar
              </Texto>
            </Pressable>
            <Pressable style={estilos.acao} onPress={() => router.push(rotaLoja(l.slug) as never)}>
              <Ionicons name="storefront-outline" size={18} color={cores.marca} />
              <Texto variante="rotulo" cor={cores.marca}>
                Estou nesta loja
              </Texto>
            </Pressable>
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  loja: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 4, borderWidth: 1, borderColor: cores.borda },
  acao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
