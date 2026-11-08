// Termos e condições do Cofrinho Contente (mesmo endereço e mesmo texto da página do site, /cofrinho/termos).

import { ScrollView, View } from 'react-native';

import { Carregando, Erro } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { api } from '@/lib/api';
import { cores } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function TermosCofrinho() {
  const { dados, erro, carregando, recarregar } = useDados(() => api.termosCofrinho(), []);
  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 20, paddingBottom: 120 }}>
      <View style={{ gap: 4 }}>
        <Texto variante="titulo">{dados.titulo}</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Versão de {dados.atualizadoEm}. Vale para os cofrinhos abertos a partir dessa data.
        </Texto>
      </View>
      {dados.secoes.map((s) => (
        <View key={s.titulo} style={{ gap: 8 }}>
          <Texto variante="subtitulo" accessibilityRole="header">
            {s.titulo}
          </Texto>
          {s.paragrafos.map((p) => (
            <Texto key={p.slice(0, 40)} cor={cores.textoSuave}>
              {p}
            </Texto>
          ))}
        </View>
      ))}
    </ScrollView>
  );
}
