import { Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { api } from '@/lib/api';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';
import { Aviso, Carregando, Erro } from './estado-tela';
import { GradeProdutos } from './grade-produtos';
import { Texto } from './texto';

const ORDENACOES = [
  { valor: 'relevancia', rotulo: 'Relevância' },
  { valor: 'menor-preco', rotulo: 'Menor preço' },
  { valor: 'maior-preco', rotulo: 'Maior preço' },
  { valor: 'desconto', rotulo: 'Maior desconto' },
];

/** Lista de um departamento, de uma categoria ou das ofertas, com a ordenação do site. */
export function TelaLista({
  titulo,
  departamento,
  categoria,
  oferta,
}: {
  titulo: string;
  departamento?: string;
  categoria?: string;
  oferta?: boolean;
}) {
  const [ordenacao, setOrdenacao] = useState('relevancia');
  const { dados, erro, carregando, recarregar } = useDados(
    () => api.produtos({ departamento, categoria, oferta, ordenacao }),
    [departamento, categoria, oferta, ordenacao],
  );
  return (
    <>
      <Stack.Screen options={{ title: titulo }} />
      {!dados && carregando ? (
        <Carregando />
      ) : !dados ? (
        <Erro mensagem={erro ?? ''} tentar={recarregar} />
      ) : (
        <GradeProdutos
          produtos={dados}
          atualizando={carregando}
          aoAtualizar={recarregar}
          cabecalho={
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fichas}>
              {ORDENACOES.map((o) => {
                const ativa = o.valor === ordenacao;
                return (
                  <Pressable
                    key={o.valor}
                    onPress={() => setOrdenacao(o.valor)}
                    style={[estilos.ficha, ativa && estilos.fichaAtiva]}
                    accessibilityState={{ selected: ativa }}>
                    <Texto variante="rotulo" cor={ativa ? '#fff' : cores.texto}>
                      {o.rotulo}
                    </Texto>
                  </Pressable>
                );
              })}
            </ScrollView>
          }
          vazio={<Aviso titulo="Nenhum produto por aqui ainda" texto="Volte em breve: o catálogo é atualizado todos os dias." />}
        />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  fichas: { paddingHorizontal: 16, gap: 8, paddingTop: 4 },
  ficha: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pilula, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  fichaAtiva: { backgroundColor: cores.marca, borderColor: cores.marca },
});
