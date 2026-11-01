// Acompanhar entrega sem login (/rastreio, contrato 33): número do pedido e CPF ou e-mail da compra vão para
// POST /api/app/rastreio (o site valida e, com o backend, consulta POST /pedidos/rastreio). A resposta é só o andamento:
// situação, linha do tempo, entrega, montagem e itens, sem valores nem endereço completo. Aceita /rastreio?numero=.
// Pedido que o site não acha mas foi feito neste celular (demonstração) abre em Meus pedidos.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ComponentProps } from 'react';
import { AccessibilityInfo, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Imagem } from '@/componentes/imagem';
import { LinhaDoTempo } from '@/componentes/linha-do-tempo';
import { Texto } from '@/componentes/texto';
import { useConta } from '@/estado/conta';
import { api, ErroApi } from '@/lib/api';
import { cpfValido, formatarDataHora, formatarHora, nomeLegivel } from '@/lib/formatar';
import { corEtiqueta, ROTULO_CANAL, ROTULO_ETAPA, textoACaminho, textoEntrega, textoMontagem } from '@/lib/pedidos';
import { cores, raio } from '@/lib/tema';
import type { RastreioApp } from '@/lib/tipos';

/** Número como o cliente copia do e-mail ou do WhatsApp ("#CC1234 "): sem espaço e sem o "#", como no site. */
const limparNumero = (numero: string) => numero.trim().replace(/^#/, '').toUpperCase();
// E-mail na mesma regra do site (lib/validacao.ts): domínio com pelo menos duas letras depois do ponto.
const documentoValido = (doc: string) => cpfValido(doc) || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(doc.trim());

export default function Rastreio() {
  const { pedidos } = useConta();
  const { numero: numeroLink } = useLocalSearchParams<{ numero?: string }>();
  const baixo = useSafeAreaInsets().bottom;
  const [numero, setNumero] = useState(numeroLink ? limparNumero(numeroLink) : '');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState<string>();
  const [consultando, setConsultando] = useState(false);
  const [resultado, setResultado] = useState<RastreioApp>();
  const limpo = limparNumero(numero);

  const acompanhar = async () => {
    if (consultando) return;
    setErro(undefined);
    setConsultando(true);
    try {
      const r = await api.rastrear(limpo, documento.trim());
      setResultado(r);
      AccessibilityInfo.announceForAccessibility(`Pedido ${r.pedido.numero}: ${ROTULO_ETAPA[r.pedido.situacao]}`);
    } catch (e) {
      const status = e instanceof ErroApi ? e.status : undefined;
      // O site não achou, mas o pedido foi feito neste celular (demonstração): abre em Meus pedidos.
      if (status === 404 && pedidos.some((p) => p.numero === limpo)) {
        router.push(`/minha-conta/pedidos/${limpo}`);
        return;
      }
      // 400 (dado que o site não aceitou), 404 (dados não batem) e 429 (muitas tentativas) com a mensagem do site; sem
      // conexão, a da rede. O resto (falha do site ou do backend), genérica.
      const mensagem =
        e instanceof ErroApi && (status === 400 || status === 404 || status === 429 || status === 0) ? e.message : 'Não foi possível consultar agora.';
      setErro(mensagem);
      AccessibilityInfo.announceForAccessibility(mensagem);
    } finally {
      setConsultando(false);
    }
  };

  const outroPedido = () => {
    setResultado(undefined);
    setNumero('');
    setErro(undefined);
  };

  return (
    // Folga embaixo para o botão fixo "Na loja" não cobrir o último botão.
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingBottom: 120 + baixo }]} keyboardShouldPersistTaps="handled">
      <Stack.Screen options={{ title: 'Acompanhar entrega' }} />
      {resultado ? (
        <Resultado dados={resultado} aoConsultarOutro={outroPedido} />
      ) : (
        <>
          <Texto cor={cores.textoSuave}>
            Digite o número do pedido que está no e-mail de confirmação ou no comprovante da loja e o CPF ou e-mail da compra.
          </Texto>
          <Campo rotulo="Número do pedido" value={numero} onChangeText={(t) => (setNumero(t.toUpperCase()), setErro(undefined))} autoCapitalize="characters" />
          <Campo
            rotulo="CPF ou e-mail da compra"
            value={documento}
            onChangeText={(t) => (setDocumento(t), setErro(undefined))}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />
          {erro ? (
            <Texto cor={cores.marca} accessibilityLiveRegion="polite">
              {erro}
            </Texto>
          ) : null}
          <Botao titulo="Acompanhar" disabled={limpo.length < 4 || !documentoValido(documento)} carregando={consultando} onPress={acompanhar} />
        </>
      )}
    </ScrollView>
  );
}

