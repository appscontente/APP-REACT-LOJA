// Produto visto dentro da loja (Figital), aberto pelo QR da etiqueta. Sem quantidades de estoque, só a solução de compra
// (regra do usuário, 2026-10-29): sai do CD, da loja ou de outra loja. Com uma peça só na loja, ela pode ser a de
// mostruário: o cliente aceita ou escolhe que saia de outro lugar. Sem descrição, o cliente fala com um vendedor pela
// conversa do app, não pelo WhatsApp.

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

const TEXTO_SAIDA = {
  cd: 'Disponível para levar: sai do nosso centro de distribuição, com entrega ou retirada.',
  loja: 'Disponível para levar: sai aqui da loja.',
  'outra-loja': 'Disponível para levar: sai de outra loja Casa Contente, com entrega ou retirada.',
  'peca-unica': 'Peça única nesta loja: pode ser a de mostruário. Na hora de pôr no carrinho, você escolhe.',
};

const OUTRO_LUGAR = { cd: 'Sair do centro de distribuição', 'outra-loja': 'Sair de outra loja' };

/** Peça única: aceitar a de mostruário ou, se houver, que saia de outro lugar. */
function escolherSaida(outroLugar: 'cd' | 'outra-loja' | undefined, aceitar: () => void, deOutroLugar: () => void) {
  const mensagem = `A peça de mostruário pode ter sinais de exposição; confira com um atendente.${
    outroLugar ? ' Se preferir, ela sai de outro lugar, com entrega ou retirada.' : ''
  }`;
  if (Platform.OS === 'web') {
    // No navegador só há OK e Cancelar: com outro lugar, Cancelar escolhe ele.
    const aviso = outroLugar ? `${mensagem}\n\nOK: aceito a peça de mostruário. Cancelar: ${OUTRO_LUGAR[outroLugar].toLowerCase()}.` : mensagem;
    if (window.confirm(aviso)) aceitar();
    else if (outroLugar) deOutroLugar();
    return;
  }
  Alert.alert('Peça única nesta loja', mensagem, [
    { text: 'Aceito a peça de mostruário', onPress: aceitar },
    ...(outroLugar ? [{ text: OUTRO_LUGAR[outroLugar], onPress: deOutroLugar }] : []),
    { text: 'Voltar', style: 'cancel' as const },
  ]);
}

export default function ProdutoNaLoja() {
  const { loja: slugLoja, slug } = useLocalSearchParams<{ loja: string; slug: string }>();
  const { width } = useWindowDimensions();
  const { lojas } = useFigital();
  const { adicionar, itens } = useCarrinho();
  const { iniciar } = useConversas();
  const loja = lojas.find((l) => l.slug === slugLoja);
  const { dados, erro, carregando, recarregar } = useDados(() => api.produtoNaLoja(slugLoja, { slug }), [slugLoja, slug]);

  if (!loja || (!dados && carregando)) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const { produto: p, origem } = dados;
  const nome = nomeLegivel(p.nome);
  const item = { ...p, imagem: p.imagens[0]?.src, estoque: origem.disponivel, origemEstoque: origem.origem };
  // Já no carrinho: a escolha (mostruário ou outro lugar) foi feita na primeira vez.
  const jaNoCarrinho = itens(loja.slug).some((i) => i.codprod === p.codprod);

  const conversar = () => {
    const id = iniciar({ loja: loja.slug, nomeLoja: loja.nome, assunto: nome, produto: item });
    router.push(`/conversas/${id}`);
  };
  const colocar = (saida: Partial<typeof item> & { mostruario?: boolean } = {}) => {
    adicionar({ ...item, ...saida }, loja.slug);
    router.push(rotaCarrinhoLoja(loja.slug) as never);
  };
  const { alternativa } = origem;
  const aoColocar = () =>
    origem.aviso && !jaNoCarrinho
      ? escolherSaida(
          alternativa?.origem,
          () => colocar({ mostruario: true }),
          () => alternativa && colocar({ origemEstoque: alternativa.origem, estoque: alternativa.disponivel }),
        )
      : colocar();

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
          <View style={estilos.saida}>
            <Ionicons
              name={origem.aviso ? 'information-circle' : origem.origem === 'loja' ? 'storefront-outline' : 'cube-outline'}
              size={20}
              color={origem.aviso ? cores.aviso : cores.marca}
            />
            <Texto variante="pequeno" cor={origem.aviso ? cores.aviso : cores.texto} style={{ flex: 1 }}>
              {origem.disponivel > 0 ? TEXTO_SAIDA[origem.aviso ?? origem.origem ?? 'cd'] : 'Sem peças disponíveis agora.'}
            </Texto>
          </View>
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
            onPress={aoColocar}
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
  saida: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  semDescricao: { gap: 12, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
});
