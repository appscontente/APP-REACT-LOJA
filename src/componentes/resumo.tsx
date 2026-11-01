import { StyleSheet, View } from 'react-native';

import { formatarPreco } from '@/lib/formatar';
import { cores } from '@/lib/tema';
import { Texto } from './texto';

/** Linhas de valores (subtotal, frete, descontos, total). */
export function Resumo({
  linhas,
  total,
  rodape,
  rotuloTotal = 'Total',
}: {
  linhas: [string, string, string?][];
  total: number;
  rodape?: string;
  /** Ex.: "Total no caixa" no carrinho da loja. */
  rotuloTotal?: string;
}) {
  return (
    <View style={estilos.caixa}>
      {/* Chave por posição e rótulo: duas promoções (ou dois brindes) podem ter o mesmo nome. */}
      {linhas.map(([rotulo, valor, cor], i) => (
        <View key={`${i}-${rotulo}`} style={estilos.linha}>
          <Texto cor={cores.textoSuave} style={estilos.rotulo}>
            {rotulo}
          </Texto>
          {/* O valor nunca quebra ("- R$ 143,98" ficava com o sinal numa linha e o valor na outra); o rótulo é que dobra. */}
          <Texto variante="forte" cor={cor ?? cores.texto} style={estilos.valor}>
            {valor}
          </Texto>
        </View>
      ))}
      <View style={[estilos.linha, estilos.total]}>
        <Texto variante="subtitulo">{rotuloTotal}</Texto>
        <Texto variante="subtitulo">{formatarPreco(total)}</Texto>
      </View>
      {rodape ? (
        <Texto variante="pequeno" cor={cores.sucesso} style={{ textAlign: 'right' }}>
          {rodape}
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { gap: 8 },
  linha: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  rotulo: { flex: 1 },
  valor: { flexShrink: 0, textAlign: 'right' },
  total: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 10, marginTop: 4 },
});
