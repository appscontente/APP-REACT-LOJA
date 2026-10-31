import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';

/**
 * Orçamento do vendedor (/orcamento/{token}). Quando a conversa existir no backend, vira cartão na própria conversa.
 * O ?app=1 avisa a página do site que ela abriu dentro do app (para esconder o WhatsApp e dizer que a compra deste
 * orçamento termina ali); sem suporte no site, o parâmetro é ignorado.
 */
export default function Orcamento() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <AbrirNoSite caminho={`/orcamento/${encodeURIComponent(token)}?app=1`} />;
}
