import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { SITUACOES, useConta } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

const ETAPAS = ['Pedido recebido', 'Pagamento aprovado', 'Em separação', 'Saiu para entrega', 'Entregue'];

/** Um pedido: situação, etapas, itens e "Preciso de ajuda", que abre a conversa com o número do pedido. */
export default function Pedido() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { pedidos } = useConta();
  const { iniciar } = useConversas();
  const pedido = pedidos.find((p) => p.numero === numero);
  if (!pedido) return <Aviso titulo="Pedido não encontrado" texto="Entre na sua conta para ver os pedidos do site e das lojas." acao="Minha conta" aoTocar={() => router.replace('/conta')} />;
  const s = SITUACOES[pedido.situacao];
  return (
    <>
      <Stack.Screen options={{ title: `Pedido ${pedido.numero}` }} />
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <View style={estilos.caixa}>
          <View style={[estilos.situacao, { backgroundColor: s.fundo }]}>
            <Texto variante="rotulo" cor={s.cor}>
              {s.texto}
            </Texto>
          </View>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Feito em {formatarDataHora(pedido.criadoEm)} pelo app
          </Texto>
          {ETAPAS.map((e, i) => (
            <View key={e} style={estilos.etapa}>
              <Ionicons name={i === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i === 0 ? cores.sucesso : cores.borda} />
              <Texto cor={i === 0 ? cores.texto : cores.textoSuave}>{pedido.entrega === 'retirada' && i === 3 ? 'Pronto para retirar' : e}</Texto>
            </View>
          ))}
        </View>
        <View style={estilos.caixa}>
          {pedido.itens.map((i) => (
            <View key={i.codprod} style={estilos.item}>
              <Imagem uri={i.imagem} style={{ width: 56, height: 56 }} />
              <View style={{ flex: 1 }}>
                <Texto variante="rotulo" numberOfLines={2}>
                  {nomeLegivel(i.nome)}
                </Texto>
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  {i.quantidade} × {formatarPreco(i.preco)}
                </Texto>
              </View>
            </View>
          ))}
          <View style={estilos.total}>
            <Texto variante="forte">Total</Texto>
            <Texto variante="forte">{formatarPreco(pedido.total)}</Texto>
          </View>
        </View>
        <Botao
          titulo="Preciso de ajuda com este pedido"
          variante="contorno"
          icone={<Ionicons name="chatbubble-ellipses-outline" size={20} color={cores.marca} />}
          onPress={() => {
            const id = iniciar({ nomeLoja: 'Casa Contente', assunto: `Pedido ${pedido.numero}`, pedido: pedido.numero });
            router.push(`/conversas/${id}`);
          }}
        />
      </ScrollView>
    </>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 10, borderWidth: 1, borderColor: cores.borda },
  situacao: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula },
  etapa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 10 },
});
