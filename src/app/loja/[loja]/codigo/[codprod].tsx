import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { api } from '@/lib/api';
import { rotaFigital } from '@/lib/rotas';
import { useDados } from '@/lib/use-dados';

/** Código da etiqueta digitado dentro da loja (CODPROD): abre o produto nela. */
export default function CodigoNaLoja() {
  const { loja, codprod } = useLocalSearchParams<{ loja: string; codprod: string }>();
  const { dados, erro, status, carregando, recarregar } = useDados(() => api.produtoNaLoja(loja, { codprod }), [loja, codprod]);
  if (carregando)
    return (
      <>
        <Stack.Screen options={{ title: 'Abrindo produto…' }} />
        <Carregando />
      </>
    );
  if (!dados) {
    // Sem status (ou 0), foi a rede que falhou: dá para tentar de novo. Com resposta do site, o código não existe na loja.
    const semRede = !status;
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        {semRede ? (
          <Aviso titulo="Sem conexão" texto={erro} acao="Tentar de novo" aoTocar={recarregar} triste />
        ) : (
          <Aviso
            titulo="Código não encontrado"
            texto={erro}
            acao="Ler ou digitar outro código"
            aoTocar={() => router.replace('/leitor')}
            triste
          />
        )}
      </>
    );
  }
  return <Redirect href={rotaFigital(loja, dados.produto.slug) as never} />;
}
