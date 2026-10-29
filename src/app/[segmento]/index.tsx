import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';
import { Carregando } from '@/componentes/estado-tela';
import { TelaLista } from '@/componentes/tela-lista';
import { api } from '@/lib/api';
import { useDados } from '@/lib/use-dados';

/**
 * /{departamento}, o mesmo endereço do site. O site usa o mesmo formato para as páginas institucionais
 * (/politica-de-entrega): o que não é departamento abre no navegador do app.
 */
export default function Departamento() {
  const { segmento } = useLocalSearchParams<{ segmento: string }>();
  const { dados } = useDados(() => api.departamentos(), []);
  const departamento = dados?.find((d) => d.slug === segmento);

  if (!dados) return <Carregando />;
  if (!departamento) return <AbrirNoSite caminho={`/${segmento}`} />;
  return <TelaLista titulo={departamento.nome} departamento={segmento} />;
}
