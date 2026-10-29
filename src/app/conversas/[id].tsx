// Uma conversa com a loja. O vendedor pode mandar cartões de produto que o cliente põe no carrinho com um toque;
// fotos e áudios entram quando o backend de conversas existir (vão para o mesmo armazenamento de mídia do site).

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConversas, type Mensagem } from '@/estado/conversas';
import { formatarHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaProduto } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';

function CartaoProduto({ produto, daLoja }: { produto: NonNullable<Mensagem['produto']>; daLoja: boolean }) {
  const { adicionar } = useCarrinho();
  return (
    <Pressable style={estilos.cartao} onPress={() => router.push(rotaProduto(produto) as never)}>
      <Imagem uri={produto.imagem} style={{ width: 64, height: 64 }} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo" numberOfLines={2}>
          {nomeLegivel(produto.nome)}
        </Texto>
        <Texto variante="forte">{formatarPreco(produto.preco)}</Texto>
        {daLoja && produto.estoque > 0 ? (
          <Pressable onPress={() => adicionar(produto)} hitSlop={6}>
            <Texto variante="rotulo" cor={cores.marca}>
              Adicionar ao carrinho
            </Texto>
          </Pressable>
        ) : null}
      </View>
    </Pressable>
  );
}

export default function ConversaTela() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { conversas, enviar, marcarLida } = useConversas();
  const baixo = useSafeAreaInsets().bottom;
  const [texto, setTexto] = useState('');
  const rolagem = useRef<React.ComponentRef<typeof ScrollView>>(null);
  const conversa = conversas.find((c) => c.id === id);
  const quantidade = conversa?.mensagens.length ?? 0;

  useEffect(() => {
    if (conversa) marcarLida(conversa.id);
    setTimeout(() => rolagem.current?.scrollToEnd({ animated: true }), 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quantidade]);

  if (!conversa) return <Aviso titulo="Conversa não encontrada" acao="Ver conversas" aoTocar={() => router.replace('/conversas')} />;

  const mandar = () => {
    const limpo = texto.trim();
    if (!limpo) return;
    enviar(conversa.id, limpo);
    setTexto('');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: conversa.loja ? `Loja ${conversa.nomeLoja}` : conversa.nomeLoja }} />
      <ScrollView ref={rolagem} contentContainerStyle={estilos.mensagens}>
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
          {conversa.assunto}. Respondemos no horário da loja e você recebe um aviso no celular.
        </Texto>
        {conversa.mensagens.map((m) => {
          const minha = m.de === 'cliente';
          return (
            <View key={m.id} style={[estilos.balao, minha ? estilos.minha : estilos.dela]}>
              {m.autor ? (
                <Texto variante="pequeno" cor={cores.marca} style={{ fontFamily: fontes.textoForte }}>
                  {m.autor}
                </Texto>
              ) : null}
              {m.produto ? <CartaoProduto produto={m.produto} daLoja={!minha} /> : null}
              {m.texto ? <Texto cor={minha ? '#fff' : cores.texto}>{m.texto}</Texto> : null}
              <Texto variante="pequeno" cor={minha ? 'rgba(255,255,255,0.75)' : cores.textoSuave} style={{ alignSelf: 'flex-end' }}>
                {formatarHora(m.em)}
              </Texto>
            </View>
          );
        })}
      </ScrollView>
      <View style={[estilos.barra, { paddingBottom: baixo + 8 }]}>
        <Pressable hitSlop={8} accessibilityLabel="Mandar foto" onPress={() => undefined} disabled>
          <Ionicons name="camera-outline" size={24} color={cores.borda} />
        </Pressable>
        <TextInput
          value={texto}
          onChangeText={setTexto}
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
  cartao: { flexDirection: 'row', gap: 10, backgroundColor: '#fff', borderRadius: raio.m, padding: 8, minWidth: 220 },
  barra: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingHorizontal: 12, paddingTop: 8, backgroundColor: cores.superficie, borderTopWidth: 1, borderTopColor: cores.borda },
  entrada: { flex: 1, minHeight: 44, maxHeight: 120, borderRadius: 22, paddingHorizontal: 16, paddingTop: 12, paddingBottom: 10, backgroundColor: cores.fundo, fontFamily: fontes.texto, fontSize: 15, color: cores.texto },
  enviar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' },
});
