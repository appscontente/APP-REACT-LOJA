import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Aviso } from '@/componentes/estado-tela';
import { ItemCarrinho } from '@/componentes/item-carrinho';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { totais, useCarrinho } from '@/estado/carrinho';
import { useFigital } from '@/estado/figital';
import { formatarPreco } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';

/** Carrinho do site. O carrinho de cada loja (Figital) é outro e aparece aqui só como atalho. */
export default function Carrinho() {
  const topo = useSafeAreaInsets().top;
  const { itens, quantidadeTotal } = useCarrinho();
  const { lojas } = useFigital();
  const lista = itens();
  const { subtotal, pix, economia } = totais(lista);
  const carrinhosLoja = lojas.filter((l) => quantidadeTotal(l.slug) > 0);

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
            {lista.map((i) => (
              <ItemCarrinho key={i.codprod} item={i} />
            ))}
            <View style={estilos.caixa}>
              <Resumo
                linhas={[
                  ['Produtos', formatarPreco(subtotal)],
                  ...(economia > 0 ? [['Você economiza', `- ${formatarPreco(economia)}`, cores.sucesso] as [string, string, string]] : []),
                  ['Frete', 'calculado no próximo passo'],
                ]}
                total={subtotal}
                rodape={`ou ${formatarPreco(pix)} no Pix`}
              />
              <Botao titulo="Continuar" onPress={() => router.push('/checkout')} />
              <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
                Cupom, frete e o valor final são confirmados na próxima tela.
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
  loja: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: raio.l, backgroundColor: cores.sorriso },
});
