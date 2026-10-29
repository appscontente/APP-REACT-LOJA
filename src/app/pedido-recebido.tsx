import { router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Sorriso } from '@/componentes/logo';
import { Texto } from '@/componentes/texto';
import { cores, raio } from '@/lib/tema';

/** Tela final como a do site: "Pedido recebido, pagamento em análise". Aprovado só depois da ClearSale e da captura. */
export default function PedidoRecebido() {
  const { numero, forma } = useLocalSearchParams<{ numero: string; forma: string }>();
  const insets = useSafeAreaInsets();
  return (
    <View style={[estilos.tela, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <View style={estilos.topo}>
        <Sorriso largura={120} />
        <Texto variante="titulo" cor="#fff" style={{ textAlign: 'center' }}>
          Pedido recebido!
        </Texto>
        <Texto cor="#fff" style={{ textAlign: 'center' }}>
          {forma === 'pix' ? 'Pague o Pix para confirmar o pedido. Avisamos aqui assim que o pagamento cair.' : 'Pagamento em análise. Avisamos aqui e por e-mail assim que for aprovado.'}
        </Texto>
      </View>
      <View style={estilos.cartao}>
        <Texto cor={cores.textoSuave}>Número do pedido</Texto>
        <Texto variante="titulo">{numero}</Texto>
        {forma === 'pix' && (
          <View style={estilos.pix}>
            <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
              Demonstração: na versão final o QR do Pix e o botão “Copiar código” aparecem aqui.
            </Texto>
          </View>
        )}
        <Botao titulo="Acompanhar pedido" onPress={() => router.replace(`/minha-conta/pedidos/${numero}`)} />
        <Botao titulo="Voltar ao início" variante="contorno" onPress={() => router.replace('/')} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.marca, paddingHorizontal: 16, justifyContent: 'space-between' },
  topo: { alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.xl, padding: 20, gap: 12 },
  pix: { height: 120, borderRadius: raio.m, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.borda, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
