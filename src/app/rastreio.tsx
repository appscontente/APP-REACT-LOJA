import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import { useConta } from '@/estado/conta';
import { cores } from '@/lib/tema';

/** Acompanhar entrega sem login (contrato, 33): número do pedido e CPF ou e-mail. */
export default function Rastreio() {
  const { pedidos } = useConta();
  const [numero, setNumero] = useState('');
  const [erro, setErro] = useState(false);
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Acompanhar entrega' }} />
      <Texto cor={cores.textoSuave}>Digite o número do pedido que está no e-mail de confirmação.</Texto>
      <Campo rotulo="Número do pedido" value={numero} onChangeText={(t) => (setNumero(t.toUpperCase()), setErro(false))} autoCapitalize="characters" />
      {erro ? <Texto cor={cores.marca}>Não achamos esse pedido neste celular. Entre na sua conta para ver todos.</Texto> : null}
      <Botao
        titulo="Acompanhar"
        disabled={numero.trim().length < 4}
        onPress={() => (pedidos.some((p) => p.numero === numero.trim()) ? router.push(`/minha-conta/pedidos/${numero.trim()}`) : setErro(true))}
      />
    </View>
  );
}
