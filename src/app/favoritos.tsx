import { router, Stack } from 'expo-router';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { GradeProdutos } from '@/componentes/grade-produtos';
import { useConta } from '@/estado/conta';
import { api } from '@/lib/api';
import { useDados } from '@/lib/use-dados';

/** Favoritos com preço e estoque atuais. Com o backend, avisa no celular quando baixa o preço ou volta ao estoque. */
export default function Favoritos() {
  const { favoritos } = useConta();
  const chave = favoritos.join(',');
  const { dados, carregando, recarregar } = useDados(
    () => (favoritos.length ? api.produtos({ codprods: favoritos }) : Promise.resolve([])),
    [chave],
  );
  return (
    <>
      <Stack.Screen options={{ title: 'Favoritos' }} />
      {!dados && carregando ? (
        <Carregando />
      ) : (
        <GradeProdutos
          produtos={dados ?? []}
          atualizando={carregando}
          aoAtualizar={recarregar}
          vazio={<Aviso titulo="Nenhum favorito ainda" texto="Toque no coração dos produtos para guardar aqui." acao="Ver ofertas" aoTocar={() => router.push('/ofertas')} />}
        />
      )}
    </>
  );
}
