import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';
import { useEffect } from 'react';

import { SITE_URL } from '@/lib/api';
import { Carregando } from './estado-tela';

/**
 * Abre uma página segura do site dentro do app e volta quando o cliente fecha: orçamento do vendedor, link de
 * cobrança (mesmo pagamento e ClearSale do site), páginas institucionais e todo link do site que o app não tem
 * (listas de presente, ajuda, minha-conta/..., e-mails), com a query junto (ex. ?token=).
 */
export function AbrirNoSite({ caminho }: { caminho: string }) {
  useEffect(() => {
    // Sempre um caminho do nosso site: sem a barra, "@outro.com" viraria outro endereço.
    const pagina = `${SITE_URL}/${caminho.replace(/^[/\\]+/, '')}`;
    WebBrowser.openBrowserAsync(pagina).finally(() => (router.canGoBack() ? router.back() : router.replace('/')));
  }, [caminho]);
  return <Carregando />;
}
