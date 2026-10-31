import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Aviso } from '@/componentes/estado-tela';
import { ItemCarrinho } from '@/componentes/item-carrinho';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { totais, useCarrinho, type MudancaCarrinho } from '@/estado/carrinho';
import { useFigital } from '@/estado/figital';
import { formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';

const textoMudanca = (m: MudancaCarrinho) => {
  const nome = nomeLegivel(m.nome);
  if (m.tipo === 'preco') return `O preço de ${nome} mudou de ${formatarPreco(m.de)} para ${formatarPreco(m.para)}.`;
  if (m.tipo === 'quantidade') return `Ajustamos a quantidade de ${nome} ao que temos disponível.`;
  return `${nome} ficou indisponível.`;
};

/** Carrinho do site. O carrinho de cada loja (Figital) é outro e aparece aqui só como atalho. */
export default function Carrinho() {
  const topo = useSafeAreaInsets().top;
  const { itens, quantidadeTotal, atualizar } = useCarrinho();
  const { lojas } = useFigital();
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

  return (
    <View style={[estilos.tela, { paddingTop: topo }]}>
      <Texto variante="titulo" style={estilos.titulo}>
        Carrinho
      </Texto>
      <ScrollView contentContainerStyle={estilos.conteudo}>
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
            {conferencia?.mudancas.length || conferencia?.falhou ? (
              <View style={estilos.aviso}>
                <Ionicons name="information-circle" size={20} color={cores.aviso} />
                <View style={{ flex: 1, gap: 4 }}>
                  {conferencia.falhou ? (
                    <Texto variante="pequeno" cor={cores.aviso}>
                      Não conseguimos conferir preço e disponibilidade agora. Confira a internet.
                    </Texto>
                  ) : (
                    conferencia.mudancas.map((m) => (
                      <Texto key={`${m.tipo}${m.codprod}`} variante="pequeno" cor={cores.aviso}>
                        {textoMudanca(m)}
                      </Texto>
                    ))
                  )}
                </View>
              </View>
            ) : null}
            {lista.map((i) => (
              <ItemCarrinho key={i.codprod} item={i} />
            ))}
            <View style={estilos.caixa}>
              {/* A economia já está nos preços "por": vai no rodapé, sem sinal de menos, para o total fechar. */}
              <Resumo
                linhas={[
                  ['Produtos', formatarPreco(subtotal)],
                  ['Frete', 'calculado no próximo passo'],
                ]}
                total={subtotal}
                rodape={`${economia > 0 ? `Você economiza ${formatarPreco(economia)} · ` : ''}ou ${formatarPreco(pix)} no Pix`}
              />
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
