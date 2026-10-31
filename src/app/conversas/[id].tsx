// Uma conversa com a loja. O vendedor pode mandar cartões de produto que o cliente põe no carrinho com um toque;
// fotos e áudios entram quando o backend de conversas existir (vão para o mesmo armazenamento de mídia do site).

import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Notifications from 'expo-notifications';
import { router, Stack, useIsFocused, useLocalSearchParams } from 'expo-router';
import { useEffect, useEffectEvent, useRef, useState } from 'react';
import { AppState, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { AVISO_CARTAO, avisosPermitidos, pareceCartao, rotuloDia, useConversas, type Mensagem } from '@/estado/conversas';
import { SITE_URL } from '@/lib/api';
import { formatarHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaInterna, rotaProduto } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';

const ABAS = ['/', '/busca', '/categorias', '/carrinho', '/conta'];

/** Link mandado na conversa: caminho do site abre a tela do app (aba por dismissTo, achado #21); outro domínio abre fora. */
function abrirLink(link: string) {
  const rota = rotaInterna(link, SITE_URL);
  if (!rota) Linking.openURL(link).catch(() => undefined);
  else if (ABAS.includes(rota.split('?')[0])) router.dismissTo(rota as never);
  else router.push(rota as never);
}

/** Link http(s) no texto, sem a pontuação que costuma vir colada no fim ("veja https://...!"). */
const LINK = /(https?:\/\/\S*[^\s.,;:!?)\]])/g;

/** Texto da mensagem: dá para selecionar e copiar, e os links são tocáveis. */
function TextoMensagem({ texto, minha }: { texto: string; minha: boolean }) {
  const cor = minha ? '#fff' : cores.texto;
  return (
    <Texto cor={cor} selectable>
      {texto.split(LINK).map((parte, i) =>
        i % 2 === 1 ? (
          <Texto key={`${i}`} cor={minha ? '#fff' : cores.marca} style={estilos.link} onPress={() => abrirLink(parte)} accessibilityRole="link">
            {parte}
          </Texto>
        ) : (
          parte
        ),
      )}
    </Texto>
  );
}

