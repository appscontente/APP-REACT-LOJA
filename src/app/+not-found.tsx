import { router, Stack } from 'expo-router';

import { Aviso } from '@/componentes/estado-tela';

export default function NaoEncontrado() {
  return (
    <>
      <Stack.Screen options={{ title: 'Página não encontrada' }} />
      <Aviso titulo="Não achamos esta página" texto="O link pode ter mudado. Que tal começar pelo início?" acao="Ir para o início" aoTocar={() => router.replace('/')} triste />
    </>
  );
}
