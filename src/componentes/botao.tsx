import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps, type ViewStyle } from 'react-native';

import { cores, fontes, raio } from '@/lib/tema';
import { Texto } from './texto';

type Variante = 'principal' | 'secundario' | 'sorriso' | 'contorno' | 'texto';

const FUNDO: Record<Variante, { fundo: string; texto: string; borda?: string }> = {
  principal: { fundo: cores.marca, texto: '#fff' },
  secundario: { fundo: cores.texto, texto: '#fff' },
  sorriso: { fundo: cores.sorriso, texto: cores.texto },
  contorno: { fundo: 'transparent', texto: cores.texto, borda: cores.borda },
  texto: { fundo: 'transparent', texto: cores.marca },
};

export function Botao({
  titulo,
  variante = 'principal',
  carregando,
  icone,
  style,
  disabled,
  ...props
}: PressableProps & { titulo: string; variante?: Variante; carregando?: boolean; icone?: React.ReactNode; style?: ViewStyle }) {
  const v = FUNDO[variante];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || carregando}
      {...props}
      style={({ pressed }) => [
        estilos.base,
        { backgroundColor: v.fundo, borderColor: v.borda ?? v.fundo },
        variante === 'texto' && estilos.texto,
        (pressed || disabled) && { opacity: disabled ? 0.5 : 0.85 },
        style,
      ]}>
      {carregando ? (
        <ActivityIndicator color={v.texto} />
      ) : (
        <View style={estilos.conteudo}>
          {icone}
          <Texto style={estilos.rotulo} cor={v.texto}>
            {titulo}
          </Texto>
        </View>
      )}
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  base: {
    minHeight: 48,
    paddingHorizontal: 20,
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 44 pt: a área mínima de toque (o botão de descartar o comprovante e o de tirar do carrinho usam esta variante).
  texto: { minHeight: 44, paddingHorizontal: 8 },
  conteudo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rotulo: { fontFamily: fontes.titulo, fontSize: 16 },
});
