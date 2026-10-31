import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Image, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Aviso, Carregando } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { situacaoDe, useConta, type PedidoApp } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

const ETAPAS = ['Pedido recebido', 'Pagamento aprovado', 'Em separação', 'Saiu para entrega', 'Entregue'];
const ETAPAS_RETIRADA = ['Pedido recebido', 'Pagamento aprovado', 'Em separação', 'Pronto para retirar', 'Retirado'];

/**
 * Pix que falta pagar (Pix sozinho ou cartão + Pix). Com o backend, o código, o QR e o prazo vêm de pagamento.pendente.pix
 * de GET /clientes/eu/pedidos/{numero} (contrato 17.12). O botão "Copiar código" pede o expo-clipboard, que ainda não está
 * no projeto: por enquanto o código é selecionável (tocar e segurar para copiar).
 */
function FaltaPagarPix({ pedido }: { pedido: PedidoApp }) {
  const valor = pedido.pix?.valor ?? (pedido.forma === 'pix' ? pedido.total : undefined);
  const { copiaECola, imagemBase64, expiraEm } = pedido.pix ?? {};
  return (
    <View style={[estilos.caixa, estilos.pix]}>
      <Texto variante="subtitulo">Falta pagar o Pix</Texto>
      {valor ? <Texto variante="forte">{formatarPreco(valor)}</Texto> : null}
      <Texto variante="pequeno" cor={cores.textoSuave}>
        {pedido.forma === 'cartao-pix'
          ? 'O valor do cartão está reservado. O pedido só é confirmado com o Pix; se ele vencer, a reserva do cartão é desfeita.'
          : 'O pedido só é confirmado depois que o Pix for pago.'}
        {expiraEm ? ` Pague até ${formatarDataHora(expiraEm)}.` : ''}
      </Texto>
      {imagemBase64 ? <Image source={{ uri: `data:image/png;base64,${imagemBase64}` }} style={estilos.qr} accessibilityLabel="QR do Pix" /> : null}
      {copiaECola ? (
        <>
          <Texto variante="pequeno" selectable style={estilos.codigo}>
            {copiaECola}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Toque e segure o código para copiar.
          </Texto>
        </>
      ) : (
        <View style={estilos.demonstracao}>
          <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
            Demonstração: na versão final o QR do Pix e o botão “Copiar código” aparecem aqui.
          </Texto>
        </View>
      )}
    </View>
  );
}

/** Um pedido: situação, etapas, itens e "Preciso de ajuda", que abre a conversa com o número do pedido. */
export default function Pedido() {
  const { numero } = useLocalSearchParams<{ numero: string }>();
  const { pedidos, pronto, logado } = useConta();
  const { iniciar } = useConversas();
  const { lojas } = useFigital();
  const baixo = useSafeAreaInsets().bottom;
  const pedido = pedidos.find((p) => p.numero === numero);
  // Aberto por link a frio: espera ler o celular antes de dizer que o pedido não existe.
  if (!pronto) return <Carregando />;
  if (!pedido && !logado)
    return (
      <Aviso
        titulo="Entre para ver este pedido"
        texto="Depois de entrar, voltamos para ele."
        acao="Entrar"
        aoTocar={() => router.dismissTo({ pathname: '/conta', params: { voltar: `/minha-conta/pedidos/${numero}` } })}
      />
    );
  if (!pedido)
    return (
      <Aviso
        titulo="Pedido não encontrado"
        texto="Por enquanto o app mostra só os pedidos feitos nele, neste celular."
        acao="Meus pedidos"
        aoTocar={() => router.replace('/minha-conta/pedidos')}
      />
    );
  const s = situacaoDe(pedido.situacao);
  return (
    <>
      <Stack.Screen options={{ title: `Pedido ${pedido.numero}` }} />
      {/* Folga embaixo para o botão fixo "Na loja" não cobrir "Preciso de ajuda". */}
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingBottom: 120 + baixo }]}>
        <View style={estilos.caixa}>
          <View style={[estilos.situacao, { backgroundColor: s.fundo }]}>
            <Texto variante="rotulo" cor={s.cor}>
              {s.texto}
            </Texto>
          </View>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Feito em {formatarDataHora(pedido.criadoEm)} pelo app
          </Texto>
          {(pedido.entrega === 'retirada' ? ETAPAS_RETIRADA : ETAPAS).map((e, i) => (
            <View key={e} style={estilos.etapa}>
              <Ionicons name={i === 0 ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={i === 0 ? cores.sucesso : cores.borda} />
              <Texto cor={i === 0 ? cores.texto : cores.textoSuave}>{e}</Texto>
            </View>
          ))}
        </View>
        {pedido.situacao === 'aguardando-pix' ? <FaltaPagarPix pedido={pedido} /> : null}
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
            // Pedido de retirada ou feito na loja: fala com a equipe dessa loja. Entrega em casa: atendimento do site.
            const loja = lojas.find((l) => l.slug === pedido.loja);
            const id = iniciar({ loja: loja?.slug, nomeLoja: loja?.nome ?? 'Casa Contente', assunto: `Pedido ${pedido.numero}`, pedido: pedido.numero });
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
  pix: { borderColor: cores.sorriso, borderWidth: 1.5 },
  qr: { width: 200, height: 200, alignSelf: 'center' },
  codigo: { backgroundColor: cores.fundoAlt, borderRadius: raio.m, padding: 10 },
  demonstracao: { borderRadius: raio.m, borderWidth: 1.5, borderStyle: 'dashed', borderColor: cores.borda, alignItems: 'center', justifyContent: 'center', padding: 16 },
  total: { flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 10 },
});
