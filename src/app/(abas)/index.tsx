// Início: o que a home do site mostra, no formato do celular. Banners com arte do admin e os 4 banners automáticos do
// dia no carrossel, departamentos, achados de hoje, os 2 banners automáticos fixos, compre por ambiente e as vitrines.

import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { BannerAutomatico } from '@/componentes/banner-automatico';
import { Cabecalho } from '@/componentes/cabecalho';
import { Carrossel } from '@/componentes/carrossel';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Prateleira } from '@/componentes/prateleira';
import { Texto } from '@/componentes/texto';
import { api, SITE_URL } from '@/lib/api';
import { rotaCategoria, rotaDepartamento, rotaInterna } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { BannerArte, Departamento } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';
import * as WebBrowser from 'expo-web-browser';

const AMBIENTES = [
  { nome: 'Sala', imagem: 'sala', departamento: 'moveis', categorias: ['sofas', 'sofa', 'poltronas', 'rack'], cor: '#e9dccb' },
  { nome: 'Quarto', imagem: 'quarto', departamento: 'moveis', categorias: ['guarda-roupas', 'guarda-roupa', 'roupeiros'], cor: '#dfe6df' },
  { nome: 'Cozinha', imagem: 'cozinha', departamento: 'moveis', categorias: ['cozinhas', 'moveis-de-cozinha'], cor: '#efe1d9' },
  { nome: 'Área de serviço', imagem: 'area-de-servico', departamento: 'eletrodomesticos', categorias: ['lavadoras'], cor: '#e2e6ec' },
];

function linkAmbiente(a: (typeof AMBIENTES)[number], departamentos: Departamento[]) {
  const dep = departamentos.find((d) => d.slug === a.departamento);
  const categoria = a.categorias.find((c) => dep?.categorias.some((cat) => cat.slug === c));
  return categoria ? rotaCategoria(a.departamento, categoria) : rotaDepartamento(a.departamento);
}

function abrirLink(link: string) {
  const interna = rotaInterna(link, SITE_URL);
  if (interna) router.push(interna as never);
  else WebBrowser.openBrowserAsync(link);
}

function BannerComArte({ banner, largura, altura }: { banner: BannerArte; largura: number; altura: number }) {
  return (
    <Pressable onPress={() => abrirLink(banner.link)} accessibilityRole="link" accessibilityLabel={banner.alt}>
      <Imagem uri={banner.imagem} style={{ width: largura, height: altura, borderRadius: raio.xl }} contentFit="cover" />
    </Pressable>
  );
}

export default function Inicio() {
  const { width } = useWindowDimensions();
  const largura = Math.min(width, 600) - 32;
  const { dados, erro, carregando, recarregar } = useDados(() => api.inicio(), []);

  return (
    <View style={estilos.tela}>
      <Cabecalho />
      {!dados && carregando ? (
        <Carregando />
      ) : !dados ? (
        <Erro mensagem={erro ?? ''} tentar={recarregar} />
      ) : (
        <ScrollView
          contentContainerStyle={estilos.conteudo}
          refreshControl={<RefreshControl refreshing={carregando} onRefresh={recarregar} tintColor={cores.marca} />}>
          <View style={{ marginTop: 16 }}>
            <Carrossel largura={largura}>
              {[
                ...dados.banners.map((b) => <BannerComArte key={b.id} banner={b} largura={largura} altura={largura * 0.9} />),
                ...dados.automaticos.carrossel.map((b) => (
                  <BannerAutomatico key={b.id} banner={b} largura={largura} formato="carrossel" />
                )),
              ]}
            </Carrossel>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.departamentos}>
            {dados.departamentos.map((d) => (
              <Pressable key={d.slug} style={estilos.departamento} onPress={() => router.push(rotaDepartamento(d.slug) as never)}>
                <View style={estilos.iconeDepartamento}>
                  <Imagem uri={`${SITE_URL}/img/categorias/${d.slug}.svg`} style={{ width: 44, height: 44 }} />
                </View>
                <Texto variante="pequeno" numberOfLines={2} style={{ textAlign: 'center', fontSize: 12 }}>
                  {d.nome}
                </Texto>
              </Pressable>
            ))}
          </ScrollView>

          <Prateleira titulo="Achados de hoje" produtos={dados.achados} />

          {dados.faixas.map((b) => (
            <View key={b.id} style={estilos.bloco}>
              <BannerComArte banner={b} largura={largura} altura={largura / 4} />
            </View>
          ))}

          {dados.automaticos.fixos.length > 0 && (
            <View style={[estilos.bloco, { gap: 12 }]}>
              {dados.automaticos.fixos.map((b) => (
                <BannerAutomatico key={b.id} banner={b} largura={largura} formato="fixo" />
              ))}
            </View>
          )}

          <View style={estilos.bloco}>
            <Texto variante="secao" style={{ marginBottom: 12 }}>
              Compre por ambiente
            </Texto>
            <View style={estilos.ambientes}>
              {AMBIENTES.map((a) => (
                <Pressable
                  key={a.nome}
                  onPress={() => router.push(linkAmbiente(a, dados.departamentos) as never)}
                  style={[estilos.ambiente, { backgroundColor: a.cor, width: (largura - 12) / 2 }]}>
                  <Imagem uri={`${SITE_URL}/img/categorias/${a.imagem}.svg`} style={{ flex: 1 }} />
                  <Texto variante="subtitulo">{a.nome}</Texto>
                </Pressable>
              ))}
            </View>
          </View>

          {dados.vitrines.map((v) => (
            <Prateleira key={v.slug} titulo={v.nome} produtos={v.produtos} />
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingBottom: 120 },
  departamentos: { paddingHorizontal: 16, gap: 12, marginTop: 24 },
  departamento: { width: 100, alignItems: 'center', gap: 6 },
  iconeDepartamento: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bloco: { paddingHorizontal: 16, marginTop: 28 },
  ambientes: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  ambiente: { aspectRatio: 4 / 3, borderRadius: raio.l, padding: 12, justifyContent: 'space-between' },
});
