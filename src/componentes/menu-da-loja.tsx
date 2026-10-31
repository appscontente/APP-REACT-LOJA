// No modo loja, o início abre com o "menu da loja": só o que está exposto na loja em que o cliente está, por
// categoria, com o leitor de etiqueta e o atalho para a loja. O início normal continua logo abaixo.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { rotaFigital, rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { Departamento } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import { Botao } from './botao';
import { CardProduto } from './card-produto';
import { Texto } from './texto';

/** Só quando a categoria não está nos departamentos: "racks-e-paineis" → "Racks e paineis" (sem acento). */
const nomeDoSlug = (slug: string) => {
  const texto = slug.replace(/-/g, ' ');
  return texto.charAt(0).toUpperCase() + texto.slice(1);
};

/** Os departamentos dão o nome certo, com acento, de cada categoria. O início já os tem e pode passar por prop. */
export function MenuDaLoja({ departamentos }: { departamentos?: Departamento[] }) {
  const { lojaAtual } = useFigital();
  const slug = lojaAtual?.slug;
  const { dados, erro, carregando, recarregar } = useDados(() => (slug ? api.expostos(slug) : Promise.resolve([])), [slug]);
  const { dados: buscados } = useDados(
    () => (slug && !departamentos ? api.departamentos() : Promise.resolve(undefined)),
    [slug, Boolean(departamentos)],
  );
  const [categoria, setCategoria] = useState<string>();
  if (!lojaAtual) return null;

  const deps = departamentos ?? buscados ?? [];
  const nomeCategoria = (departamento: string, cat: string) =>
    deps.find((d) => d.slug === departamento)?.categorias.find((c) => c.slug === cat)?.nome ?? nomeDoSlug(cat);
  const produtos = dados ?? [];
  const categorias = new Map<string, string>();
  for (const p of produtos) if (p.categoria && !categorias.has(p.categoria)) categorias.set(p.categoria, nomeCategoria(p.departamento, p.categoria));
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
      {categorias.size > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
          {[undefined, ...categorias.keys()].map((c) => (
            <Pressable
              key={c ?? 'todas'}
              onPress={() => setCategoria(c)}
              style={[estilos.chip, categoria === c && estilos.chipAtivo]}
              accessibilityRole="button"
              accessibilityState={{ selected: categoria === c }}>
              <Texto variante="rotulo" cor={categoria === c ? '#fff' : cores.texto}>
                {c ? categorias.get(c) : 'Tudo'}
              </Texto>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {!dados && carregando ? (
        <ActivityIndicator color={cores.marca} style={{ paddingVertical: 24 }} />
      ) : !dados && erro ? (
        <View style={{ paddingHorizontal: 16, gap: 4, alignItems: 'flex-start' }}>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Não conseguimos carregar os produtos expostos.
          </Texto>
          <Botao titulo="Tentar de novo" variante="texto" onPress={recarregar} />
        </View>
      ) : visiveis.length ? (
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
