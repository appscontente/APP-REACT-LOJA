import { Redirect, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { useFigital } from '@/estado/figital';
import { rotaLoja } from '@/lib/rotas';

/** QR da loja (/qr/{CODEMP}): entra no modo loja e abre o portal dela. */
export default function QrLoja() {
  const { empresa } = useLocalSearchParams<{ empresa: string }>();
  const { carregarLojas, entrar } = useFigital();
  const [destino, setDestino] = useState<string | null>();
  useEffect(() => {
    carregarLojas().then((lojas) => {
      const loja = lojas.find((l) => l.codigoEmpresa === Number(empresa));
      if (loja) entrar(loja.slug);
      setDestino(loja ? rotaLoja(loja.slug) : null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa]);
  if (destino === undefined) return <Carregando />;
  if (destino === null) return <Aviso titulo="Loja não encontrada" texto="Este QR não é de uma das nossas lojas." triste />;
  return <Redirect href={destino as never} />;
}
