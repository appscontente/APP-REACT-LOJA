import { StyleSheet, View } from 'react-native';

import { useRegraPagamento } from '@/estado/pagamento';
import { calcularParcelas, DESCONTO_PIX, formatarPreco, precoPix } from '@/lib/formatar';
import { cores } from '@/lib/tema';
import type { Pagamento } from '@/lib/tipos';
import { Texto } from './texto';

/** Preço de/por, à vista no Pix e parcelas sem juros, na ordem do site. Sem `pagamento`, vale a regra que o site mandou. */
export function Preco({
  preco,
  precoDe,
  descontoPix = DESCONTO_PIX,
  pagamento,
  tamanho = 'card',
}: {
  preco: number;
  precoDe?: number;
  descontoPix?: number;
  pagamento?: Pick<Pagamento, 'maxParcelas' | 'parcelaMinima'>;
  tamanho?: 'card' | 'pagina';
}) {
  const regra = useRegraPagamento();
  const parcelas = calcularParcelas(preco, pagamento ?? regra);
  const grande = tamanho === 'pagina';
  return (
    <View style={estilos.coluna}>
      {precoDe && precoDe > preco ? (
        <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.de}>
          {formatarPreco(precoDe)}
        </Texto>
      ) : null}
      <Texto variante={grande ? 'titulo' : 'subtitulo'} cor={cores.texto}>
        {formatarPreco(preco)}
      </Texto>
      {descontoPix > 0 && (
        <Texto variante={grande ? 'forte' : 'pequeno'} cor={cores.sucesso}>
          {formatarPreco(precoPix(preco, descontoPix))} no Pix ({Math.round(descontoPix * 100)}% off)
        </Texto>
      )}
      {parcelas.quantidade > 1 && (
        <Texto variante="pequeno" cor={cores.textoSuave}>
          ou {parcelas.quantidade}x de {formatarPreco(parcelas.valor)} sem juros
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  coluna: { gap: 2 },
  de: { textDecorationLine: 'line-through' },
});
