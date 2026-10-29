import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Linking, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Texto } from '@/componentes/texto';
import { useFigital } from '@/estado/figital';
import { rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';

/** Nossas lojas: endereço, horário, rota no mapa e entrar no modo loja. */
export default function Lojas() {
  const { lojas } = useFigital();
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
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
