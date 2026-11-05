// /ambientes/{slug}, o mesmo endereço do site: a foto com as marcações, o pin da loja e a lista dos produtos.
// Produto vendido só na loja leva à Figital (/loja/{loja}/p/{slug}); produto sem foto pede fotos pela conversa.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { FotoAmbiente, usePedirFotos } from '@/componentes/foto-ambiente';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { api } from '@/lib/api';
import { formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function Ambiente() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const largura = Math.min(useWindowDimensions().width, 600) - 32;
  const { dados, erro, carregando, recarregar } = useDados(() => api.ambientes(), []);
  const [aberto, setAberto] = useState<number>();
  const pedirFotos = usePedirFotos();
  const ambiente = dados?.ambientes.find((a) => a.slug === slug);

  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  if (!ambiente)
    return (
      <Aviso
        titulo="Este ambiente saiu do ar"
        texto="Os produtos podem ter acabado. Veja os outros ambientes."
        acao="Ver os ambientes"
        aoTocar={() => router.replace('/ambientes' as never)}
      />
    );

  return (
    <>
      <Stack.Screen options={{ title: ambiente.nome }} />
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 120, gap: 12 }}>
        {ambiente.loja ? (
          <Pressable
            style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
            accessibilityRole="link"
            onPress={() => router.push(`/loja/${ambiente.loja!.slug}` as never)}>
            <Ionicons name="location" size={18} color={cores.marca} />
            <Texto variante="forte">Casa Contente {ambiente.loja.nome}</Texto>
            <Texto variante="pequeno" cor={cores.marca} style={{ marginLeft: 'auto' }}>
              Comprar nesta loja
            </Texto>
          </Pressable>
        ) : null}
        {ambiente.legenda ? <Texto cor={cores.textoSuave}>{ambiente.legenda}</Texto> : null}
        {ambiente.autor?.tipo === 'parceiro' ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Ambiente montado por {ambiente.autor.nome}
          </Texto>
        ) : null}
        <FotoAmbiente ambiente={ambiente} largura={largura} aberto={aberto} aoTocarMarcacao={setAberto} />
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Toque nos números da foto para ver cada produto.
        </Texto>

        <Texto variante="secao" style={{ marginTop: 12 }}>
          Produtos deste ambiente
        </Texto>
        <View style={estilos.lista}>
          {ambiente.itens.map((i) => (
            <View key={i.numero} style={estilos.linha}>
              <Texto style={estilos.numero}>{i.numero}</Texto>
              <Pressable onPress={() => router.push(i.href as never)} accessibilityRole="link" style={{ flexDirection: 'row', flex: 1, gap: 10 }}>
                <Imagem uri={i.foto} style={estilos.foto} />
                <View style={{ flex: 1 }}>
                  <Texto variante="forte" numberOfLines={2}>
                    {i.nome}
                  </Texto>
                  <Texto variante="pequeno">
                    {formatarPreco(i.preco)}
                    {i.soNaLoja && ambiente.loja ? ` · na loja ${ambiente.loja.nome}` : ''}
                    {!i.disponivel ? ' · indisponível' : ''}
                  </Texto>
                </View>
              </Pressable>
              {!i.foto && ambiente.loja ? (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Pedir fotos e detalhes de ${i.nome}`}
                  hitSlop={8}
                  onPress={() => {
                    const id = pedirFotos(ambiente, i);
                    if (id) router.push(`/conversas/${id}` as never);
                  }}
                  style={estilos.pedir}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={cores.marca} />
                  <Texto variante="rotulo" cor={cores.marca}>
                    Pedir fotos
                  </Texto>
                </Pressable>
              ) : null}
            </View>
          ))}
        </View>
      </ScrollView>
    </>
  );
}

const estilos = StyleSheet.create({
  lista: { backgroundColor: cores.superficie, borderRadius: raio.xl, borderWidth: 1, borderColor: cores.borda, paddingHorizontal: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: cores.borda },
  numero: { width: 28, height: 28, borderRadius: 14, backgroundColor: cores.fundoAlt, textAlign: 'center', lineHeight: 28 },
  foto: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: cores.fundoAlt },
  pedir: { flexDirection: 'row', alignItems: 'center', gap: 4, borderWidth: 1, borderColor: cores.borda, borderRadius: raio.pilula, paddingHorizontal: 10, paddingVertical: 6 },
});
