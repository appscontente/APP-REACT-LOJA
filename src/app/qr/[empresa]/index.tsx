import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { useFigital } from '@/estado/figital';
import { rotaLoja } from '@/lib/rotas';

type Situacao = { tipo: 'carregando' } | { tipo: 'ir'; destino: string } | { tipo: 'sem-conexao' } | { tipo: 'outra-empresa' };

/** QR da loja (/qr/{CODEMP}): entra no modo loja e abre o portal dela. */
export default function QrLoja() {
  const { empresa } = useLocalSearchParams<{ empresa: string }>();
  const { carregarLojas, entrar } = useFigital();
  const [situacao, setSituacao] = useState<Situacao>({ tipo: 'carregando' });
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    carregarLojas().then(
      (lojas) => {
        if (!ativo) return;
        const loja = lojas.find((l) => l.codigoEmpresa === Number(empresa));
        if (loja) entrar(loja.slug);
        setSituacao(loja ? { tipo: 'ir', destino: rotaLoja(loja.slug) } : { tipo: 'outra-empresa' });
      },
      () => ativo && setSituacao({ tipo: 'sem-conexao' }),
    );
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, tentativa]);

  if (situacao.tipo === 'ir') return <Redirect href={situacao.destino as never} />;
  return (
    <>
      <Stack.Screen options={{ title: situacao.tipo === 'carregando' ? 'Abrindo a loja…' : '' }} />
      {situacao.tipo === 'carregando' ? (
        <Carregando />
      ) : situacao.tipo === 'sem-conexao' ? (
        <Aviso
          titulo="Sem conexão"
          texto="Confira a internet e tente de novo."
          acao="Tentar de novo"
          aoTocar={() => {
            setSituacao({ tipo: 'carregando' });
            setTentativa((t) => t + 1);
          }}
          triste
        />
      ) : (
        <Aviso
          titulo="Loja não encontrada"
          texto="Este QR não é de uma das nossas lojas."
          acao="Ir para o início"
          aoTocar={() => router.dismissTo('/')}
          triste
        />
      )}
    </>
  );
}
