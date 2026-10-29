import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';

/** Orçamento do vendedor (/orcamento/{token}). Quando a conversa existir no backend, vira cartão na própria conversa. */
export default function Orcamento() {
  const { token } = useLocalSearchParams<{ token: string }>();
  return <AbrirNoSite caminho={`/orcamento/${encodeURIComponent(token)}`} />;
}
