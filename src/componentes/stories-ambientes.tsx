// Stories dos ambientes (pedido do dono em 05/11/2026, o mesmo do site): uma bolinha por loja; tocar abre a foto em
// tela cheia com o pin "Casa Contente {loja}", os produtos marcados e a legenda. Passa sozinha a cada 7 segundos e
// para enquanto um produto está aberto. Toque na esquerda volta, na direita avança.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores, fontes, raio } from '@/lib/tema';
import type { GrupoStories } from '@/lib/tipos';
import { FotoAmbiente } from './foto-ambiente';
import { Imagem } from './imagem';
import { Texto } from './texto';

const DURACAO_MS = 7000;

export function StoriesAmbientes({ grupos, titulo = 'Ambientes das lojas' }: { grupos: GrupoStories[]; titulo?: string }) {
  const [aberto, setAberto] = useState<number>();
  if (!grupos.length) return null;
  return (
    <View style={{ marginTop: 24 }}>
      <Texto variante="secao" style={{ paddingHorizontal: 16, marginBottom: 12 }}>
        {titulo}
      </Texto>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
        {grupos.map((g, i) => (
          <Pressable
            key={g.loja.slug}
            onPress={() => setAberto(i)}
            accessibilityRole="button"
            accessibilityLabel={`Ver ambientes da Casa Contente ${g.loja.nome} (${g.stories.length})`}
            style={estilos.bolinha}>
            <View style={estilos.aro}>
              <Imagem uri={g.stories[0].imagem.src} contentFit="cover" style={estilos.capa} />
            </View>
            <Texto variante="pequeno" numberOfLines={2} style={{ textAlign: 'center', fontSize: 12 }}>
              {g.loja.nome}
            </Texto>
          </Pressable>
        ))}
      </ScrollView>
      {aberto !== undefined && <Visualizador grupos={grupos} grupoInicial={aberto} fechar={() => setAberto(undefined)} />}
    </View>
  );
}

