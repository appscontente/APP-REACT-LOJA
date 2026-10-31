import { useLocalSearchParams } from 'expo-router';

import { TelaLista } from '@/componentes/tela-lista';

/**
 * /colecao/{slug}, o mesmo endereço do site: a vitrine inteira do "Ver tudo" do início (GET /api/app/produtos?colecao=).
 * O nome vem no ?nome= do link do início; aberta por um link do site, sem o nome, o título sai do próprio endereço.
 */
export default function Colecao() {
  const { slug, nome } = useLocalSearchParams<{ slug: string; nome?: string }>();
  const titulo = nome?.trim() || (slug ? slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, ' ') : 'Vitrine');
  return <TelaLista titulo={titulo} colecao={slug} />;
}
