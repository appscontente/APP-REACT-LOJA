import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { cores, fontes } from '@/lib/tema';
import type { CardProduto as Dados } from '@/lib/tipos';
import { CardProduto } from './card-produto';
import { Texto } from './texto';

/** Vitrine na horizontal (início, "Combina com"). `verTudo`: endereço da lista completa, como o "Ver tudo" do site. */
export function Prateleira({
  titulo,
  produtos,
  hrefDe,
  verTudo,
}: {
  titulo: string;
  produtos: Dados[];
  hrefDe?: (p: Dados) => string;
  verTudo?: string;
}) {
  if (!produtos.length) return null;
  return (
    <View style={estilos.secao}>
      <View style={estilos.cabeca}>
        <Texto variante="secao" style={estilos.titulo} accessibilityRole="header">
          {titulo}
        </Texto>
        {verTudo ? (
          <Pressable
            onPress={() => router.push(verTudo as never)}
            hitSlop={12}
            accessibilityRole="link"
            accessibilityLabel={`Ver tudo de ${titulo}`}>
            <Texto style={estilos.verTudo} cor={cores.marca}>
              Ver tudo
            </Texto>
          </Pressable>
        ) : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.lista}>
        {produtos.map((p) => (
          <CardProduto key={p.codprod} produto={p} largura={168} href={hrefDe?.(p)} />
        ))}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  secao: { gap: 12, marginTop: 28 },
  cabeca: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingHorizontal: 16 },
  titulo: { flex: 1 },
  verTudo: { fontFamily: fontes.titulo, fontSize: 15 },
  lista: { paddingHorizontal: 16, gap: 12 },
});
