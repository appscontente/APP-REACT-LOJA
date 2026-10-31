import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import { useConta } from '@/estado/conta';
import { cpfValido } from '@/lib/formatar';
import { cores } from '@/lib/tema';

/** Número como o cliente copia do e-mail ou do WhatsApp ("#CC1234 "): sem espaço e sem o "#", como no site. */
const limparNumero = (numero: string) => numero.trim().replace(/^#/, '').toUpperCase();
const documentoValido = (doc: string) => cpfValido(doc) || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(doc.trim());

/**
 * Acompanhar entrega sem login (contrato, 33): número do pedido e CPF ou e-mail da compra. Aceita /rastreio?numero=.
 * Nesta versão de demonstração procura só nos pedidos feitos neste celular; com o backend, o número e o documento vão
 * para POST /pedidos/rastreio (pelo site) e a resposta mostra só a situação e a entrega, sem valores.
 */
export default function Rastreio() {
  const { pedidos } = useConta();
  const { numero: numeroLink } = useLocalSearchParams<{ numero?: string }>();
  const [numero, setNumero] = useState(numeroLink ? limparNumero(numeroLink) : '');
  const [documento, setDocumento] = useState('');
  const [erro, setErro] = useState(false);
  const limpo = limparNumero(numero);
  const acompanhar = () => (pedidos.some((p) => p.numero === limpo) ? router.push(`/minha-conta/pedidos/${limpo}`) : setErro(true));
  return (
    <View style={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Acompanhar entrega' }} />
      <Texto cor={cores.textoSuave}>Digite o número do pedido que está no e-mail de confirmação e o CPF ou e-mail da compra.</Texto>
      <Campo rotulo="Número do pedido" value={numero} onChangeText={(t) => (setNumero(t.toUpperCase()), setErro(false))} autoCapitalize="characters" />
      <Campo
        rotulo="CPF ou e-mail da compra"
        value={documento}
        onChangeText={(t) => (setDocumento(t), setErro(false))}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
      />
      {erro ? (
        <Texto cor={cores.marca}>Não achamos esse pedido neste celular. Confira os dados ou entre na sua conta para ver todos.</Texto>
      ) : null}
      <Botao titulo="Acompanhar" disabled={limpo.length < 4 || !documentoValido(documento)} onPress={acompanhar} />
    </View>
  );
}
