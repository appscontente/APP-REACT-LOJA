import { router, Stack, useGlobalSearchParams, usePathname } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';
import { Aviso } from '@/componentes/estado-tela';
import { caminhoComQuery } from '@/lib/rotas';

/**
 * Endereço do site que o app não tem tela (listas de presente, minha-conta/pedidos/{n}/avaliar, carrinho/recuperar,
 * e-mails): abre a mesma página do site no navegador do app, com a query junto (ex. ?token=), e volta ao fechar.
 */
export default function NaoEncontrado() {
  const caminho = usePathname();
  const params = useGlobalSearchParams();
  if (!caminho || caminho === '/') {
    return (
      <>
        <Stack.Screen options={{ title: 'Página não encontrada' }} />
        <Aviso titulo="Não achamos esta página" texto="O link pode ter mudado. Que tal começar pelo início?" acao="Ir para o início" aoTocar={() => router.replace('/')} triste />
      </>
    );
  }
  return <AbrirNoSite caminho={caminhoComQuery(caminho, params, ['not-found', '+not-found'])} />;
}
