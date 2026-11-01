import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import { Alert, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Texto } from '@/componentes/texto';
import { useConta, useSairDaConta } from '@/estado/conta';
import { SITE_URL } from '@/lib/api';
import { cores, raio } from '@/lib/tema';
import { useCupom } from '@/lib/use-calculo-carrinho';

/** O que o app guarda no celular (AsyncStorage). Manter igual às chaves de src/estado, src/lib/use-calculo-carrinho.ts e src/lib/perto-da-loja.ts. */
const GUARDADO = [
  'E-mail e nome que você usou para entrar',
  'Pedidos feitos pelo app: itens, valores, celular e endereço de entrega',
  'Favoritos e CEP',
  'Carrinho do site e das lojas',
  'Cupom digitado no carrinho',
  'Loja em que você está (sai sozinha depois de 4 horas)',
  'Comprovantes das compras para pagar no caixa da loja: número, itens, total, desconto e forma de pagamento (cada um sai sozinho quando a reserva vence)',
  'Conversas com a loja',
  'Buscas recentes',
  'Com as boas-vindas ligadas: as lojas em que você esteve e quando, para não repetir o cumprimento',
];

/**
 * Privacidade (LGPD): lista tudo o que o app guarda no celular e como apagar; nunca guarda o cartão.
 * "Excluir minha conta" (só com login) abre a área do cliente do site, onde a exclusão é confirmada, e ao voltar pergunta
 * se a conta foi excluída antes de apagar deste celular o que é da pessoa: quem desiste no site não perde nada. Com o
 * backend, a exclusão passa a ser direto no app (rota do site que repassa o DELETE de 17.10).
 */
export default function Privacidade() {
  const baixo = useSafeAreaInsets().bottom;
  const { logado } = useConta();
  const sair = useSairDaConta();
  const { limpar: limparCupom } = useCupom();
  const paginaDados = `${SITE_URL}/minha-conta/dados`;

  /** Tudo o que é da pessoa sai do celular: conta, pedidos, favoritos, CEP, conversas, buscas e cupom. */
  const apagarDoCelular = () => {
    sair();
    limparCupom();
  };

  /** Pergunta com duas saídas; no navegador não existe Alert, vai a confirmação da página. */
  const perguntar = (titulo: string, texto: string, sim: string, aoConfirmar: () => void) => {
    if (Platform.OS === 'web') {
      if (window.confirm(`${titulo}\n\n${texto}`)) aoConfirmar();
      return;
    }
    Alert.alert(titulo, texto, [
      { text: 'Cancelar', style: 'cancel' },
      { text: sim, style: 'destructive', onPress: aoConfirmar },
    ]);
  };

  const abrirMeusDados = async () => {
    await WebBrowser.openBrowserAsync(paginaDados).catch(() => undefined);
    // O navegador do app não sabe da sessão do site: ao voltar, pergunta se a conta foi excluída para limpar o celular.
    // Com o backend, o app confere a sessão (GET /clientes/eu) e limpa sozinho se ela tiver caído.
    if (!logado) return;
    perguntar(
      'Você excluiu sua conta?',
      'Se excluiu, apagamos também deste celular seus pedidos, favoritos, CEP, conversas, buscas e cupom.',
      'Sim, apagar',
      apagarDoCelular,
    );
  };

  const excluirConta = () =>
    perguntar(
      'Excluir a conta?',
      'Vamos abrir a área do cliente do site, onde você confirma a exclusão. Ao voltar, perguntamos se excluiu para apagar também deste celular seus pedidos, favoritos, CEP, conversas, buscas e cupom.',
      'Continuar',
      () => void abrirMeusDados(),
    );

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
      <Botao titulo="Meus dados no site" variante="contorno" onPress={abrirMeusDados} />
      {logado ? (
        <Botao
          titulo="Excluir minha conta"
          variante="contorno"
          onPress={excluirConta}
          accessibilityHint="Abre a área do cliente do site para confirmar a exclusão e depois apaga seus dados deste celular"
        />
      ) : null}
    </ScrollView>
  );
}
