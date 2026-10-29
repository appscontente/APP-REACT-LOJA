import { useLocalSearchParams } from 'expo-router';

import { Carregando } from '@/componentes/estado-tela';
import { TelaLista } from '@/componentes/tela-lista';
import { api } from '@/lib/api';
import { useDados } from '@/lib/use-dados';

/** /{departamento}/{categoria}, o mesmo endereço do site. */
export default function Categoria() {
  const { segmento, categoria } = useLocalSearchParams<{ segmento: string; categoria: string }>();
  const { dados } = useDados(() => api.departamentos(), []);
  if (!dados) return <Carregando />;
  const nome = dados.find((d) => d.slug === segmento)?.categorias.find((c) => c.slug === categoria)?.nome;
  return <TelaLista titulo={nome ?? 'Produtos'} departamento={segmento} categoria={categoria} />;
}
