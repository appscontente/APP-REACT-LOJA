import { useLocalSearchParams } from 'expo-router';

import { AbrirNoSite } from '@/componentes/abrir-no-site';

/** Link de cobrança avulsa da aba Financeiro (/pagar/{codigo}), com o pagamento e a ClearSale do site. */
export default function Pagar() {
  const { codigo } = useLocalSearchParams<{ codigo: string }>();
  return <AbrirNoSite caminho={`/pagar/${encodeURIComponent(codigo)}`} />;
}
