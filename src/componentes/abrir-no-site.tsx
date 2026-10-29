import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { SITE_URL } from '@/lib/api';
import { Carregando } from './estado-tela';

/**
 * Abre uma página segura do site dentro do app e volta quando o cliente fecha: orçamento do vendedor, link de
 * cobrança (mesmo pagamento e ClearSale do site) e páginas institucionais.
 */
export function AbrirNoSite({ caminho }: { caminho: string }) {
  useEffect(() => {
    WebBrowser.openBrowserAsync(`${SITE_URL}${caminho}`).finally(() => (router.canGoBack() ? router.back() : router.replace('/')));
  }, [caminho]);
  return <Carregando />;
}
