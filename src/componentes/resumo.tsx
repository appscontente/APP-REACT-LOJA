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
      {linhas.map(([rotulo, valor, cor]) => (
        <View key={rotulo} style={estilos.linha}>
          <Texto cor={cores.textoSuave}>{rotulo}</Texto>
          <Texto variante="forte" cor={cor ?? cores.texto}>
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
  linha: { flexDirection: 'row', justifyContent: 'space-between' },
  total: { borderTopWidth: 1, borderTopColor: cores.borda, paddingTop: 10, marginTop: 4 },
});
