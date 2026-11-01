// Página do conjunto (cozinha modulada, cama box, mesa + cadeiras), no mesmo endereço do produto (/{slug}/p) e dentro
// da loja (/loja/{loja}/p/{slug}): fotos, nome, descrição, o configurador, frete pelo CEP (só fora da loja), as peças
// e a barra fixa com a conversa com a loja e o botão de comprar. Sem favorito: os favoritos buscam por CODPROD de
// produto, e o conjunto tem código próprio (KIT-...).

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { SITE_URL } from '@/lib/api';
import { fotosDoConjunto } from '@/lib/conjuntos';
import { formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaFigital, rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { ComponenteConjunto, ConjuntoApp, ConjuntoCompleto, LojaFisica } from '@/lib/tipos';
import { BarraCompra } from './barra-compra';
import { Botao } from './botao';
import { CabecalhoLoja } from './cabecalho-loja';
import { ConfiguradorConjunto } from './configurador-conjunto';
import { FreteCep } from './frete-cep';
import { Galeria } from './galeria';
import { Imagem } from './imagem';
import { Texto } from './texto';

const SEM_DESCRICAO = 'Consulte dados técnicos e garantia com um atendente.';

/**
 * A página inteira do conjunto. Com `loja`, é a Figital: cabeçalho amarelo da loja, estoque e saída de cada peça da
 * loja, conjunto no carrinho da loja e sem frete (a entrega é combinada no checkout ou no caixa).
 */
export function TelaConjunto({ dados, loja, entregavel }: { dados: ConjuntoApp; loja?: LojaFisica; entregavel?: boolean }) {
  const { conjunto, pagamento, taxaPix } = dados;
  const { width } = useWindowDimensions();
  const { iniciar } = useConversas();
  const { lojaAtual } = useFigital();
  const nome = nomeLegivel(conjunto.nome);
  const fotos = fotosDoConjunto(conjunto);

  const conversar = () => {
    // Dentro da loja, com a equipe dela; fora, com a loja onde o cliente está (modo loja) ou o atendimento do site.
    const alvo = loja ?? lojaAtual;
    const id = iniciar({ loja: alvo?.slug, nomeLoja: alvo?.nome ?? 'Casa Contente', assunto: nome });
    router.push(`/conversas/${id}`);
  };
  const compartilhar = () => Share.share({ message: `${nome} na Casa Contente: ${SITE_URL}${rotaProduto(conjunto)}` });

  return (
    <View style={{ flex: 1 }}>
      {loja ? (
        <CabecalhoLoja loja={loja} titulo="" />
      ) : (
        <Stack.Screen
          options={{
            title: '',
            headerRight: () => (
              <Pressable
                onPress={compartilhar}
                hitSlop={8}
                style={{ paddingRight: Platform.OS === 'web' ? 16 : 0 }}
                accessibilityRole="button"
                accessibilityLabel="Compartilhar">
                <Ionicons name="share-social-outline" size={22} color={cores.texto} />
              </Pressable>
            ),
          }}
        />
      )}
      <ConfiguradorConjunto conjunto={conjunto} pagamento={pagamento} taxaPix={taxaPix} loja={loja} entregavel={entregavel}>
        {({ montagem, total, botao, aviso }) => (
          <>
            <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
              <Galeria imagens={fotos} largura={Math.min(width, 600)} />
              <View style={estilos.corpo}>
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  Conjunto · código {conjunto.id}
                </Texto>
                <Texto variante="titulo" accessibilityRole="header">
                  {nome}
                </Texto>
                {conjunto.descricao ? (
                  <Texto>{conjunto.descricao}</Texto>
                ) : loja ? (
                  // Sem descrição na loja: o texto e o botão de conversar, como na página do produto na loja.
                  <View style={estilos.semDescricao}>
                    <Texto>{SEM_DESCRICAO}</Texto>
                    <Botao
                      titulo="Conversar com a loja"
                      variante="contorno"
                      icone={<Ionicons name="chatbubble-ellipses-outline" size={18} color={cores.marca} />}
                      onPress={conversar}
                    />
                  </View>
                ) : null}
                {montagem}
                {!loja && total > 0 ? <FreteCep valor={total} /> : null}
                <Pecas conjunto={conjunto} loja={loja} />
              </View>
            </ScrollView>
            <BarraCompra aoConversar={conversar} aviso={aviso}>
              {botao}
            </BarraCompra>
          </>
        )}
      </ConfiguradorConjunto>
    </View>
  );
}

/** Todas as peças que entram no conjunto, com foto, preço e medidas; a que tem página própria abre com um toque. */
function Pecas({ conjunto, loja }: { conjunto: ConjuntoCompleto; loja?: LojaFisica }) {
  const pecas = Object.values(conjunto.componentes);
  if (!pecas.length) return null;
  return (
    <View style={{ gap: 8, marginTop: 8 }}>
      <Texto variante="secao" accessibilityRole="header">
        Peças do conjunto
      </Texto>
      <View style={estilos.lista}>
        {pecas.map((c) => (
          <Peca key={c.codprod} peca={c} href={c.temPagina ? (loja ? rotaFigital(loja.slug, c.slug) : rotaProduto(c)) : undefined} />
        ))}
      </View>
    </View>
  );
}

const cm = (m: NonNullable<ComponenteConjunto['medidas']>) =>
  m.altura && m.largura && m.profundidade ? `${m.altura} × ${m.largura} × ${m.profundidade} cm (A × L × P)` : undefined;

function Peca({ peca: c, href }: { peca: ComponenteConjunto; href?: string }) {
  const nome = nomeLegivel(c.nome);
  const medidas = c.medidas ? cm(c.medidas) : undefined;
  const conteudo = (
    <>
      <Imagem uri={c.imagem} style={estilos.fotoPeca} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo" numberOfLines={2}>
          {nome}
        </Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {formatarPreco(c.preco)} cada
        </Texto>
        {medidas ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {medidas}
          </Texto>
        ) : null}
      </View>
      {href ? <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} /> : null}
    </>
  );
  if (!href)
    return (
      <View style={estilos.peca} accessible accessibilityLabel={`${nome}, ${formatarPreco(c.preco)} cada`}>
        {conteudo}
      </View>
    );
  return (
    <Pressable
      onPress={() => router.push(href as never)}
      style={estilos.peca}
      accessibilityRole="link"
      accessibilityLabel={`${nome}, ${formatarPreco(c.preco)} cada. Ver a peça`}>
      {conteudo}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  corpo: { padding: 16, gap: 12 },
  semDescricao: { gap: 12, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
  lista: { borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie, overflow: 'hidden' },
  peca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  fotoPeca: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: '#fff' },
});
