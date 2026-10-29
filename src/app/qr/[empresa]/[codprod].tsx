import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { rotaFigital, rotaLoja } from '@/lib/rotas';

/** QR da etiqueta (/qr/{CODEMP}/{CODPROD}): abre o produto naquela loja, mesmo sem foto, já no modo loja. */
export default function QrProduto() {
  const { empresa, codprod } = useLocalSearchParams<{ empresa: string; codprod: string }>();
  const { carregarLojas, entrar } = useFigital();
  const [destino, setDestino] = useState<string | null>();
  useEffect(() => {
    (async () => {
      const loja = (await carregarLojas()).find((l) => l.codigoEmpresa === Number(empresa));
      if (!loja) return setDestino(null);
      entrar(loja.slug);
      const achado = await api.produtoNaLoja(loja.slug, { codprod }).catch(() => undefined);
      setDestino(achado ? rotaFigital(loja.slug, achado.produto.slug) : rotaLoja(loja.slug));
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, codprod]);
  if (destino === undefined) return <Carregando />;
  if (destino === null) return <Aviso titulo="Etiqueta não reconhecida" texto="Este QR não é de uma das nossas lojas. Fale com um vendedor." triste />;
  return <Redirect href={destino as never} />;
}
