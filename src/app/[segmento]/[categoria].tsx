import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { TelaLista } from '@/componentes/tela-lista';
import { api } from '@/lib/api';
import { caminhoComQuery } from '@/lib/rotas';
import { useDados } from '@/lib/use-dados';

/**
 * /{departamento}/{categoria}, o mesmo endereço do site. Endereço de duas partes que não é categoria (listas de
 * presente, ambientes, ajuda, institucional, minha-conta/dados...) abre no navegador do app, com a query junto. A
 * vitrine (/colecao/{slug}) tem tela própria em app/colecao.
 */
export default function Categoria() {
  const params = useLocalSearchParams<{ segmento: string; categoria: string }>();
  const { segmento, categoria } = params;
  const { dados, erro, carregando, recarregar } = useDados(() => api.departamentos(), []);

  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const departamento = dados.find((d) => d.slug === segmento);
  const nome = departamento?.categorias.find((c) => c.slug === categoria)?.nome;
  if (!departamento || !nome) {
    const caminho = `/${encodeURIComponent(segmento)}/${encodeURIComponent(categoria)}`;
    return <AbrirNoSite caminho={caminhoComQuery(caminho, params, ['segmento', 'categoria'])} />;
  }
  return <TelaLista titulo={nome} departamento={segmento} categoria={categoria} categorias={departamento.categorias} />;
}
