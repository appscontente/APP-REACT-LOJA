import { ScrollView, StyleSheet, View } from 'react-native';

import type { CardProduto as Dados } from '@/lib/tipos';
import { CardProduto } from './card-produto';
import { Texto } from './texto';

/** Vitrine na horizontal (início, "Combina com"). */
export function Prateleira({ titulo, produtos, hrefDe }: { titulo: string; produtos: Dados[]; hrefDe?: (p: Dados) => string }) {
  if (!produtos.length) return null;
  return (
    <View style={estilos.secao}>
      <Texto variante="secao" style={estilos.titulo}>
        {titulo}
      </Texto>
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
  titulo: { paddingHorizontal: 16 },
  lista: { paddingHorizontal: 16, gap: 12 },
});
