// Cores e fontes da marca, as mesmas do site (loja/src/app/globals.css): vermelho e amarelo do logo, Fredoka nos
// títulos, menus e botões, Manrope no texto corrido.

export const cores = {
  marca: '#d71921',
  marcaEscura: '#b0141b',
  sorriso: '#fdb917',
  creme: '#fff6dc',
  texto: '#3c3c3a',
  textoSuave: '#6b655e',
  fundo: '#faf8f5',
  fundoAlt: '#f3efe9',
  superficie: '#ffffff',
  borda: '#e7e1d8',
  sucesso: '#1f5f3a',
  sucessoFundo: '#e6f2ea',
  aviso: '#8a5a00',
  avisoFundo: '#fff3d6',
} as const;

export const fontes = {
  titulo: 'Fredoka_600SemiBold',
  tituloMedio: 'Fredoka_500Medium',
  texto: 'Manrope_400Regular',
  textoForte: 'Manrope_700Bold',
  textoMedio: 'Manrope_600SemiBold',
} as const;

export const espaco = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const raio = { s: 8, m: 12, l: 16, xl: 24, pilula: 999 } as const;
