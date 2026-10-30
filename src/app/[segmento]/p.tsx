// Página do produto, no mesmo endereço do site (/{slug}/p): fotos, preço de/por, Pix e parcelas, frete pelo CEP,
// descrição, medidas e ficha técnica, "Combina com" e a barra fixa com a conversa com a loja e o carrinho.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AbasProduto } from '@/componentes/abas-produto';
import { BarraCompra } from '@/componentes/barra-compra';
import { Botao } from '@/componentes/botao';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { FreteCep } from '@/componentes/frete-cep';
import { Galeria } from '@/componentes/galeria';
import { Prateleira } from '@/componentes/prateleira';
import { Preco } from '@/componentes/preco';
import { Selo } from '@/componentes/selo';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConta } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { api, SITE_URL } from '@/lib/api';
import { descontoExibido, nomeLegivel } from '@/lib/formatar';
import { rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function PaginaProduto() {
  const { segmento: slug } = useLocalSearchParams<{ segmento: string }>();
  const { width } = useWindowDimensions();
  const { dados, erro, carregando, recarregar } = useDados(() => api.produto(slug), [slug]);
  const { adicionar } = useCarrinho();
  const { favorito, alternarFavorito } = useConta();
  const { iniciar } = useConversas();
  const { lojaAtual } = useFigital();

  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const { produto: p, combinaCom, pagamento } = dados;
  const desconto = descontoExibido(p);
  const nome = nomeLegivel(p.nome);
  const marcado = favorito(p.codprod);
  const item = { ...p, imagem: p.imagens[0]?.src };

  const conversar = () => {
    // Quem está numa loja física fala com a equipe daquela loja; fora dela, com o atendimento do site.
    const id = iniciar({ loja: lojaAtual?.slug, nomeLoja: lojaAtual?.nome ?? 'Casa Contente', assunto: nome, produto: item });
    router.push(`/conversas/${id}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
              <Pressable
                onPress={() => Share.share({ message: `${nome} na Casa Contente: ${SITE_URL}${rotaProduto(p)}` })}
                hitSlop={8}
                accessibilityLabel="Compartilhar">
                <Ionicons name="share-social-outline" size={22} color={cores.texto} />
              </Pressable>
              <Pressable onPress={() => alternarFavorito(p.codprod)} hitSlop={8} accessibilityLabel={marcado ? 'Tirar dos favoritos' : 'Guardar nos favoritos'}>
                <Ionicons name={marcado ? 'heart' : 'heart-outline'} size={22} color={marcado ? cores.marca : cores.texto} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        <Galeria imagens={p.imagens} largura={Math.min(width, 600)} />
        <View style={estilos.corpo}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {desconto > 0 && <Selo texto={`${desconto}% OFF`} />}
            {p.selos?.map((s) => <Selo key={s.texto} texto={s.texto} cor={s.cor} />)}
          </View>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {p.marca} · código {p.codprod}
          </Texto>
          <Texto variante="titulo">{nome}</Texto>
          {p.estoque > 0 ? (
            <Preco preco={p.preco} precoDe={p.precoDe} descontoPix={p.descontoPix} pagamento={pagamento} tamanho="pagina" />
          ) : (
            <Texto variante="subtitulo" cor={cores.textoSuave}>
              Esgotado no momento
            </Texto>
          )}
          {p.sujeitoConfirmacao ? (
            <View style={estilos.aviso}>
              <Ionicons name="information-circle" size={20} color={cores.aviso} />
              <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
                Peça de exposição numa das nossas lojas. A equipe confirma a peça antes de cobrar.
              </Texto>
            </View>
          ) : p.estoque > 0 && p.estoque <= 3 ? (
            <Texto variante="rotulo" cor={cores.marca}>
              Últimas {p.estoque} unidades
            </Texto>
          ) : null}
          <FreteCep valor={p.preco} />
          <AbasProduto produto={p} />
        </View>
        <Prateleira titulo="Combina com" produtos={combinaCom} />
      </ScrollView>
      <BarraCompra aoConversar={conversar}>
        {p.estoque > 0 ? (
          <Botao
            titulo="Adicionar ao carrinho"
            onPress={() => {
              adicionar(item);
              router.push('/carrinho');
            }}
          />
        ) : (
          <Botao titulo="Avise-me quando chegar" variante="contorno" onPress={() => alternarFavorito(p.codprod)} />
        )}
      </BarraCompra>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { padding: 16, gap: 12 },
  aviso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.avisoFundo },
});
