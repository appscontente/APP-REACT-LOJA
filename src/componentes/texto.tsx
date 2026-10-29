import { Text, type TextProps, type TextStyle } from 'react-native';

import { cores, fontes } from '@/lib/tema';

const VARIANTES = {
  titulo: { fontFamily: fontes.titulo, fontSize: 24, lineHeight: 30 },
  subtitulo: { fontFamily: fontes.titulo, fontSize: 18, lineHeight: 24 },
  secao: { fontFamily: fontes.titulo, fontSize: 20, lineHeight: 26 },
  corpo: { fontFamily: fontes.texto, fontSize: 15, lineHeight: 22 },
  forte: { fontFamily: fontes.textoForte, fontSize: 15, lineHeight: 22 },
  pequeno: { fontFamily: fontes.texto, fontSize: 13, lineHeight: 18 },
  rotulo: { fontFamily: fontes.textoMedio, fontSize: 13, lineHeight: 18 },
} satisfies Record<string, TextStyle>;

export type VarianteTexto = keyof typeof VARIANTES;

export function Texto({
  variante = 'corpo',
  cor = cores.texto,
  style,
  ...props
}: TextProps & { variante?: VarianteTexto; cor?: string }) {
  return <Text {...props} style={[VARIANTES[variante], { color: cor }, style]} />;
}
