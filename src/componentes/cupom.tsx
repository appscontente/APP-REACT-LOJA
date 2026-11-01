import { useEffect, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';

import { cores } from '@/lib/tema';
import type { ResultadoCalculo } from '@/lib/tipos';
import { Botao } from './botao';
import { Campo } from './campo';
import { Texto } from './texto';

/**
 * Cupom de desconto do carrinho e do checkout, como o do site: o código fica guardado no celular até ser tirado, e a
 * mensagem vem do site (`resultado.cupom.mensagem`): verde quando valeu, vermelha quando não, dizendo por quê. Um
 * cupom guardado que deixou de valer continua aparecendo com a mensagem, para o cliente tirar.
 */
export function Cupom({
  cupom,
  resultado,
  carregando,
  aoAplicar,
  aoTirar,
}: {
  /** Código guardado; vazio quando não há cupom. */
  cupom: string;
  /** `resultado.cupom` do cálculo do site. Só conta quando é deste código. */
  resultado?: ResultadoCalculo['cupom'];
  /** O site ainda está conferindo o carrinho. */
  carregando?: boolean;
  aoAplicar: (codigo: string) => void;
  aoTirar: () => void;
}) {
  const [digitado, setDigitado] = useState('');
  const aplicado = cupom.length > 0;
  const situacao = aplicado && resultado?.codigo === cupom ? resultado : undefined;
  // Leitor de tela: avisa quando o site responde se o cupom valeu (a cor sozinha não diz).
  const mensagem = situacao?.mensagem;
  useEffect(() => {
    if (mensagem) AccessibilityInfo.announceForAccessibility(mensagem);
  }, [mensagem]);

  const aplicar = () => {
    const codigo = digitado.trim();
    if (!codigo) return;
    aoAplicar(codigo);
    setDigitado('');
  };

  return (
    <View style={estilos.caixa}>
      <View style={estilos.linha}>
        <Campo
          rotulo="Cupom de desconto"
          value={aplicado ? cupom : digitado}
          onChangeText={setDigitado}
          editable={!aplicado}
          autoCapitalize="characters"
          autoCorrect={false}
          spellCheck={false}
          autoComplete="off"
          maxLength={40}
          returnKeyType="done"
          onSubmitEditing={aplicar}
          placeholder="Digite o código"
          accessibilityLabel={aplicado ? `Cupom aplicado: ${cupom}` : 'Cupom de desconto'}
          accessibilityHint={aplicado ? 'Toque em Tirar para remover o cupom' : 'Digite o código e toque em Aplicar'}
          style={aplicado ? estilos.aplicado : undefined}
        />
        <View style={estilos.botao}>
          <Botao
            titulo={aplicado ? 'Tirar' : 'Aplicar'}
            variante="contorno"
            disabled={!aplicado && !digitado.trim()}
            onPress={aplicado ? aoTirar : aplicar}
            accessibilityLabel={aplicado ? `Tirar o cupom ${cupom}` : 'Aplicar o cupom'}
          />
        </View>
      </View>
      {situacao ? (
        <Texto variante="pequeno" cor={situacao.valido ? cores.sucesso : cores.marca} accessibilityLiveRegion="polite">
          {situacao.mensagem}
        </Texto>
      ) : aplicado && carregando ? (
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Conferindo o cupom…
        </Texto>
      ) : null}
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { gap: 6 },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  // O botão alinha com a caixa de texto, que fica abaixo do rótulo do campo.
  botao: { justifyContent: 'flex-end', minHeight: 48 + 22 },
  aplicado: { backgroundColor: cores.fundoAlt },
});
