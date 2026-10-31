import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { api } from '@/lib/api';
import { rotaCategoria, rotaDepartamento } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { Categoria } from '@/lib/tipos';
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

/** Fichas de ordenação do site (listas e busca). Tocar na ficha marcada carrega de novo. */
export function FichasOrdenacao({ ativa, aoEscolher }: { ativa: string; aoEscolher: (valor: string) => void }) {
  return (
    <LinhaFichas
      fichas={ORDENACOES.map((o) => ({ chave: o.valor, rotulo: o.rotulo, ativa: o.valor === ativa, aoTocar: () => aoEscolher(o.valor) }))}
    />
  );
}

function LinhaFichas({ fichas }: { fichas: { chave: string; rotulo: string; ativa: boolean; aoTocar: () => void }[] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.fichas}>
      {fichas.map((f) => (
        <Pressable
          key={f.chave}
          onPress={f.aoTocar}
          style={[estilos.ficha, f.ativa && estilos.fichaAtiva]}
          accessibilityState={{ selected: f.ativa }}>
          <Texto variante="rotulo" cor={f.ativa ? '#fff' : cores.texto}>
            {f.rotulo}
          </Texto>
        </Pressable>
      ))}
    </ScrollView>
  );
}

/**
 * Lista de um departamento, de uma categoria, de uma vitrine ou das ofertas, com a ordenação do site. Com `categorias`,
 * mostra as categorias do departamento em fichas (na categoria, a atual marcada e "Todos" para o departamento).
 */
export function TelaLista({
  titulo,
  departamento,
  categoria,
  colecao,
  oferta,
  categorias,
}: {
  titulo: string;
  departamento?: string;
  categoria?: string;
  colecao?: string;
  oferta?: boolean;
  categorias?: Categoria[];
}) {
  const [ordenacao, setOrdenacao] = useState('relevancia');
  // Última ordenação que carregou: se a troca falha, a ficha volta para ela (a lista na tela é dela).
  const [ordemMostrada, setOrdemMostrada] = useState(ordenacao);
  const { dados, erro, carregando, recarregar } = useDados(
    () => api.produtos({ departamento, categoria, colecao, oferta, ordenacao }),
    [departamento, categoria, colecao, oferta, ordenacao],
  );
  if (!carregando && !erro && ordemMostrada !== ordenacao) setOrdemMostrada(ordenacao);
  const ordemAtiva = !carregando && erro ? ordemMostrada : ordenacao;
  // Tocar de novo na ficha que falhou tenta de novo.
  const escolher = (valor: string) => (valor === ordenacao ? recarregar() : setOrdenacao(valor));

  // Na categoria, trocar de categoria substitui a tela (voltar leva para onde o cliente estava antes da lista).
  const irPara = (caminho: string) => (categoria ? router.replace(caminho as never) : router.push(caminho as never));
  const fichasCategorias =
    departamento && categorias?.length
      ? [
          // "Todos" volta ao departamento se ele já está na pilha (senão, substitui esta tela por ele).
          ...(categoria
            ? [{ chave: '__todos', rotulo: 'Todos', ativa: false, aoTocar: () => router.dismissTo(rotaDepartamento(departamento) as never) }]
            : []),
          ...categorias.map((c) => ({
            chave: c.slug,
            rotulo: c.nome,
            ativa: c.slug === categoria,
            aoTocar: () => (c.slug === categoria ? undefined : irPara(rotaCategoria(departamento, c.slug))),
          })),
        ]
      : undefined;

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
            <View style={estilos.cabecalho}>
              {fichasCategorias ? <LinhaFichas fichas={fichasCategorias} /> : null}
              {dados.length > 1 ? <FichasOrdenacao ativa={ordemAtiva} aoEscolher={escolher} /> : null}
              {!carregando && erro ? (
                <Texto variante="pequeno" cor={cores.marca} style={estilos.linhaTexto}>
                  Não conseguimos atualizar a lista. Confira a internet e tente de novo.
                </Texto>
              ) : null}
              {dados.length > 0 ? (
                <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.linhaTexto}>
                  {dados.length} {dados.length === 1 ? 'produto' : 'produtos'}
                </Texto>
              ) : null}
            </View>
          }
          vazio={<Aviso titulo="Nenhum produto por aqui ainda" texto="Volte em breve: o catálogo é atualizado todos os dias." />}
        />
      )}
    </>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { gap: 8, paddingTop: 4 },
  fichas: { paddingHorizontal: 16, gap: 8 },
  ficha: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: raio.pilula, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  fichaAtiva: { backgroundColor: cores.marca, borderColor: cores.marca },
  linhaTexto: { paddingHorizontal: 16 },
});
