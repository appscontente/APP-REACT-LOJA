import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useConta } from '@/estado/conta';
import { formatarCep } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import { Botao } from './botao';
import { Logo } from './logo';
import { Texto } from './texto';

/** Topo do início: logo, barra de busca (abre a aba Busca) e o CEP para mostrar frete e prazo. */
export function Cabecalho() {
  const topo = useSafeAreaInsets().top;
  const { cep } = useConta();
  const [editando, setEditando] = useState(false);
  return (
    <View style={[estilos.topo, { paddingTop: topo + 10 }]}>
      <View style={estilos.linha}>
        <Logo variante="branca" altura={30} />
        <Pressable
          onPress={() => router.push('/conversas')}
          accessibilityRole="button"
          accessibilityLabel="Conversas com a loja"
          hitSlop={8}>
          <Ionicons name="chatbubbles-outline" size={24} color="#fff" />
        </Pressable>
      </View>
      <Pressable onPress={() => router.push('/busca')} style={estilos.busca} accessibilityRole="search">
        <Ionicons name="search" size={20} color={cores.textoSuave} />
        <Texto cor={cores.textoSuave}>O que você procura?</Texto>
        <View style={{ flex: 1 }} />
        <Pressable onPress={() => router.push('/leitor')} hitSlop={10} accessibilityLabel="Ler QR ou código de barras">
          <Ionicons name="scan-outline" size={22} color={cores.marca} />
        </Pressable>
      </Pressable>
      <Pressable onPress={() => setEditando(true)} style={estilos.cep} accessibilityRole="button">
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
  topo: { backgroundColor: cores.marca, paddingHorizontal: 16, paddingBottom: 12, gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: raio.pilula,
    paddingHorizontal: 16,
    height: 46,
  },
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
