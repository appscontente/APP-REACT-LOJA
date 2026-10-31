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
    // 404/410: o código não existe (ou saiu) nesta loja. Qualquer outra falha (rede ou erro do site) dá para tentar de novo.
    const daParaTentar = status !== 404 && status !== 410;
    return (
      <>
        <Stack.Screen options={{ title: '' }} />
        {daParaTentar ? (
          <Aviso titulo="Algo não carregou" texto={erro} acao="Tentar de novo" aoTocar={recarregar} triste />
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
