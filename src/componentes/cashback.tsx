import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import { textoPorcento, usePreviaCashback } from '@/lib/use-cashback';
import type { PreviaCashback } from '@/lib/tipos';
import { Texto } from './texto';

/** Página do produto: "Ganhe R$ X de cashback (2% de volta): prazos." Sem margem ou sem resposta, nada. */
export function CashbackDoProduto({ codprod, preco }: { codprod: string; preco: number }) {
  const previa = usePreviaCashback([{ codprod, total: preco }]);
  const item = previa.itens?.[codprod];
  if (!item || item.valor <= 0) return null;
  return (
    <View style={estilos.caixa}>
      <Ionicons name="wallet-outline" size={20} color={cores.sucesso} />
      <Texto variante="pequeno" cor={cores.sucesso} style={{ flex: 1 }}>
        Ganhe {formatarPreco(item.valor)} de cashback ({textoPorcento(item.percentual)} de volta)
        {previa.prazos ? `: ${previa.prazos}` : ''}.
      </Texto>
    </View>
  );
}

/** Linha do item no carrinho: valor e %, ou o aviso de que o item não dá cashback. */
export function CashbackDoItem({ previa, codprod }: { previa: PreviaCashback; codprod: string }) {
  const item = previa.itens?.[codprod];
  if (!item) return null;
  return (
    <Texto variante="pequeno" cor={item.valor > 0 ? cores.sucesso : cores.textoSuave}>
      {item.valor > 0 ? `Cashback: ${formatarPreco(item.valor)} (${textoPorcento(item.percentual)})` : 'Este produto não dá cashback'}
    </Texto>
  );
}

/** Total do carrinho ou do checkout. `ate`: no carrinho é estimativa ("até"); no checkout, o valor da compra. */
export function CashbackDoPedido({ previa, ate }: { previa: PreviaCashback; ate?: boolean }) {
  if (!previa.total || previa.total <= 0) return null;
  return (
    <View style={estilos.caixa}>
      <Ionicons name="wallet-outline" size={20} color={cores.sucesso} />
      <Texto variante="pequeno" cor={cores.sucesso} style={{ flex: 1 }}>
        Você ganha {ate ? 'até ' : ''}
        {formatarPreco(previa.total)} de cashback{previa.prazos ? `: ${previa.prazos}` : ''}.
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.sucessoFundo },
});
