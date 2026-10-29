// Produto visto dentro da loja (Figital), aberto pelo QR da etiqueta: estoque do CD e da loja, de onde a peça sai e
// as regras do site (baixa primeiro do CD; aviso "estoque da loja"; confirmação na última peça exposta). Sem descrição,
// o cliente fala com um vendedor pela conversa do app, não pelo WhatsApp.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, Platform, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AbasProduto } from '@/componentes/abas-produto';
import { BarraCompra } from '@/componentes/barra-compra';
import { Botao } from '@/componentes/botao';
import { CabecalhoLoja } from '@/componentes/cabecalho-loja';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { Galeria } from '@/componentes/galeria';
import { Preco } from '@/componentes/preco';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { nomeLegivel } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

const SEM_DESCRICAO = 'Consulte dados técnicos e garantia com um atendente.';

function confirmar(mensagem: string, aoConfirmar: () => void) {
  if (Platform.OS === 'web') {
    if (window.confirm(mensagem)) aoConfirmar();
    return;
  }
  Alert.alert('Última peça da loja', mensagem, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Quero esta peça', onPress: aoConfirmar },
  ]);
}

export default function ProdutoNaLoja() {
  const { loja: slugLoja, slug } = useLocalSearchParams<{ loja: string; slug: string }>();
  const { width } = useWindowDimensions();
  const { lojas } = useFigital();
  const { adicionar } = useCarrinho();
  const { iniciar } = useConversas();
  const loja = lojas.find((l) => l.slug === slugLoja);
  const { dados, erro, carregando, recarregar } = useDados(() => api.produtoNaLoja(slugLoja, { slug }), [slugLoja, slug]);

  if (!loja || (!dados && carregando)) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const { produto: p, estoqueCD, estoqueLoja, origem } = dados;
  const nome = nomeLegivel(p.nome);
  const item = { ...p, imagem: p.imagens[0]?.src, estoque: origem.disponivel };

  const conversar = () => {
    const id = iniciar({ loja: loja.slug, nomeLoja: loja.nome, assunto: nome, produto: item });
    router.push(`/conversas/${id}`);
  };
  const colocar = () => {
    adicionar(item, loja.slug);
    router.push(rotaCarrinhoLoja(loja.slug) as never);
  };

  return (
    <View style={{ flex: 1 }}>
      <CabecalhoLoja loja={loja} titulo="" />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        <Galeria imagens={p.imagens} largura={Math.min(width, 600)} />
        <View style={estilos.corpo}>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {p.marca} · etiqueta {p.codprod}
          </Texto>
          <Texto variante="titulo">{nome}</Texto>
          <Preco preco={p.preco} precoDe={p.precoDe} descontoPix={p.descontoPix} tamanho="pagina" />
          <View style={estilos.estoques}>
            <View style={estilos.estoque}>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                No CD
              </Texto>
              <Texto variante="subtitulo">{estoqueCD}</Texto>
            </View>
            <View style={estilos.estoque}>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Nesta loja
              </Texto>
              <Texto variante="subtitulo">{estoqueLoja}</Texto>
            </View>
          </View>
          {origem.aviso ? (
            <View style={estilos.aviso}>
              <Ionicons name="information-circle" size={20} color={cores.aviso} />
              <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
                {origem.aviso === 'ultima-peca'
                  ? 'Esta é a última peça da loja, a que está exposta. Você leva ela mesma.'
                  : 'Sai do estoque da loja: o CD não tem esta peça agora.'}
              </Texto>
            </View>
          ) : null}
          {!p.descricao ? (
            <View style={estilos.semDescricao}>
              <Texto>{SEM_DESCRICAO}</Texto>
              <Botao
                titulo="Conversar com a loja"
                variante="contorno"
                icone={<Ionicons name="chatbubble-ellipses-outline" size={18} color={cores.marca} />}
                onPress={conversar}
              />
            </View>
          ) : (
            <AbasProduto produto={p} />
          )}
        </View>
      </ScrollView>
      <BarraCompra aoConversar={conversar}>
        {origem.disponivel > 0 ? (
          <Botao
            titulo="Pôr no carrinho da loja"
            onPress={() =>
              origem.aviso === 'ultima-peca' ? confirmar('É a peça exposta na loja. Quer levar mesmo assim?', colocar) : colocar()
            }
          />
        ) : (
          <Botao titulo="Sem estoque agora" variante="contorno" disabled />
        )}
      </BarraCompra>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { padding: 16, gap: 12 },
  estoques: { flexDirection: 'row', gap: 10 },
  estoque: { flex: 1, backgroundColor: cores.superficie, borderRadius: raio.m, padding: 12, borderWidth: 1, borderColor: cores.borda },
  aviso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.avisoFundo },
  semDescricao: { gap: 12, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
});
