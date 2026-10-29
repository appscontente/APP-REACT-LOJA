import { StyleSheet, View } from 'react-native';

import { cores, fontes, raio } from '@/lib/tema';
import { Texto } from './texto';

const CORES: Record<string, { fundo: string; texto: string }> = {
  marca: { fundo: cores.marca, texto: '#fff' },
  sorriso: { fundo: cores.sorriso, texto: cores.texto },
  escuro: { fundo: cores.texto, texto: '#fff' },
  verde: { fundo: cores.sucesso, texto: '#fff' },
};

export function Selo({ texto, cor = 'marca' }: { texto: string; cor?: string }) {
  const c = CORES[cor] ?? CORES.marca;
  return (
    <View style={[estilos.selo, { backgroundColor: c.fundo }]}>
      <Texto style={estilos.texto} cor={c.texto}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  selo: { alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: raio.pilula },
  texto: { fontFamily: fontes.titulo, fontSize: 12, lineHeight: 16 },
});
