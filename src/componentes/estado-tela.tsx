import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { cores } from '@/lib/tema';
import { Botao } from './botao';
import { Sorriso } from './logo';
import { Texto } from './texto';

export function Carregando() {
  return (
    <View style={estilos.centro}>
      <ActivityIndicator color={cores.marca} size="large" />
    </View>
  );
}

export function Aviso({
  titulo,
  texto,
  acao,
  aoTocar,
  secundaria,
  triste,
}: {
  titulo: string;
  texto?: string;
  acao?: string;
  aoTocar?: () => void;
  /** Segundo botão, de contorno, logo abaixo do principal (ex.: "Ir para o início" na tela de erro). */
  secundaria?: { titulo: string; aoTocar: () => void };
  triste?: boolean;
}) {
  return (
    <View style={estilos.centro}>
      <Sorriso largura={72} cor={triste ? cores.textoSuave : cores.sorriso} triste={triste} />
      <Texto variante="subtitulo" style={estilos.texto}>
        {titulo}
      </Texto>
      {texto ? (
        <Texto cor={cores.textoSuave} style={estilos.texto}>
          {texto}
        </Texto>
      ) : null}
      {acao && aoTocar ? <Botao titulo={acao} onPress={aoTocar} style={{ marginTop: 8 }} /> : null}
      {secundaria ? <Botao titulo={secundaria.titulo} variante="contorno" onPress={secundaria.aoTocar} /> : null}
    </View>
  );
}

export const Erro = ({ mensagem, tentar }: { mensagem: string; tentar: () => void }) => (
  <Aviso titulo="Algo não carregou" texto={mensagem} acao="Tentar de novo" aoTocar={tentar} triste />
);

const estilos = StyleSheet.create({
  centro: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 12, minHeight: 280 },
  texto: { textAlign: 'center' },
});
