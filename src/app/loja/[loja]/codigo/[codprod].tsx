import { Redirect, useLocalSearchParams } from 'expo-router';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { api } from '@/lib/api';
import { rotaFigital } from '@/lib/rotas';
import { useDados } from '@/lib/use-dados';

/** Código da etiqueta digitado dentro da loja (CODPROD): abre o produto nela. */
export default function CodigoNaLoja() {
  const { loja, codprod } = useLocalSearchParams<{ loja: string; codprod: string }>();
  const { dados, erro, carregando } = useDados(() => api.produtoNaLoja(loja, { codprod }), [loja, codprod]);
  if (carregando) return <Carregando />;
  if (!dados) return <Aviso titulo="Código não encontrado" texto={erro} triste />;
  return <Redirect href={rotaFigital(loja, dados.produto.slug) as never} />;
}
