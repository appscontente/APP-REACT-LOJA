import { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { cores, fontes, raio } from '@/lib/tema';
import { Texto } from './texto';

/** O teclado de números do iPhone não tem botão de fechar: o campo ganha um "OK" em cima do teclado. */
const SEM_ENTER = ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'];

/**
 * Campo com rótulo em cima. O rótulo também é o nome lido pelo leitor de tela. `erro` aparece embaixo do campo, com a
 * borda em vermelho.
 */
export function Campo({ rotulo, erro, style, ...props }: TextInputProps & { rotulo: string; erro?: string }) {
  const id = useId();
  const comOk = Platform.OS === 'ios' && SEM_ENTER.includes(props.keyboardType ?? '');
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        inputAccessoryViewID={comOk ? id : undefined}
        accessibilityLabel={rotulo}
        accessibilityHint={erro}
        {...props}
        style={[estilos.entrada, erro ? estilos.entradaErro : null, style]}
      />
      {erro ? (
        <Texto variante="pequeno" cor={cores.marca}>
          {erro}
        </Texto>
      ) : null}
      {comOk ? <BarraOk id={id} /> : null}
    </View>
  );
}

/** Barra com "OK" em cima do teclado (só iPhone). Use o mesmo `id` em `inputAccessoryViewID` do campo. */
export function BarraOk({ id }: { id: string }) {
  return (
    <InputAccessoryView nativeID={id}>
      <View style={estilos.barra}>
        <Pressable onPress={Keyboard.dismiss} hitSlop={10} accessibilityRole="button" accessibilityLabel="Fechar o teclado">
          <Texto variante="forte" cor={cores.marca}>
            OK
          </Texto>
        </Pressable>
      </View>
    </InputAccessoryView>
  );
}

const estilos = StyleSheet.create({
  entrada: {
    borderWidth: 1.5,
    borderColor: cores.borda,
    borderRadius: raio.m,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 10,
    fontSize: 16,
    fontFamily: fontes.textoMedio,
    color: cores.texto,
    backgroundColor: cores.superficie,
  },
  entradaErro: { borderColor: cores.marca },
  barra: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: cores.fundoAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
});
