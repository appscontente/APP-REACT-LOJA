// Cofrinho Contente (mesmo endereço da página do site, /cofrinho): como funciona e os cofrinhos do cliente. O site só
// apresenta; abrir e depositar é aqui no app.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { CartaoCofrinho } from '@/componentes/cofrinho';
import { Porquinho } from '@/componentes/porquinho';
import { Texto } from '@/componentes/texto';
import { useCofrinho } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function TelaCofrinhos() {
  const { cofrinhos, abertos } = useCofrinho();
  const { dados } = useDados(() => api.regrasCofrinho(), []);
  const r = dados?.regras;
  const encerrados = cofrinhos.filter((c) => c.situacao !== 'aberto');
  const passos = [
    { icone: 'search' as const, texto: 'Abra um produto e toque em "Guardar no Cofrinho Contente".' },
    {
      icone: 'lock-closed' as const,
      texto: `O preço à vista do dia fica garantido por ${r ? r.prazoDias : 90} dias: se a tabela subir, você ganha o desconto da diferença. Depois disso, o preço é recalculado pela tabela do dia, com o desconto à vista.`,
    },
    {
      icone: 'add-circle' as const,
      texto: 'Sem parcela fixa: deixe um Pix toda semana, no dia que escolher, ou deposite outro valor quando quiser, no Pix ou no caixa de qualquer loja.',
    },
    { icone: 'home' as const, texto: 'Completou? Escolha entregar em casa ou retirar numa loja.' },
  ];
  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <View style={estilos.topo}>
        <Porquinho largura={200} />
        <Texto variante="titulo" cor="#fff">
          Cofrinho Contente
        </Texto>
        <Texto cor="#fff">Garanta o preço à vista de um produto e junte de pouquinho em pouquinho.</Texto>
      </View>

      {abertos.length ? (
        <View style={{ gap: 10 }}>
          <Texto variante="secao">Seus cofrinhos</Texto>
          {abertos.map((c) => (
            <CartaoCofrinho key={c.id} cofrinho={c} />
          ))}
        </View>
      ) : null}

      <View style={estilos.caixa}>
        <Texto variante="subtitulo">Como funciona</Texto>
        {passos.map((p) => (
          <View key={p.texto} style={estilos.passo}>
            <Ionicons name={p.icone} size={20} color={cores.marca} />
            <Texto style={{ flex: 1 }}>{p.texto}</Texto>
          </View>
        ))}
        <Texto variante="pequeno" cor={cores.textoSuave}>
          O saldo fica guardado para o seu cofrinho: não volta em dinheiro e não paga outras compras,
          mas você pode trocar o produto quando quiser. Itens do cofrinho não ganham nem usam cashback.
        </Texto>
        <Botao titulo="Escolher um produto" onPress={() => router.push('/busca')} />
        <Botao titulo="Termos e condições" variante="texto" onPress={() => router.push('/cofrinho/termos')} />
      </View>

      {encerrados.length ? (
        <View style={{ gap: 10 }}>
          <Texto variante="secao">Concluídos e cancelados</Texto>
          {encerrados.map((c) => (
            <CartaoCofrinho key={c.id} cofrinho={c} />
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 20, paddingBottom: 120 },
  topo: { gap: 8, padding: 20, borderRadius: raio.xl, backgroundColor: cores.marca, alignItems: 'center' },
  caixa: { gap: 12, padding: 16, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  passo: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
});
