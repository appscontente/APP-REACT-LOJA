import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Cupom } from '@/componentes/cupom';
import { Aviso } from '@/componentes/estado-tela';
import { ItemCarrinho } from '@/componentes/item-carrinho';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { textoMudanca, totais, useCarrinho, type MudancaCarrinho } from '@/estado/carrinho';
import { useConta } from '@/estado/conta';
import { useFigital } from '@/estado/figital';
import { DESCONTO_PIX, arredondar, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useCalculoCarrinho, useCupom } from '@/lib/use-calculo-carrinho';

type Linha = [string, string, string?];

/**
 * Carrinho do site. O carrinho de cada loja (Figital) é outro e aparece aqui só como atalho. Promoções e cupom são os
 * do site: depois de conferir os itens, o site recalcula o carrinho (use-calculo-carrinho) e o resumo mostra o que
 * ele devolveu; sem resposta, valem os totais locais da vitrine, com aviso.
 */
export default function Carrinho() {
  const topo = useSafeAreaInsets().top;
  const { itens, quantidadeTotal, atualizar } = useCarrinho();
  const { lojas } = useFigital();
  const conta = useConta();
  const lista = itens();
  const { subtotal, pix, economia } = totais(lista);
  const carrinhosLoja = lojas.filter((l) => quantidadeTotal(l.slug) > 0);
  const temIndisponivel = lista.some((i) => i.indisponivel);
  // Ao abrir, confere o carrinho guardado com o site: preço, desconto e disponibilidade de hoje.
  const [conferencia, setConferencia] = useState<{ mudancas: MudancaCarrinho[]; falhou?: boolean }>();
  useFocusEffect(
    useCallback(() => {
      let ativo = true;
      atualizar('site').then(
        (mudancas) => {
          if (!ativo) return;
          setConferencia({ mudancas });
          if (mudancas.length) AccessibilityInfo.announceForAccessibility(`Seu carrinho mudou. ${mudancas.map(textoMudanca).join(' ')}`);
        },
        () => ativo && setConferencia({ mudancas: [], falhou: true }),
      );
      return () => {
        ativo = false;
      };
    }, [atualizar]),
  );
  // Promoções e cupom do site, depois da conferência (com os itens já no preço e na disponibilidade de hoje) e do
  // cupom guardado. O e-mail da conta entra para promoções de audiência.
  const { cupom, pronto: cupomPronto, definir: definirCupom, limpar: limparCupom } = useCupom();
  const { resultado, carregando, erro: erroPromocoes } = useCalculoCarrinho(
    lista,
    { cupom: cupom || undefined, cliente: conta.logado ? conta.email : undefined },
    conferencia !== undefined && cupomPronto,
  );

  // Totais: os do site quando o cálculo chegou; antes dele (ou sem resposta), os locais da vitrine.
  const totalProdutos = resultado?.totalProdutos ?? subtotal;
  const noPix = resultado ? arredondar(totalProdutos - (resultado.descontoPix ?? totalProdutos * DESCONTO_PIX)) : pix;
  const freteGratis = resultado?.descontoFrete?.modo === 'percentual' && resultado.descontoFrete.valor === 100;
  const promocaoFrete = resultado?.descontoFrete
    ? (resultado.aplicadas.find((a) => a.id === resultado.descontoFrete?.promocao)?.nome ?? resultado.descontoFrete.promocao)
    : undefined;
  const linhas: Linha[] = [
    ['Produtos', formatarPreco(resultado?.subtotal ?? subtotal)],
    // Promoções de frete e de brinde também vêm em `aplicadas`, com valor zero: entram pelas linhas delas.
    ...(resultado?.aplicadas.filter((a) => a.valor > 0).map((a): Linha => [a.nome, `- ${formatarPreco(a.valor)}`, cores.sucesso]) ?? []),
    ...(resultado?.cupom?.valido ? [[`Cupom ${resultado.cupom.codigo}`, 'aplicado', cores.sucesso] as Linha] : []),
    ...(resultado?.brindes.map((b): Linha => [`Brinde: ${nomeLegivel(b.nome)} × ${b.quantidade}`, 'grátis', cores.sucesso]) ?? []),
    freteGratis ? ['Frete', 'grátis', cores.sucesso] : ['Frete', 'calculado no próximo passo'],
  ];
  // A economia já está nos preços "por": vai no rodapé, sem sinal de menos, para o total fechar.
  const rodape = [
    economia > 0 && `Você economiza ${formatarPreco(economia)}`,
    freteGratis && promocaoFrete && `Frete grátis com ${promocaoFrete}`,
    `ou ${formatarPreco(noPix)} no Pix`,
  ]
    .filter((t): t is string => typeof t === 'string')
    .join(' · ');
  // Sem repetição: duas configurações do mesmo conjunto que saíram do site dariam o mesmo aviso duas vezes.
  const avisos = [
    ...new Set([
      ...(conferencia?.falhou ? ['Não conseguimos conferir preço e disponibilidade agora. Confira a internet.'] : []),
      ...(conferencia?.mudancas.map(textoMudanca) ?? []),
      ...(erroPromocoes ? [erroPromocoes] : []),
    ]),
  ];

  return (
    <View style={[estilos.tela, { paddingTop: topo }]}>
      <Texto variante="titulo" style={estilos.titulo}>
        Carrinho
      </Texto>
      {/* O campo do cupom fica embaixo: no iPhone o teclado subiria por cima dele sem o ajuste do ScrollView. */}
      <ScrollView
        contentContainerStyle={estilos.conteudo}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets
        keyboardDismissMode="interactive">
        {carrinhosLoja.map((l) => (
          <Pressable key={l.slug} style={estilos.loja} onPress={() => router.push(rotaCarrinhoLoja(l.slug) as never)}>
            <Ionicons name="storefront" size={22} color={cores.texto} />
            <View style={{ flex: 1 }}>
              <Texto variante="forte">Carrinho da loja {l.nome}</Texto>
              <Texto variante="pequeno">
                {quantidadeTotal(l.slug)} {quantidadeTotal(l.slug) === 1 ? 'item' : 'itens'} para fechar no caixa ou pelo app
              </Texto>
            </View>
            <Ionicons name="chevron-forward" size={18} color={cores.texto} />
          </Pressable>
        ))}
        {lista.length === 0 ? (
          <Aviso
            titulo="Seu carrinho está vazio"
            texto="Que tal dar uma olhada nas ofertas da semana?"
            acao="Ver ofertas"
            aoTocar={() => router.push('/ofertas')}
            triste
          />
        ) : (
          <>
            {avisos.length ? (
              <View style={estilos.aviso}>
                <Ionicons name="information-circle" size={20} color={cores.aviso} />
                <View style={{ flex: 1, gap: 4 }}>
                  {avisos.map((texto) => (
                    <Texto key={texto} variante="pequeno" cor={cores.aviso}>
                      {texto}
                    </Texto>
                  ))}
                </View>
              </View>
            ) : null}
            {lista.map((i) => (
              <ItemCarrinho key={i.codprod} item={i} />
            ))}
            <View style={estilos.caixa}>
              <Cupom cupom={cupom} resultado={resultado?.cupom} carregando={carregando} aoAplicar={definirCupom} aoTirar={limparCupom} />
            </View>
            <View style={estilos.caixa}>
              <Resumo linhas={linhas} total={totalProdutos} rodape={rodape} />
              {temIndisponivel ? (
                <Texto variante="pequeno" cor={cores.marca} style={{ textAlign: 'center' }}>
                  Tire do carrinho os itens indisponíveis para continuar.
                </Texto>
              ) : null}
              <Botao titulo="Continuar" disabled={temIndisponivel || subtotal <= 0} onPress={() => router.push('/checkout')} />
              <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
                Frete e valor final são confirmados na próxima tela.
              </Texto>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  titulo: { paddingHorizontal: 16, paddingVertical: 12 },
  conteudo: { paddingHorizontal: 16, gap: 12, paddingBottom: 140 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 14, borderWidth: 1, borderColor: cores.borda },
  aviso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.avisoFundo },
  loja: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: raio.l, backgroundColor: cores.sorriso },
});
