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
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Galeria } from '@/componentes/galeria';
import { Preco } from '@/componentes/preco';
import { TelaConjunto } from '@/componentes/tela-conjunto';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConversas } from '@/estado/conversas';
import { useLojas } from '@/estado/figital';
import { useRegraPagamento } from '@/estado/pagamento';
import { api } from '@/lib/api';
import { descontoAutoatendimento, maiorDesconto } from '@/lib/figital-descontos';
import { arredondar, formatarPreco, nomeLegivel } from '@/lib/formatar';
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

const pct = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 2 });

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
  const { lojas, erroLojas, tentarLojas } = useLojas();
  const { adicionar, itens } = useCarrinho();
  const { iniciar } = useConversas();
  // Parcelas na regra do site (a rota da loja não manda a do produto); o conjunto usa a mesma.
  const regra = useRegraPagamento();
  const loja = lojas.find((l) => l.slug === slugLoja);
  const { dados, erro, carregando, recarregar } = useDados(() => api.produtoNaLoja(slugLoja, { slug }), [slugLoja, slug]);
  // Conjunto não tem desconto do autoatendimento (o Happy responde motivo "conjunto"): nem consulta.
  const codprod = dados?.conjunto ? undefined : dados?.produto.codprod;
  const { dados: descontos } = useDados(
    () => (codprod ? api.descontos(slugLoja, [codprod]) : Promise.resolve({ itens: [] })),
    [slugLoja, codprod],
  );

  if (!lojas.length) return erroLojas ? <Erro mensagem="Não conseguimos carregar as lojas." tentar={tentarLojas} /> : <Carregando />;
  if (!loja) return <Aviso titulo="Loja não encontrada" acao="Voltar ao início" aoTocar={() => router.dismissTo('/')} triste />;
  if (!dados)
    return (
      <>
        <CabecalhoLoja loja={loja} titulo={carregando ? 'Abrindo produto…' : ''} />
        {carregando ? <Carregando /> : <Erro mensagem={erro ?? ''} tentar={recarregar} />}
      </>
    );
  // Conjunto (cozinha, cama box, mesa + cadeiras) visto pela loja: tela própria, com o estoque e a saída de cada peça
  // da loja. O `produto` que vem junto é o conjunto visto como produto; dele só vale a fração do Pix.
  if (dados.conjunto)
    return (
      <TelaConjunto
        dados={{ conjunto: dados.conjunto, pagamento: regra, taxaPix: dados.produto.descontoPix }}
        loja={loja}
        entregavel={dados.entregavel}
      />
    );
  const { produto: p, origem } = dados;
  const nome = nomeLegivel(p.nome);
  // Desconto do autoatendimento (Happy) deste item no Pix, nas duas colunas: no caixa e pagando pelo app.
  const tabela = descontos?.itens.find((d) => d.codprod === p.codprod);
  const umaUnidade = [{ codprod: p.codprod, preco: p.preco, quantidade: 1 }];
  const tabelas = tabela ? [tabela] : [];
  const pctCaixa = tabela?.descontos.pix?.caixa ?? 0;
  const pctApp = tabela?.descontos.pix?.site ?? 0;
  const noCaixa = arredondar(p.preco - descontoAutoatendimento(umaUnidade, tabelas, 'pix', 'caixa'));
  const peloApp = arredondar(p.preco - descontoAutoatendimento(umaUnidade, tabelas, 'pix', 'site'));
  const maior = Math.max(maiorDesconto(tabela, 'caixa'), maiorDesconto(tabela, 'site'));
  const item = { ...p, imagem: p.imagens[0]?.src, estoque: origem.disponivel, origemEstoque: origem.origem, entregavel: dados.entregavel };
  // Já no carrinho: a escolha (mostruário ou outro lugar) foi feita na primeira vez. Item que ficou indisponível não
  // conta: a saída escolhida acabou e o cliente escolhe de novo.
  const jaNoCarrinho = itens(loja.slug).some((i) => i.codprod === p.codprod && !i.indisponivel);

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
          {/* Com o item na tabela do Happy, o Pix da loja é o do bloco abaixo (no caixa e pelo app): o do site não entra. */}
          <Preco preco={p.preco} precoDe={p.precoDe} descontoPix={tabela ? 0 : p.descontoPix} tamanho="pagina" />
          {pctCaixa > 0 || pctApp > 0 ? (
            <View style={estilos.autoatendimento}>
              <Texto variante="rotulo">Desconto do autoatendimento</Texto>
              <View style={estilos.colunas}>
                <View style={estilos.coluna}>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    No caixa
                  </Texto>
                  <Texto variante="forte">{formatarPreco(noCaixa)}</Texto>
                  <Texto variante="pequeno">no Pix ou dinheiro{pctCaixa > 0 ? ` (${pct(pctCaixa)}% a menos)` : ', sem desconto'}</Texto>
                </View>
                <View style={estilos.coluna}>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    Pagando pelo app
                  </Texto>
                  {pctApp > 0 ? (
                    <>
                      <Texto variante="forte">{formatarPreco(peloApp)}</Texto>
                      <Texto variante="pequeno">no Pix ({pct(pctApp)}% a menos)</Texto>
                    </>
                  ) : (
                    <Texto variante="pequeno">vale o preço do site, mostrado acima</Texto>
                  )}
                </View>
              </View>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                {maior > Math.max(pctCaixa, pctApp) ? `Até ${pct(maior)}% conforme a forma de pagamento. ` : ''}No crédito, o desconto muda com as
                parcelas.
              </Texto>
            </View>
          ) : null}
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
  autoatendimento: { gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.creme },
  colunas: { flexDirection: 'row', gap: 12 },
  coluna: { flex: 1, gap: 2 },
  saida: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  semDescricao: { gap: 12, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
});
