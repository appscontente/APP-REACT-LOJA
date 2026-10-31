import { Redirect, router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { useFigital } from '@/estado/figital';
import { api, ErroApi } from '@/lib/api';
import { rotaFigital, rotaLoja } from '@/lib/rotas';

type Situacao =
  | { tipo: 'carregando' }
  | { tipo: 'ir'; destino: string }
  | { tipo: 'falha'; semRede: boolean; mensagem: string }
  | { tipo: 'outra-empresa' }
  | { tipo: 'sem-produto'; loja: string };

/** QR da etiqueta (/qr/{CODEMP}/{CODPROD}): abre o produto naquela loja, mesmo sem foto, já no modo loja. */
export default function QrProduto() {
  const { empresa, codprod } = useLocalSearchParams<{ empresa: string; codprod: string }>();
  const { carregarLojas, entrar } = useFigital();
  const [situacao, setSituacao] = useState<Situacao>({ tipo: 'carregando' });
  // Muda a cada "Tentar de novo", para repetir a leitura.
  const [tentativa, setTentativa] = useState(0);
  useEffect(() => {
    let ativo = true;
    (async () => {
      const lojas = await carregarLojas().catch(() => undefined);
      if (!ativo) return;
      if (!lojas) return setSituacao({ tipo: 'falha', semRede: true, mensagem: 'Confira a internet e tente de novo.' });
      const loja = lojas.find((l) => l.codigoEmpresa === Number(empresa));
      if (!loja) return setSituacao({ tipo: 'outra-empresa' });
      entrar(loja.slug);
      try {
        const achado = await api.produtoNaLoja(loja.slug, { codprod });
        if (ativo) setSituacao({ tipo: 'ir', destino: rotaFigital(loja.slug, achado.produto.slug) });
      } catch (e) {
        if (!ativo) return;
        if (e instanceof ErroApi && e.status === 404) setSituacao({ tipo: 'sem-produto', loja: loja.slug });
        else
          setSituacao({
            tipo: 'falha',
            semRede: !(e instanceof ErroApi) || e.status === 0,
            mensagem: e instanceof ErroApi ? e.message : 'Não conseguimos abrir agora. Tente de novo.',
          });
      }
    })();
    return () => {
      ativo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [empresa, codprod, tentativa]);

  const titulo = <Stack.Screen options={{ title: situacao.tipo === 'carregando' ? 'Abrindo produto…' : '' }} />;
  const tentar = () => {
    setSituacao({ tipo: 'carregando' });
    setTentativa((t) => t + 1);
  };
  if (situacao.tipo === 'ir') return <Redirect href={situacao.destino as never} />;
  return (
    <>
      {titulo}
      {situacao.tipo === 'carregando' ? (
        <Carregando />
      ) : situacao.tipo === 'falha' ? (
        <Aviso
          titulo={situacao.semRede ? 'Sem conexão' : 'Algo não carregou'}
          texto={situacao.mensagem}
          acao="Tentar de novo"
          aoTocar={tentar}
          triste
        />
      ) : situacao.tipo === 'sem-produto' ? (
        <Aviso
          titulo="Não achamos este produto nesta loja"
          texto="Leia outra etiqueta ou veja os produtos da loja."
          acao="Ir para a loja"
          aoTocar={() => router.replace(rotaLoja(situacao.loja) as never)}
          triste
        />
      ) : (
        <Aviso
          titulo="Etiqueta não reconhecida"
          texto="Este QR não é de uma das nossas lojas. Fale com um vendedor."
          acao="Ir para o início"
          aoTocar={() => router.dismissTo('/')}
          triste
        />
      )}
    </>
  );
}
