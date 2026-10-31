import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConta } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { formatarCep } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import { useReduzirMovimento } from '@/lib/use-reduzir-movimento';
import { Botao } from './botao';
import { Logo } from './logo';
import { Texto } from './texto';

/**
 * A cada tanto, o botão da conversa mostra "Fale com o vendedor" por alguns segundos e volta a ser só o ícone. Só roda
 * com o início na tela; com "Reduzir movimento" ligado, o balão aparece uma vez, sem animação.
 */
const DICA_A_CADA_MS = 20 * 1000;
const DICA_DURA_MS = 4 * 1000;

function useDicaPiscando() {
  const [opacidade] = useState(() => new Animated.Value(0));
  const [jaMostrou, setJaMostrou] = useState(false);
  const focado = useIsFocused();
  const reduzir = useReduzirMovimento();
  useEffect(() => {
    if (!focado) {
      opacidade.setValue(0);
      return;
    }
    if (reduzir) {
      if (jaMostrou) return;
      const aparecer = setTimeout(() => opacidade.setValue(1), 3000);
      const sumir = setTimeout(() => {
        opacidade.setValue(0);
        setJaMostrou(true);
      }, 3000 + DICA_DURA_MS);
      return () => {
        clearTimeout(aparecer);
        clearTimeout(sumir);
        opacidade.setValue(0);
      };
    }
    const mostrar = () =>
      Animated.sequence([
        Animated.timing(opacidade, { toValue: 1, duration: 250, useNativeDriver: true }),
        Animated.delay(DICA_DURA_MS),
        Animated.timing(opacidade, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    const primeira = setTimeout(mostrar, 3000);
    const relogio = setInterval(mostrar, DICA_A_CADA_MS);
    return () => {
      clearTimeout(primeira);
      clearInterval(relogio);
      opacidade.stopAnimation();
      opacidade.setValue(0);
    };
  }, [opacidade, focado, reduzir, jaMostrou]);
  return opacidade;
}

/** Topo do início: logo, barra de busca (abre a aba Busca) e o CEP para mostrar frete e prazo. */
export function Cabecalho() {
  const topo = useSafeAreaInsets().top;
  const { cep } = useConta();
  const [editando, setEditando] = useState(false);
  const dica = useDicaPiscando();
  const { lojaAtual } = useFigital();
  const { conversas, iniciar, naoLidas } = useConversas();
  // Com a loja marcada, a conversa vai direto para um vendedor dela; sem loja, abre a lista de conversas.
  const conversar = () => {
    if (!lojaAtual) return router.push('/conversas');
    const id =
      conversas.find((c) => c.loja === lojaAtual.slug)?.id ?? iniciar({ loja: lojaAtual.slug, nomeLoja: lojaAtual.nome, assunto: 'Dúvida na loja' });
    router.push(`/conversas/${id}`);
  };
  return (
    <View style={[estilos.topo, { paddingTop: topo + 10 }]}>
      <View style={estilos.linha}>
        <Logo variante="branca" altura={30} />
        {/* O balão fica fora do fluxo da linha: aparece à esquerda do ícone sem empurrá-lo para fora da tela. */}
        <Animated.View
          style={[estilos.dica, { opacity: dica }]}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Texto variante="pequeno" style={estilos.textoDica} numberOfLines={1} maxFontSizeMultiplier={1.3}>
            {lojaAtual ? `Fale com o vendedor da ${lojaAtual.nome}` : 'Fale com o vendedor'}
          </Texto>
        </Animated.View>
        <Pressable
          onPress={conversar}
          accessibilityRole="button"
          accessibilityLabel={
            (lojaAtual ? `Fale com o vendedor da loja ${lojaAtual.nome}` : 'Fale com o vendedor') +
            (naoLidas ? `, ${naoLidas} ${naoLidas === 1 ? 'conversa nova' : 'conversas novas'}` : '')
          }
          hitSlop={8}>
          <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
          {naoLidas > 0 && <View style={estilos.ponto} />}
        </Pressable>
      </View>
      <View style={estilos.busca}>
        {/* A busca e o leitor são irmãos (e não um dentro do outro), para o VoiceOver alcançar os dois. */}
        <Pressable
          onPress={() => router.navigate(`/busca?foco=${Date.now()}` as never)}
          style={estilos.buscaToque}
          accessibilityRole="search"
          accessibilityLabel="Buscar produtos">
          <Ionicons name="search" size={20} color={cores.textoSuave} />
          <Texto cor={cores.textoSuave} numberOfLines={1} style={{ flexShrink: 1 }}>
            O que você procura?
          </Texto>
        </Pressable>
        <Pressable onPress={() => router.push('/leitor')} hitSlop={10} accessibilityRole="button" accessibilityLabel="Ler QR ou código de barras">
          <Ionicons name="scan-outline" size={22} color={cores.marca} />
        </Pressable>
      </View>
      <Pressable onPress={() => setEditando(true)} style={estilos.cep} hitSlop={12} accessibilityRole="button">
        <Ionicons name="location-outline" size={16} color="#fff" />
        <Texto variante="pequeno" cor="#fff">
          {cep ? `Entregar no CEP ${formatarCep(cep)}` : 'Informe seu CEP para ver frete e prazo'}
        </Texto>
        <Ionicons name="chevron-forward" size={14} color="#fff" />
      </Pressable>
      <GavetaCep aberta={editando} fechar={() => setEditando(false)} />
    </View>
  );
}

export function GavetaCep({ aberta, fechar }: { aberta: boolean; fechar: () => void }) {
  const { cep, definirCep } = useConta();
  const [valor, setValor] = useState(cep ?? '');
  // A conta é lida do aparelho depois de montar e o CEP pode mudar em outra tela: a gaveta abre sempre com o CEP salvo.
  const [abertaAntes, setAbertaAntes] = useState(aberta);
  if (aberta !== abertaAntes) {
    setAbertaAntes(aberta);
    if (aberta) setValor(cep ?? '');
  }
  const valido = valor.replace(/\D/g, '').length === 8;
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar}>
      {/* A gaveta sobe junto com o teclado, para o campo e o botão ficarem à vista. */}
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <Pressable style={estilos.fundo} onPress={fechar} />
        <View style={estilos.gaveta}>
          <Texto variante="subtitulo">Onde você quer receber?</Texto>
          <Texto cor={cores.textoSuave}>Com o CEP mostramos o frete e o prazo de cada produto.</Texto>
          <TextInput
            value={formatarCep(valor)}
            onChangeText={setValor}
            keyboardType="number-pad"
            placeholder="00000-000"
            maxLength={9}
            style={estilos.entrada}
            autoFocus
          />
          <Botao
            titulo="Usar este CEP"
            disabled={!valido}
            onPress={() => {
              definirCep(valor.replace(/\D/g, ''));
              fechar();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  dica: {
    position: 'absolute',
    right: 32,
    maxWidth: 220,
    backgroundColor: cores.sorriso,
    borderRadius: raio.pilula,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // Amarelo com borda branca: no topo vermelho, um ponto vermelho não apareceria.
  ponto: {
    position: 'absolute',
    top: -2,
    right: -3,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: cores.sorriso,
    borderWidth: 2,
    borderColor: '#fff',
  },
  textoDica: { fontFamily: fontes.titulo, color: cores.texto },
  topo: { backgroundColor: cores.marca, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: raio.pilula,
    paddingHorizontal: 16,
    minHeight: 46,
  },
  buscaToque: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'stretch', paddingVertical: 12 },
  cep: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  gaveta: { backgroundColor: cores.superficie, padding: 24, gap: 12, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  entrada: {
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raio.m,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 18,
    fontFamily: fontes.textoMedio,
    color: cores.texto,
  },
});