/** O andamento do pedido: situação, equipe a caminho, linha do tempo, entrega e montagem, itens. Sem valores. */
function Resultado({ dados, aoConsultarOutro }: { dados: RastreioApp; aoConsultarOutro: () => void }) {
  const { pedido: p, passos, tom } = dados;
  const etiqueta = corEtiqueta(tom);
  const entrega = textoEntrega(p);
  const montagem = textoMontagem(p);
  // Só endereço seguro da transportadora; um link estranho na resposta não abre nada.
  const acompanhamento = p.acompanhamento?.startsWith('https://') ? p.acompanhamento : undefined;
  return (
    <>
      <View style={estilos.caixa}>
        <View style={estilos.topo}>
          <View style={{ flex: 1, gap: 2 }}>
            <Texto variante="subtitulo" accessibilityRole="header">
              Pedido {p.numero}
            </Texto>
            {p.primeiroNome ? <Texto cor={cores.textoSuave}>de {p.primeiroNome}</Texto> : null}
          </View>
          <View style={[estilos.etiqueta, { backgroundColor: etiqueta.fundo }]}>
            <Texto variante="rotulo" cor={etiqueta.cor}>
              {ROTULO_ETAPA[p.situacao]}
            </Texto>
          </View>
        </View>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Feito em {formatarDataHora(p.criadoEm)} · {ROTULO_CANAL[p.canal]}
        </Texto>
        {p.aCaminho ? (
          <View style={estilos.aCaminho} accessibilityLiveRegion="polite">
            <Ionicons name={p.aCaminho.tipo === 'entrega' ? 'car-outline' : 'construct-outline'} size={20} color={cores.sucesso} />
            <View style={{ flex: 1, gap: 2 }}>
              <Texto variante="forte" cor={cores.sucesso}>
                {textoACaminho(p.aCaminho)}
              </Texto>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Previsão com o trânsito de agora, atualizada às {formatarHora(p.aCaminho.atualizadoEm)}.
              </Texto>
            </View>
          </View>
        ) : null}
        <LinhaDoTempo passos={passos} />
      </View>

      {entrega || montagem || acompanhamento ? (
        <View style={estilos.caixa}>
          {entrega ? <Linha icone="home-outline" texto={entrega} /> : null}
          {montagem ? <Linha icone="construct-outline" texto={montagem} /> : null}
          {acompanhamento ? (
            <Botao
              titulo="Acompanhar na transportadora"
              variante="contorno"
              icone={<Ionicons name="open-outline" size={18} color={cores.texto} />}
              onPress={() => Linking.openURL(acompanhamento).catch(() => undefined)}
            />
          ) : null}
        </View>
      ) : null}

      <View style={estilos.caixa}>
        <Texto variante="subtitulo" accessibilityRole="header">
          Itens
        </Texto>
        {p.itens.map((i, n) => {
          const nome = nomeLegivel(i.nome);
          return (
            <View key={`${i.nome}-${n}`} style={estilos.item} accessible accessibilityLabel={`${i.quantidade} × ${nome}`}>
              <Imagem uri={i.imagem} style={estilos.foto} />
              <Texto variante="rotulo" numberOfLines={2} style={{ flex: 1 }}>
                {nome}
              </Texto>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                {i.quantidade} {i.quantidade === 1 ? 'unidade' : 'unidades'}
              </Texto>
            </View>
          );
        })}
      </View>

      <Botao titulo="Consultar outro pedido" variante="contorno" onPress={aoConsultarOutro} />
    </>
  );
}

function Linha({ icone, texto }: { icone: ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={estilos.linha}>
      <Ionicons name={icone} size={20} color={cores.textoSuave} />
      <Texto style={{ flex: 1 }}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  topo: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  etiqueta: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: raio.pilula },
  aCaminho: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: raio.m, backgroundColor: cores.sucessoFundo },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: '#fff' },
});
