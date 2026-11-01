import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { situacaoDe, useConta } from '@/estado/conta';
import { useLojas } from '@/estado/figital';
import { formatarDataHora, formatarHora, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

/**
 * Pedidos do cliente e, antes deles, os comprovantes das lojas que ainda faltam pagar no caixa (um toque abre o
 * comprovante no carrinho daquela loja). Os comprovantes ficam no celular e aparecem mesmo sem login; os pedidos, com
 * o backend, vêm também do site e das compras nas lojas físicas (contrato, 17.5).
 */
export default function Pedidos() {
  const { pedidos, logado, pronto } = useConta();
  const { lojas, todosComprovantes } = useLojas();
  const comprovantes = todosComprovantes();
  const baixo = useSafeAreaInsets().bottom;
  const entrar = () => router.dismissTo({ pathname: '/conta', params: { voltar: '/minha-conta/pedidos' } });
  const conteudo = () => {
    if (!pronto) return <Carregando />;
    // Sem pedido e sem comprovante, a tela é só o convite (entrar ou ver as ofertas).
    if (!pedidos.length && !comprovantes.length && !logado)
      return <Aviso titulo="Entre para ver seus pedidos" texto="Suas compras pelo site e pelo app aparecem aqui." acao="Entrar" aoTocar={entrar} />;
    if (!pedidos.length && !comprovantes.length)
      return <Aviso titulo="Nenhum pedido ainda" texto="Quando você comprar pelo app ou pelo site, o pedido aparece aqui." acao="Ver ofertas" aoTocar={() => router.push('/ofertas')} />;
    return (
      // Folga embaixo para o botão fixo "Na loja" não cobrir o último pedido.
      <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 + baixo }}>
        {comprovantes.length ? (
          <View style={{ gap: 8 }}>
            <Texto variante="secao" accessibilityRole="header">
              Para pagar no caixa
            </Texto>
            {comprovantes.map(({ loja, comprovante: c }) => {
              const nomeLoja = lojas.find((l) => l.slug === loja)?.nome ?? loja;
              const quantidade = c.itens.reduce((s, i) => s + i.quantidade, 0);
              const itens = `${quantidade} ${quantidade === 1 ? 'item' : 'itens'}`;
              const validade = `válido até ${formatarHora(c.expiraEm)}`;
              return (
                <Pressable
                  key={`${loja}-${c.numero}`}
                  style={estilos.comprovante}
                  accessibilityRole="button"
                  accessibilityLabel={`Comprovante número ${c.numero} da loja ${nomeLoja}, ${formatarPreco(c.total)}, ${itens}, ${validade}. Abrir`}
                  // O carrinho da loja abre o comprovante deste número ("1" continua abrindo o mais recente).
                  onPress={() => router.push({ pathname: '/loja/[loja]/carrinho', params: { loja, comprovante: c.numero } })}>
                  <Ionicons name="storefront" size={22} color={cores.texto} />
                  <View style={{ flex: 1, gap: 2 }}>
                    <Texto variante="forte">Loja {nomeLoja}</Texto>
                    <Texto variante="pequeno">
                      Nº {c.numero} · {formatarPreco(c.total)} · {itens}
                    </Texto>
                    <Texto variante="pequeno" cor={cores.textoSuave}>
                      {validade}
                    </Texto>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={cores.texto} />
                </Pressable>
              );
            })}
          </View>
        ) : null}
        {pedidos.length ? (
          <View style={{ gap: 12 }}>
            {comprovantes.length ? (
              <Texto variante="secao" accessibilityRole="header">
                Pedidos
              </Texto>
            ) : null}
            {pedidos.map((p) => {
              const s = situacaoDe(p.situacao);
              return (
                <Pressable
                  key={p.numero}
                  style={estilos.pedido}
                  accessibilityRole="button"
                  accessibilityLabel={`Pedido ${p.numero}, ${formatarPreco(p.total)}, ${s.texto}. Abrir`}
                  onPress={() => router.push(`/minha-conta/pedidos/${p.numero}`)}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Texto variante="forte">Pedido {p.numero}</Texto>
                    <Texto variante="forte">{formatarPreco(p.total)}</Texto>
                  </View>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    {formatarDataHora(p.criadoEm)} · {p.itens.length} {p.itens.length === 1 ? 'produto' : 'produtos'}
                  </Texto>
                  <View style={[estilos.situacao, { backgroundColor: s.fundo }]}>
                    <Texto variante="rotulo" cor={s.cor}>
                      {s.texto}
                    </Texto>
                  </View>
                </Pressable>
              );
            })}
          </View>
        ) : !logado ? (
          <Aviso titulo="Entre para ver seus pedidos" texto="Suas compras pelo site e pelo app aparecem aqui." acao="Entrar" aoTocar={entrar} />
        ) : (
          <Aviso titulo="Nenhum pedido ainda" texto="Quando você comprar pelo app ou pelo site, o pedido aparece aqui." acao="Ver ofertas" aoTocar={() => router.push('/ofertas')} />
        )}
      </ScrollView>
    );
  };
  return (
    <>
      <Stack.Screen options={{ title: 'Meus pedidos' }} />
      {conteudo()}
    </>
  );
}

const estilos = StyleSheet.create({
  pedido: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 6, borderWidth: 1, borderColor: cores.borda },
  situacao: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula, marginTop: 4 },
  // Amarelo da loja, como o atalho do carrinho da loja na aba Carrinho.
  comprovante: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, minHeight: 64, borderRadius: raio.l, backgroundColor: cores.sorriso },
});
