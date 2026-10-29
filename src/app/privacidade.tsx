import * as WebBrowser from 'expo-web-browser';
import { Stack } from 'expo-router';
import { ScrollView } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Texto } from '@/componentes/texto';
import { SITE_URL } from '@/lib/api';
import { cores } from '@/lib/tema';

/** Privacidade (LGPD): o app só guarda no celular o carrinho, a loja e as conversas; nunca o cartão. */
export default function Privacidade() {
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
      <Stack.Screen options={{ title: 'Privacidade' }} />
      <Texto>
        Este app guarda no seu celular só o que deixa a compra mais rápida: carrinho, CEP, favoritos, a loja em que você está e as
        conversas. O cartão nunca fica no app nem nos nossos servidores.
      </Texto>
      <Texto cor={cores.textoSuave}>
        Preferências de avisos, cópia dos seus dados e exclusão da conta ficam na área do cliente, como no site.
      </Texto>
      <Botao titulo="Política de privacidade" variante="contorno" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/politica-de-privacidade`)} />
      <Botao titulo="Meus dados e excluir conta" variante="contorno" onPress={() => WebBrowser.openBrowserAsync(`${SITE_URL}/minha-conta/dados`)} />
    </ScrollView>
  );
}
