import { useId } from 'react';
import { InputAccessoryView, Keyboard, Platform, Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { cores, fontes, raio } from '@/lib/tema';
import { Texto } from './texto';

/** O teclado de números do iPhone não tem botão de fechar: o campo ganha um "OK" em cima do teclado. */
const SEM_ENTER = ['number-pad', 'decimal-pad', 'numeric', 'phone-pad'];

export function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  const id = useId();
  const comOk = Platform.OS === 'ios' && SEM_ENTER.includes(props.keyboardType ?? '');
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <TextInput
        placeholderTextColor={cores.textoSuave}
        inputAccessoryViewID={comOk ? id : undefined}
        {...props}
        style={[estilos.entrada, style]}
      />
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
    height: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    fontFamily: fontes.textoMedio,
    color: cores.texto,
    backgroundColor: cores.superficie,
  },
  barra: {
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: cores.fundoAlt,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: cores.borda,
  },
});
