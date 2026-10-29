import { router, Stack } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Aviso } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { SITUACOES, useConta } from '@/estado/conta';
import { formatarDataHora, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';


/** Pedidos do cliente. Com o backend vêm também os do site e as compras nas lojas físicas (contrato, 17.5). */
export default function Pedidos() {
  const { pedidos } = useConta();
  return (
    <>
      <Stack.Screen options={{ title: 'Meus pedidos' }} />
      {!pedidos.length ? (
        <Aviso titulo="Nenhum pedido ainda" texto="Quando você comprar pelo app, pelo site ou nas lojas, o pedido aparece aqui." acao="Ver ofertas" aoTocar={() => router.push('/ofertas')} />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
          {pedidos.map((p) => {
            const s = SITUACOES[p.situacao];
            return (
              <Pressable key={p.numero} style={estilos.pedido} onPress={() => router.push(`/minha-conta/pedidos/${p.numero}`)}>
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
        </ScrollView>
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  pedido: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 6, borderWidth: 1, borderColor: cores.borda },
  situacao: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula, marginTop: 4 },
});
