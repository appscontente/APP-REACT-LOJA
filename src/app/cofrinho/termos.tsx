// Regulamento e termo de adesão do Cofrinho Contente (mesmo endereço e mesmo texto da página do site, /cofrinho/termos).

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
          Versão de {dados.atualizadoEm}. Vale para os cofrinhos abertos a partir dessa data. Conferência {dados.hash.slice(0, 12)}.
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
      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo" accessibilityRole="header">
          Termo de adesão
        </Texto>
        {dados.declaracoes.map((d, i) => (
          <Texto key={d.id} cor={cores.textoSuave}>
            {i + 1}. {d.texto}
          </Texto>
        ))}
        <Texto cor={cores.textoSuave}>À parte, já marcada e opcional (dá para desmarcar): {dados.ofertas.texto}</Texto>
        {dados.aceite ? <Texto cor={cores.textoSuave}>{dados.aceite}</Texto> : null}
      </View>
      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo" accessibilityRole="header">
          Condições do bônus
        </Texto>
        <Texto cor={cores.textoSuave}>{dados.condicoesBonus.texto}</Texto>
      </View>
    </ScrollView>
  );
}
