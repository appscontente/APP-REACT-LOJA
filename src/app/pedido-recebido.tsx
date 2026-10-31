import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Sorriso } from '@/componentes/logo';
import { Texto } from '@/componentes/texto';
import { useConta } from '@/estado/conta';
import { formatarDataHora, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

const TEXTOS = {
  pix: 'Pague o Pix para confirmar o pedido. Avisamos aqui assim que o pagamento cair.',
  'cartao-pix':
    'O valor do cartão está reservado. Falta pagar o Pix: o pedido só é confirmado com ele. Se o Pix vencer, a reserva do cartão é desfeita.',
  cartao: 'Pagamento em análise. Avisamos aqui e por e-mail assim que for aprovado.',
} as const;

/**
 * Tela final como a do site: "Pedido recebido, pagamento em análise". Aprovado só depois da ClearSale e da captura.
 * Só abre para pedido feito neste celular: a rota traz apenas o número, e forma, valor e Pix vêm do pedido guardado
 * (com o backend, do GET do pedido com a sessão do cliente), nunca da URL.
 */
export default function PedidoRecebido() {
  const { numero } = useLocalSearchParams<{ numero?: string }>();
  const { pronto, pedidos } = useConta();
  const insets = useSafeAreaInsets();
  const pedido = numero ? pedidos.find((p) => p.numero === numero) : undefined;

  if (!pronto) {
    return (
      <View style={[estilos.tela, { justifyContent: 'center' }]}>
        <StatusBar style="light" />
        <ActivityIndicator color="#fff" />
      </View>
    );
  }
  // Link de fora ou número que não é deste celular: volta para o início.
  if (!pedido) return <Redirect href="/" />;

  const temPix = pedido.situacao === 'aguardando-pix' && (pedido.forma === 'pix' || pedido.forma === 'cartao-pix');
  const pix = pedido.pix;
  return (
    <View style={[estilos.tela, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}>
      <StatusBar style="light" />
      <View style={estilos.topo}>
        <Sorriso largura={120} />
        <Texto variante="titulo" cor="#fff" style={{ textAlign: 'center' }}>
          Pedido recebido!
        </Texto>
        <Texto cor="#fff" style={{ textAlign: 'center' }}>
          {temPix ? TEXTOS[pedido.forma] : TEXTOS.cartao}
        </Texto>
      </View>
      <View style={estilos.cartao}>
        <Texto cor={cores.textoSuave}>Número do pedido</Texto>
        <Texto variante="titulo">{pedido.numero}</Texto>
        {temPix ? (
          <View style={{ gap: 8 }}>
            {pix ? (
              <Texto variante="forte">
                {pedido.forma === 'cartao-pix' ? 'Falta pagar no Pix' : 'Valor do Pix'}: {formatarPreco(pix.valor)}
              </Texto>
            ) : null}
            {pix?.expiraEm ? (
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Pague até {formatarDataHora(pix.expiraEm)}.
              </Texto>
            ) : null}
            {pix?.imagemBase64 ? (
              <Image
                source={{ uri: `data:image/png;base64,${pix.imagemBase64}` }}
                style={estilos.qr}
                accessibilityLabel="QR do Pix"
              />
            ) : null}
            {pix?.copiaECola ? (
              <View style={estilos.codigo}>
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  Pix copia e cola (toque e segure para copiar)
                </Texto>
                <Texto variante="pequeno" selectable numberOfLines={3}>
                  {pix.copiaECola}
                </Texto>
              </View>
            ) : (
              <View style={estilos.pix}>
                <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
                  Demonstração: na versão final o QR do Pix e o botão “Copiar código” aparecem aqui.
                </Texto>
              </View>
            )}
          </View>
        ) : null}
        <Botao titulo="Acompanhar pedido" onPress={() => router.replace(`/minha-conta/pedidos/${pedido.numero}`)} />
        <Botao titulo="Voltar ao início" variante="contorno" onPress={() => router.dismissTo('/')} />
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.marca, paddingHorizontal: 16, justifyContent: 'space-between' },
  topo: { alignItems: 'center', gap: 12, paddingHorizontal: 16 },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.xl, padding: 20, gap: 12 },
  pix: { height: 120, borderRadius: raio.m, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.borda, alignItems: 'center', justifyContent: 'center', padding: 16 },
  qr: { width: 180, height: 180, alignSelf: 'center' },
  codigo: { borderRadius: raio.m, borderWidth: 1.5, borderColor: cores.borda, padding: 12, gap: 4 },
});
