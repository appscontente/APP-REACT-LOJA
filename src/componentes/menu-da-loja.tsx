// No modo loja, o início abre com o "menu da loja": só o que está exposto na loja em que o cliente está, por
// categoria, com o leitor de etiqueta e o atalho para a loja. O início normal continua logo abaixo.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { rotaFigital, rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';
import { Botao } from './botao';
import { CardProduto } from './card-produto';
import { Texto } from './texto';

/** "guarda-roupas" → "Guarda-roupas". */
const nomeCategoria = (slug: string) => {
  const texto = slug.replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

export function MenuDaLoja() {
  const { lojaAtual } = useFigital();
  const slug = lojaAtual?.slug;
  const { dados } = useDados(() => (slug ? api.expostos(slug) : Promise.resolve([])), [slug]);
  const [categoria, setCategoria] = useState<string>();
  if (!lojaAtual) return null;

  const produtos = dados ?? [];
  const categorias = [...new Set(produtos.map((p) => p.categoria).filter(Boolean))];
  const visiveis = categoria ? produtos.filter((p) => p.categoria === categoria) : produtos;

  return (
    <View style={estilos.caixa}>
      <View style={estilos.topo}>
        <Ionicons name="storefront" size={20} color={cores.texto} />
        <Texto variante="subtitulo" style={{ flex: 1 }}>
          Nesta loja: {lojaAtual.nome}
        </Texto>
      </View>
      <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16 }}>
        <Botao
          titulo="Ler etiqueta"
          variante="principal"
          style={{ flex: 1 }}
          icone={<Ionicons name="qr-code" size={18} color="#fff" />}
          onPress={() => router.push('/leitor')}
        />
        <Botao titulo="Ver a loja" variante="contorno" style={{ flex: 1 }} onPress={() => router.push(rotaLoja(lojaAtual.slug) as never)} />
      </View>
      {categorias.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
          {[undefined, ...categorias].map((c) => (
            <Pressable
              key={c ?? 'todas'}
              onPress={() => setCategoria(c)}
              style={[estilos.chip, categoria === c && estilos.chipAtivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: categoria === c }}>
              <Texto variante="rotulo" cor={categoria === c ? '#fff' : cores.texto}>
                {c ? nomeCategoria(c) : 'Tudo'}
              </Texto>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {visiveis.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.lista}>
          {visiveis.map((p) => (
            <CardProduto key={p.codprod} produto={p} largura={156} href={rotaFigital(lojaAtual.slug, p.slug)} />
          ))}
        </ScrollView>
      ) : (
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ paddingHorizontal: 16 }}>
          Leia o QR code da etiqueta ou procure o produto na tela da loja.
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { backgroundColor: cores.creme, paddingVertical: 16, gap: 12, marginTop: 16, marginHorizontal: 16, borderRadius: raio.xl },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16 },
  chips: { paddingHorizontal: 16, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pilula, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  chipAtivo: { backgroundColor: cores.marca, borderColor: cores.marca },
  lista: { paddingHorizontal: 16, gap: 12 },
});
