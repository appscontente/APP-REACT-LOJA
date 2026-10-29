// Conta: entrar com o código enviado ao e-mail (como no site, sem senha) e os atalhos da área do cliente.

import { Ionicons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Sorriso } from '@/componentes/logo';
import { Texto } from '@/componentes/texto';
import { useBoasVindas } from '@/estado/boas-vindas';
import { useConta } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { cores, fontes, raio } from '@/lib/tema';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Entrar() {
  const { entrar } = useConta();
  const [email, setEmail] = useState('');
  const [enviado, setEnviado] = useState(false);
  const [codigo, setCodigo] = useState('');
  return (
    <View style={estilos.caixa}>
      <Texto variante="subtitulo">Entre na sua conta</Texto>
      <Texto cor={cores.textoSuave}>
        {enviado
          ? `Mandamos um código de 6 números para ${email}. Ele vale por 10 minutos.`
          : 'Sem senha: mandamos um código para o seu e-mail. Suas compras nas lojas aparecem aqui também.'}
      </Texto>
      {!enviado ? (
        <>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="seu@email.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            style={estilos.entrada}
          />
          <Botao titulo="Receber código" disabled={!EMAIL.test(email.trim())} onPress={() => setEnviado(true)} />
        </>
      ) : (
        <>
          <TextInput
            value={codigo}
            onChangeText={(t) => setCodigo(t.replace(/\D/g, '').slice(0, 6))}
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            style={[estilos.entrada, { letterSpacing: 8, textAlign: 'center' }]}
          />
          <Botao titulo="Entrar" disabled={codigo.length !== 6} onPress={() => entrar(email.trim().toLowerCase())} />
          <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
            Demonstração: qualquer código de 6 números entra.
          </Texto>
          <Botao titulo="Usar outro e-mail" variante="texto" onPress={() => setEnviado(false)} />
        </>
      )}
    </View>
  );
}

function Opcao({ icone, titulo, texto, aoTocar, contador }: { icone: React.ComponentProps<typeof Ionicons>['name']; titulo: string; texto?: string; aoTocar: () => void; contador?: number }) {
  return (
    <Pressable style={({ pressed }) => [estilos.opcao, pressed && { backgroundColor: cores.fundoAlt }]} onPress={aoTocar}>
      <Ionicons name={icone} size={22} color={cores.marca} />
      <View style={{ flex: 1 }}>
        <Texto variante="forte">{titulo}</Texto>
        {texto ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {texto}
          </Texto>
        ) : null}
      </View>
      {contador ? (
        <View style={estilos.contador}>
          <Texto variante="pequeno" style={{ fontFamily: fontes.titulo }}>
            {contador}
          </Texto>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
    </Pressable>
  );
}

/** Liga as boas-vindas na loja. Explica antes de o celular pedir a permissão de localização. */
function OpcaoBoasVindas() {
  const { ligado, ligar, desligar } = useBoasVindas();
  const alternar = (quer: boolean) => {
    if (!quer) return desligar();
    Alert.alert(
      'Boas-vindas na loja',
      'Quando você passar 2 minutos numa loja Casa Contente, o app dá as boas-vindas e já abre o estoque daquela loja. Para isso ele usa a localização do celular, que fica só no aparelho e não é guardada. Você pode desligar aqui quando quiser.',
      [
        { text: 'Agora não', style: 'cancel' },
        {
          text: 'Ligar',
          onPress: async () => {
            if (!(await ligar())) Alert.alert('Sem localização', 'Para ligar, permita a localização do app nos ajustes do celular.');
          },
        },
      ],
    );
  };
  return (
    <View style={estilos.opcao}>
      <Ionicons name="location-outline" size={22} color={cores.marca} />
      <View style={{ flex: 1 }}>
        <Texto variante="forte">Boas-vindas na loja</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Ao chegar numa loja, o app abre o estoque dela
        </Texto>
      </View>
      <Switch
        value={ligado}
        onValueChange={alternar}
        trackColor={{ true: cores.marca, false: cores.borda }}
        thumbColor="#fff"
        accessibilityLabel="Boas-vindas na loja"
      />
    </View>
  );
}

export default function Conta() {
  const topo = useSafeAreaInsets().top;
  const { logado, email, pedidos, favoritos, sair } = useConta();
  const { naoLidas } = useConversas();
  return (
    <ScrollView style={estilos.tela} contentContainerStyle={[estilos.conteudo, { paddingTop: topo + 12 }]}>
      <View style={estilos.ola}>
        <Sorriso largura={44} />
        <Texto variante="titulo">{logado ? 'Olá!' : 'Minha conta'}</Texto>
        {logado ? <Texto cor={cores.textoSuave}>{email}</Texto> : null}
      </View>
      {!logado && <Entrar />}
      <View style={estilos.grupo}>
        <Opcao icone="receipt-outline" titulo="Meus pedidos" texto="Do app, do site e das lojas" contador={pedidos.length} aoTocar={() => router.push('/minha-conta/pedidos')} />
        <Opcao icone="chatbubbles-outline" titulo="Conversas com a loja" texto="Tire dúvidas com um vendedor" contador={naoLidas} aoTocar={() => router.push('/conversas')} />
        <Opcao icone="heart-outline" titulo="Favoritos" texto="Avisamos quando baixar o preço" contador={favoritos.length} aoTocar={() => router.push('/favoritos')} />
        <Opcao icone="cube-outline" titulo="Acompanhar entrega" aoTocar={() => router.push('/rastreio')} />
      </View>
      <View style={estilos.grupo}>
        <Opcao icone="storefront-outline" titulo="Nossas lojas" texto="Endereços e horários" aoTocar={() => router.push('/lojas')} />
        <OpcaoBoasVindas />
        <Opcao icone="shield-checkmark-outline" titulo="Privacidade" texto="Seus dados, avisos e excluir conta" aoTocar={() => router.push('/privacidade')} />
      </View>
      {logado && <Botao titulo="Sair da conta" variante="contorno" onPress={sair} />}
      <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
        Casa Contente · versão {Constants.expoConfig?.version} · Desenvolvido por Contente+
      </Texto>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  conteudo: { paddingHorizontal: 16, gap: 16, paddingBottom: 140 },
  ola: { gap: 4 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  entrada: {
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raio.m,
    height: 50,
    paddingHorizontal: 16,
    fontSize: 16,
    fontFamily: fontes.textoMedio,
    color: cores.texto,
  },
  grupo: { backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  contador: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: cores.sorriso, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
