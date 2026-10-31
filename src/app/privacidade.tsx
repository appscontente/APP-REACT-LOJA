import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import { Alert, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Texto } from '@/componentes/texto';
import { useConta, useSairDaConta } from '@/estado/conta';
import { SITE_URL } from '@/lib/api';
import { cores, raio } from '@/lib/tema';

/** O que o app guarda no celular (AsyncStorage). Manter igual às chaves de src/estado e src/lib/perto-da-loja.ts. */
const GUARDADO = [
  'E-mail e nome que você usou para entrar',
  'Pedidos feitos pelo app: itens, valores, celular e endereço de entrega',
  'Favoritos e CEP',
  'Carrinho do site e das lojas',
  'Loja em que você está (sai sozinha depois de 4 horas)',
  'Comprovante da compra para pagar no caixa da loja: número, itens, total, desconto e forma de pagamento (sai sozinho quando a reserva vence)',
  'Conversas com a loja',
  'Buscas recentes',
  'Com as boas-vindas ligadas: as lojas em que você esteve e quando, para não repetir o cumprimento',
];

/**
 * Privacidade (LGPD): lista tudo o que o app guarda no celular e como apagar; nunca guarda o cartão.
 * Excluir a conta ainda é pelo site; com o backend, entra no app (rota do site que repassa o DELETE de 17.10).
 */
export default function Privacidade() {
  const baixo = useSafeAreaInsets().bottom;
  const { logado } = useConta();
  const sair = useSairDaConta();

  const abrirMeusDados = async () => {
    await WebBrowser.openBrowserAsync(`${SITE_URL}/minha-conta/dados`);
    // O navegador do app não sabe da sessão do site: ao voltar, pergunta se a conta foi excluída para limpar o celular.
    // Com o backend, o app confere a sessão (GET /clientes/eu) e limpa sozinho se ela tiver caído.
    if (!logado) return;
    Alert.alert('Você excluiu sua conta?', 'Se excluiu, apagamos também deste celular seus pedidos, favoritos, CEP, conversas e buscas.', [
      { text: 'Não', style: 'cancel' },
      { text: 'Sim, apagar', style: 'destructive', onPress: sair },
    ]);
  };

  return (
    // Folga embaixo para o botão fixo "Na loja" não cobrir o último botão.
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12, paddingBottom: 120 + baixo }}>
      <Stack.Screen options={{ title: 'Privacidade' }} />
      <Texto>Para deixar a compra mais rápida, o app guarda no seu celular:</Texto>
      <View style={{ gap: 6, backgroundColor: cores.superficie, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, padding: 16 }}>
        {GUARDADO.map((g) => (
          <Texto key={g} variante="pequeno">
            • {g}
          </Texto>
        ))}
      </View>
      <Texto>O cartão nunca fica no app nem nos nossos servidores. A sua localização fica só no celular.</Texto>
      <Texto cor={cores.textoSuave}>
        Para apagar: “Sair da conta” apaga pedidos, favoritos, CEP, conversas e buscas; desligar as boas-vindas na Conta para de usar a
        localização. Desinstalar o app apaga tudo.
      </Texto>
      <Texto cor={cores.textoSuave}>
        Preferências de avisos, cópia dos seus dados e exclusão da conta ficam na área do cliente, como no site.
      </Texto>
      <Botao titulo="Política de privacidade" variante="contorno" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/politica-de-privacidade`)} />
      <Botao titulo="Meus dados e excluir conta" variante="contorno" onPress={abrirMeusDados} />
    </ScrollView>
  );
}