function CartaoProduto({ produto, daLoja }: { produto: NonNullable<Mensagem['produto']>; daLoja: boolean }) {
  const { adicionar } = useCarrinho();
  // Depois do toque mostra que entrou e leva ao carrinho; tocar de novo não soma outra unidade.
  const [posto, setPosto] = useState(false);
  const porNoCarrinho = () => {
    adicionar(produto);
    setPosto(true);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  };
  return (
    <Pressable style={estilos.cartao} onPress={() => router.push(rotaProduto(produto) as never)}>
      <Imagem uri={produto.imagem} style={{ width: 64, height: 64 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo" numberOfLines={2}>
          {nomeLegivel(produto.nome)}
        </Texto>
        <Texto variante="forte">{formatarPreco(produto.preco)}</Texto>
        {daLoja && produto.estoque > 0 ? (
          <Pressable onPress={posto ? () => router.dismissTo('/carrinho') : porNoCarrinho} hitSlop={6}>
            <Texto variante="rotulo" cor={posto ? cores.sucesso : cores.marca}>
              {posto ? 'No carrinho · Ver carrinho' : 'Adicionar ao carrinho'}
            </Texto>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Pede a permissão de avisos; se o celular não deixa pedir de novo, abre os ajustes do app. */
async function ativarAvisos() {
  try {
    const atual = await Notifications.getPermissionsAsync();
    if (atual.granted) return true;
    if (atual.canAskAgain) return (await Notifications.requestPermissionsAsync()).granted;
  } catch {
    // Sem módulo de avisos (web ou Expo Go): cai nos ajustes.
  }
  await Linking.openSettings();
  return false;
}

export default function ConversaTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversas, enviar, marcarLida } = useConversas();
  const baixo = useSafeAreaInsets().bottom;
  const focada = useIsFocused();
  const [texto, setTexto] = useState('');
  const [cartaoRecusado, setCartaoRecusado] = useState(false);
  const [avisos, setAvisos] = useState(false);
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const conversa = conversas.find((c) => c.id === id);
  const quantidade = conversa?.mensagens.length ?? 0;

  // Só marca como lida com a tela à vista: se o cliente abriu um produto da conversa, a resposta que chegar fica nova.
  const marcar = useEffectEvent(() => {
    if (conversa) marcarLida(conversa.id);
  });
  useEffect(() => {
    if (focada) marcar();
  }, [quantidade, focada]);
  useEffect(() => {
    const t = setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [quantidade]);
  // Só promete aviso no celular com a permissão concedida. Confere de novo ao voltar para a tela e ao voltar dos ajustes
  // do celular (o app volta a 'active'), para o "Ativar avisos" sumir depois que o cliente liga lá.
  useEffect(() => {
    if (!focada) return;
    avisosPermitidos().then(setAvisos);
    const ouvinte = AppState.addEventListener('change', (estado) => {
      if (estado === 'active') avisosPermitidos().then(setAvisos);
    });
    return () => ouvinte.remove();
  }, [focada]);

  if (!conversa) return <Aviso titulo="Conversa não encontrada" acao="Ver conversas" aoTocar={() => router.replace('/conversas')} />;

  const mandar = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    // Número de cartão não sai do campo: não vai para a conversa nem fica gravado no celular.
    if (pareceCartao(limpo)) {
      setCartaoRecusado(true);
      return;
    }
    enviar(conversa.id, limpo);
    setTexto('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conversa.loja ? `Loja ${conversa.nomeLoja}` : conversa.nomeLoja }} />
      <ScrollView ref={rolagem} contentContainerStyle={estilos.mensagens}>
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
          {conversa.assunto}. Respondemos no horário da loja{avisos ? ' e você recebe um aviso no celular.' : '. Volte aqui para ver a resposta.'}
        </Texto>
        {!avisos ? (
          <Pressable onPress={() => ativarAvisos().then(setAvisos)} hitSlop={8} style={{ alignSelf: 'center' }} accessibilityRole="button">
            <Texto variante="rotulo" cor={cores.marca}>
              Ativar avisos
            </Texto>
          </Pressable>
        ) : null}
        {conversa.mensagens.map((m, i) => {
          const minha = m.de === 'cliente';
          const dia = rotuloDia(m.em);
          const novoDia = i === 0 || dia !== rotuloDia(conversa.mensagens[i - 1].em);
          return (
            <View key={m.id} style={{ gap: 10 }}>
              {novoDia ? (
                <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.dia}>
                  {dia}
                </Texto>
              ) : null}
              <View style={[estilos.balao, minha ? estilos.minha : estilos.dela]}>
                {m.autor ? (
                  <Texto variante="pequeno" cor={cores.marca} style={{ fontFamily: fontes.textoForte }}>
                    {m.autor}
                  </Texto>
                ) : null}
                {m.produto ? <CartaoProduto produto={m.produto} daLoja={!minha} /> : null}
                {m.texto ? <TextoMensagem texto={m.texto} minha={minha} /> : null}
                <Texto variante="pequeno" cor={minha ? 'rgba(255,255,255,0.75)' : cores.textoSuave} style={{ alignSelf: 'flex-end' }}>
                  {formatarHora(m.em)}
                </Texto>
              </View>
            </View>
          );
        })}
      </ScrollView>
      {cartaoRecusado ? (
        <View style={estilos.recusa} accessibilityLiveRegion="polite">
          <Ionicons name="lock-closed-outline" size={18} color={cores.marca} />
          <Texto variante="pequeno" style={{ flex: 1 }}>
            {AVISO_CARTAO}
          </Texto>
        </View>
      ) : null}
      <View style={[estilos.barra, { paddingBottom: baixo + 8 }]}>
        <Pressable hitSlop={8} accessibilityLabel="Mandar foto" onPress={() => undefined} disabled>
          <Ionicons name="camera-outline" size={24} color={cores.borda} />
        </Pressable>
        <TextInput
          value={texto}
          onChangeText={(t) => {
            setTexto(t);
            setCartaoRecusado(false);
          }}
          placeholder="Escreva sua mensagem"
          placeholderTextColor={cores.textoSuave}
          style={estilos.entrada}
          multiline
          onSubmitEditing={mandar}
          blurOnSubmit={false}
        />
        <Pressable onPress={mandar} style={[estilos.enviar, !texto.trim() && { opacity: 0.4 }]} disabled={!texto.trim()} accessibilityLabel="Enviar">
          <Ionicons name="send" size={18} color="#fff" />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  mensagens: { padding: 16, gap: 10 },
  balao: { maxWidth: '82%', padding: 12, borderRadius: raio.l, gap: 6 },
  minha: { alignSelf: 'flex-end', backgroundColor: cores.marca, borderBottomRightRadius: 4 },
  dela: { alignSelf: 'flex-start', backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda, borderBottomLeftRadius: 4 },
  dia: { alignSelf: 'center', backgroundColor: cores.fundoAlt, paddingHorizontal: 10, paddingVertical: 2, borderRadius: raio.pilula, overflow: 'hidden' },
  link: { textDecorationLine: 'underline' },
  recusa: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: cores.avisoFundo, borderTopWidth: 1, borderTopColor: cores.borda },
  cartao: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: raio.m, padding: 8, minWidth: 220 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8, backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.borda },
  entrada: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: cores.fundo, fontFamily: fontes.texto, fontSize: 15, color: cores.texto },
  enviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' },
});
