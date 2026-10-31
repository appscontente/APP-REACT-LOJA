import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { api, SITE_URL } from '@/lib/api';
import { rotaCategoria, rotaDepartamento } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

const ILUSTRACAO_PADRAO = `${SITE_URL}/img/categorias/padrao.svg`;

/** Departamentos com as categorias de cada um; tocar no nome abre a lista do departamento inteiro. */
export default function Categorias() {
  const topo = useSafeAreaInsets().top;
  const { dados, erro, carregando, recarregar } = useDados(() => api.departamentos(), []);
  const [aberto, setAberto] = useState<string>();
  // Ilustração que não carregou (slug do Sankhya sem desenho próprio): troca pela padrão do site.
  const [semIlustracao, setSemIlustracao] = useState<Record<string, true>>({});

  return (
    <View style={[estilos.tela, { paddingTop: topo }]}>
      <Texto variante="titulo" style={estilos.titulo}>
        Categorias
      </Texto>
      {!dados && carregando ? (
        <Carregando />
      ) : !dados ? (
        <Erro mensagem={erro ?? ''} tentar={recarregar} />
      ) : (
        <ScrollView contentContainerStyle={estilos.lista}>
          <Pressable style={[estilos.departamento, estilos.ofertas]} onPress={() => router.push('/ofertas')}>
            <Ionicons name="pricetag" size={26} color="#fff" />
            <Texto variante="subtitulo" cor="#fff" style={{ flex: 1 }}>
              Ofertas
            </Texto>
            <Ionicons name="chevron-forward" size={20} color="#fff" />
          </Pressable>
          {dados.map((d) => {
            const expandido = aberto === d.slug;
            return (
              <View key={d.slug} style={estilos.cartao}>
                <Pressable style={estilos.departamento} onPress={() => setAberto(expandido ? undefined : d.slug)}>
                  <Imagem
                    uri={semIlustracao[d.slug] ? ILUSTRACAO_PADRAO : (d.ilustracao ?? `${SITE_URL}/img/categorias/${d.slug}.svg`)}
                    onError={() => setSemIlustracao((s) => (s[d.slug] ? s : { ...s, [d.slug]: true }))}
                    style={{ width: 40, height: 40 }}
                  />
                  <Texto variante="subtitulo" style={{ flex: 1 }}>
                    {d.nome}
                  </Texto>
                  <Ionicons name={expandido ? 'chevron-up' : 'chevron-down'} size={20} color={cores.textoSuave} />
                </Pressable>
                {expandido && (
                  <View style={estilos.categorias}>
                    <Pressable style={estilos.categoria} onPress={() => router.push(rotaDepartamento(d.slug) as never)}>
                      <Texto variante="forte" cor={cores.marca}>
                        Ver tudo em {d.nome}
                      </Texto>
                    </Pressable>
                    {d.categorias.map((c) => (
                      <Pressable key={c.slug} style={estilos.categoria} onPress={() => router.push(rotaCategoria(d.slug, c.slug) as never)}>
                        <Texto>{c.nome}</Texto>
                        <Ionicons name="chevron-forward" size={16} color={cores.textoSuave} />
                      </Pressable>
                    ))}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  titulo: { paddingHorizontal: 16, paddingVertical: 12 },
  lista: { paddingHorizontal: 16, gap: 10, paddingBottom: 140 },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  departamento: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  ofertas: { backgroundColor: cores.marca, borderRadius: raio.l },
  categorias: { borderTopWidth: 1, borderTopColor: cores.borda },
  categoria: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
});
