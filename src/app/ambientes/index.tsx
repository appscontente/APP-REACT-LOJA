// /ambientes, o mesmo endereço do site: os stories das lojas e a galeria "Compre o ambiente" (GET /api/app/ambientes).

import { router, Stack } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { StoriesAmbientes } from '@/componentes/stories-ambientes';
import { Texto } from '@/componentes/texto';
import { api } from '@/lib/api';
import { formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function Ambientes() {
  const largura = Math.min(useWindowDimensions().width, 600) - 32;
  const { dados, erro, carregando, recarregar } = useDados(() => api.ambientes(), []);
  return (
    <>
      <Stack.Screen options={{ title: 'Compre o ambiente' }} />
      {!dados && carregando ? (
        <Carregando />
      ) : !dados ? (
        <Erro mensagem={erro ?? ''} tentar={recarregar} />
      ) : !dados.ambientes.length ? (
        <Aviso titulo="Nenhum ambiente publicado ainda" texto="Volte logo: as lojas postam ambientes novos toda semana." />
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={recarregar} tintColor={cores.marca} />}>
          <StoriesAmbientes grupos={dados.stories} titulo="Novidades das lojas" />
          <View style={estilos.lista}>
            {dados.ambientes.map((a) => (
              <Pressable
                key={a.slug}
                style={estilos.card}
                accessibilityRole="link"
                onPress={() => router.push(`/ambientes/${a.slug}` as never)}>
                <Imagem uri={a.imagem.src} contentFit="cover" style={{ width: largura, height: largura * 0.75, backgroundColor: cores.fundoAlt }} />
                <View style={{ padding: 12, gap: 2 }}>
                  {a.loja ? (
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      📍 Casa Contente {a.loja.nome}
                    </Texto>
                  ) : null}
                  <Texto variante="subtitulo">{a.nome}</Texto>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    {a.itens.length} {a.itens.length === 1 ? 'produto' : 'produtos'} ·{' '}
                    {formatarPreco(a.itens.reduce((s, i) => s + i.preco, 0))} o ambiente
                  </Texto>
                </View>
              </Pressable>
            ))}
          </View>
        </ScrollView>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  lista: { paddingHorizontal: 16, marginTop: 24, gap: 16 },
  card: { backgroundColor: cores.superficie, borderRadius: raio.xl, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
});
