import { FlatList, RefreshControl, StyleSheet, View, type ListRenderItem } from 'react-native';

import type { CardProduto as Dados } from '@/lib/tipos';
import { cores } from '@/lib/tema';
import { CardProduto } from './card-produto';

const VAGA = '__vaga';

/** Lista de produtos em duas colunas, com puxar para atualizar. */
export function GradeProdutos({
  produtos,
  cabecalho,
  vazio,
  atualizando,
  aoAtualizar,
  hrefDe,
}: {
  produtos: Dados[];
  cabecalho?: React.ReactElement;
  vazio?: React.ReactElement;
  atualizando?: boolean;
  aoAtualizar?: () => void;
  hrefDe?: (p: Dados) => string;
}) {
  const item: ListRenderItem<Dados> = ({ item: p }) => (
    <View style={estilos.celula}>{p.codprod === VAGA ? null : <CardProduto produto={p} href={hrefDe?.(p)} />}</View>
  );
  // Número ímpar: uma vaga vazia mantém o último card com a mesma largura dos outros.
  const dados = produtos.length % 2 ? [...produtos, { ...produtos[0], codprod: VAGA }] : produtos;
  return (
    <FlatList
      data={dados}
      keyExtractor={(p) => p.codprod}
      numColumns={2}
      renderItem={item}
      ListHeaderComponent={cabecalho}
      ListEmptyComponent={vazio}
      contentContainerStyle={estilos.conteudo}
      columnWrapperStyle={estilos.linha}
      refreshControl={
        aoAtualizar ? <RefreshControl refreshing={Boolean(atualizando)} onRefresh={aoAtualizar} tintColor={cores.marca} /> : undefined
      }
    />
  );
}

const estilos = StyleSheet.create({
  conteudo: { paddingBottom: 120 },
  linha: { paddingHorizontal: 12, gap: 12, marginTop: 12 },
  celula: { flex: 1 },
});
