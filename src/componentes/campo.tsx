import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { cores, fontes, raio } from '@/lib/tema';
import { Texto } from './texto';

export function Campo({ rotulo, style, ...props }: TextInputProps & { rotulo: string }) {
  return (
    <View style={{ gap: 4, flex: 1 }}>
      <Texto variante="rotulo">{rotulo}</Texto>
      <TextInput placeholderTextColor={cores.textoSuave} {...props} style={[estilos.entrada, style]} />
    </View>
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
});