function Visualizador({ grupos, grupoInicial, fechar }: { grupos: GrupoStories[]; grupoInicial: number; fechar: () => void }) {
  const { width, height } = useWindowDimensions();
  const margem = useSafeAreaInsets();
  const [pos, setPos] = useState({ grupo: grupoInicial, story: 0 });
  const [produto, setProduto] = useState<number>();
  const [progresso, setProgresso] = useState(0);
  const andado = useRef(0);
  const grupo = grupos[pos.grupo];
  const story = grupo.stories[pos.story];
  const pausado = produto !== undefined;

  const ir = (passo: 1 | -1) => {
    setProduto(undefined);
    andado.current = 0;
    setProgresso(0);
    const s = pos.story + passo;
    if (s >= 0 && s < grupo.stories.length) return setPos({ ...pos, story: s });
    const g = pos.grupo + passo;
    if (g < 0) return setPos({ grupo: 0, story: 0 });
    if (g >= grupos.length) return fechar();
    setPos({ grupo: g, story: passo === 1 ? 0 : grupos[g].stories.length - 1 });
  };

  // Passa sozinho; com um produto aberto, para e retoma do mesmo ponto.
  useEffect(() => {
    if (pausado) return;
    const passo = setInterval(() => {
      andado.current += 100 / DURACAO_MS;
      if (andado.current >= 1) ir(1);
      else setProgresso(andado.current);
    }, 100);
    return () => clearInterval(passo);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- recomeça só ao trocar de story ou pausar
  }, [pausado, pos]);

  // A foto ocupa a largura e cabe na altura que sobra (pin em cima, legenda e botões embaixo).
  const { largura: l, altura: a } = story.imagem;
  const proporcao = l && a ? l / a : 3 / 4;
  const larguraFoto = Math.min(width - 16, (height - margem.top - margem.bottom - 190) * proporcao);

  return (
    <Modal visible animationType="fade" onRequestClose={fechar} statusBarTranslucent>
      <View style={[estilos.tela, { paddingTop: margem.top + 8, paddingBottom: margem.bottom + 8 }]}>
        <View style={estilos.barras}>
          {grupo.stories.map((s, i) => (
            <View key={s.slug} style={estilos.barra}>
              <View
                style={[
                  estilos.barraCheia,
                  { width: `${(i < pos.story ? 1 : i === pos.story ? Math.min(progresso, 1) : 0) * 100}%` },
                ]}
              />
            </View>
          ))}
        </View>
        <View style={estilos.topo}>
          <Pressable
            style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessibilityRole="link"
            accessibilityLabel={`Casa Contente ${grupo.loja.nome}: abrir a loja`}
            onPress={() => {
              fechar();
              router.push(`/loja/${grupo.loja.slug}` as never);
            }}>
            <Ionicons name="location" size={18} color={cores.marca} />
            <Texto style={estilos.pin} numberOfLines={1}>
              Casa Contente {grupo.loja.nome}
            </Texto>
          </Pressable>
          {story.autor?.tipo === 'parceiro' ? (
            <Texto variante="pequeno" cor="rgba(255,255,255,0.75)" numberOfLines={1}>
              por {story.autor.nome}
            </Texto>
          ) : null}
          <Pressable onPress={fechar} hitSlop={12} accessibilityRole="button" accessibilityLabel="Fechar">
            <Ionicons name="close" size={28} color="#fff" />
          </Pressable>
        </View>

        <View style={{ alignItems: 'center', flex: 1, justifyContent: 'center' }}>
          <View>
            <FotoAmbiente
              ambiente={story}
              largura={larguraFoto}
              aberto={produto}
              escuro
              aoSair={fechar}
              aoTocarMarcacao={setProduto}
            />
            {/* Toque fora das marcações: esquerda volta, direita avança (com um produto aberto, só fecha o cartão). */}
            {produto === undefined && (
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <Pressable
                  style={[estilos.zona, { left: 0, width: larguraFoto / 3 }]}
                  onPress={() => ir(-1)}
                  accessibilityRole="button"
                  accessibilityLabel="Ambiente anterior"
                />
                <Pressable
                  style={[estilos.zona, { right: 0, width: (larguraFoto * 2) / 3 }]}
                  onPress={() => ir(1)}
                  accessibilityRole="button"
                  accessibilityLabel="Próximo ambiente"
                />
              </View>
            )}
            {/* As marcações ficam por cima das zonas de toque. */}
            {produto === undefined && (
              <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                <FotoMarcacoes story={story} largura={larguraFoto} abrir={setProduto} />
              </View>
            )}
          </View>
        </View>

        <View style={{ paddingHorizontal: 12, gap: 10 }}>
          {story.legenda ? <Texto cor="#fff">{story.legenda}</Texto> : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            <Pressable
              style={estilos.botaoClaro}
              accessibilityRole="link"
              onPress={() => {
                fechar();
                router.push(`/ambientes/${story.slug}` as never);
              }}>
              <Texto style={[estilos.textoBotao, { color: cores.texto }]}>Ver os {story.itens.length} produtos</Texto>
            </Pressable>
            <Pressable
              style={estilos.botaoContorno}
              accessibilityRole="link"
              onPress={() => {
                fechar();
                router.push(`/loja/${grupo.loja.slug}` as never);
              }}>
              <Texto style={[estilos.textoBotao, { color: '#fff' }]}>Comprar na loja {grupo.loja.nome}</Texto>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

/** Só as marcações, por cima das zonas de toque (tocar abre o cartão do produto na foto). */
function FotoMarcacoes({
  story,
  largura,
  abrir,
}: {
  story: GrupoStories['stories'][number];
  largura: number;
  abrir: (n: number) => void;
}) {
  const { largura: l, altura: a } = story.imagem;
  const altura = largura / (l && a ? l / a : 3 / 4);
  return story.itens.map((i) => (
    <Pressable
      key={i.numero}
      onPress={() => abrir(i.numero)}
      hitSlop={8}
      // Só o alvo do dedo: o leitor de tela usa a marcação desenhada embaixo (com nome e preço).
      accessible={false}
      aria-hidden
      style={[estilos.alvo, { left: (i.x / 100) * largura - 18, top: (i.y / 100) * altura - 18 }]}
    />
  ));
}

const estilos = StyleSheet.create({
  bolinha: { width: 76, alignItems: 'center', gap: 6 },
  aro: { padding: 3, borderRadius: 40, borderWidth: 3, borderColor: cores.marca },
  capa: { width: 62, height: 62, borderRadius: 31, backgroundColor: cores.fundoAlt },
  tela: { flex: 1, backgroundColor: '#000' },
  barras: { flexDirection: 'row', gap: 4, paddingHorizontal: 12 },
  barra: { flex: 1, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  barraCheia: { height: 3, backgroundColor: '#fff' },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, paddingVertical: 10 },
  pin: { fontFamily: fontes.tituloMedio, fontSize: 16, color: '#fff', flexShrink: 1 },
  zona: { position: 'absolute', top: 0, bottom: 0 },
  alvo: { position: 'absolute', width: 36, height: 36, borderRadius: 18 },
  botaoClaro: { backgroundColor: '#fff', borderRadius: raio.pilula, paddingHorizontal: 16, paddingVertical: 10 },
  botaoContorno: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', borderRadius: raio.pilula, paddingHorizontal: 16, paddingVertical: 10 },
  textoBotao: { fontFamily: fontes.tituloMedio, fontSize: 14 },
});
