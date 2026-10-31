import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { TelaLista } from '@/componentes/tela-lista';
import { api } from '@/lib/api';
import { caminhoComQuery } from '@/lib/rotas';
import { useDados } from '@/lib/use-dados';

/**
 * /{departamento}, o mesmo endereço do site. O site usa o mesmo formato para as páginas institucionais
 * (/politica-de-entrega): o que não é departamento abre no navegador do app, com a query junto.
 */
export default function Departamento() {
  const params = useLocalSearchParams<{ segmento: string }>();
  const { segmento } = params;
  const { dados, erro, carregando, recarregar } = useDados(() => api.departamentos(), []);
  const departamento = dados?.find((d) => d.slug === segmento);

  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  if (!departamento) return <AbrirNoSite caminho={caminhoComQuery(`/${encodeURIComponent(segmento)}`, params, ['segmento'])} />;
  return <TelaLista titulo={departamento.nome} departamento={segmento} categorias={departamento.categorias} />;
}
