import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { cores, raio } from '@/lib/tema';
import type { Produto } from '@/lib/tipos';
import { Texto } from './texto';

const cm = (v?: number) => (v ? `${v} cm` : undefined);

/** Descrição, medidas e ficha técnica, em abas (o produto da Drogasil inspirou; aqui sem rolagem presa). */
export function AbasProduto({ produto, semDescricao }: { produto: Produto; semDescricao?: string }) {
  const medidas = produto.medidasProduto ?? produto.medidas;
  const abas = [
    { chave: 'descricao', rotulo: 'Descrição' },
    ...(medidas ? [{ chave: 'medidas', rotulo: 'Medidas' }] : []),
    ...(produto.especificacoes.length ? [{ chave: 'ficha', rotulo: 'Ficha técnica' }] : []),
  ];
  const [aba, setAba] = useState('descricao');
  const linhas: [string, string | undefined][] =
    aba === 'medidas' && medidas
      ? [
          ['Altura', cm(medidas.altura)],
          ['Largura', cm(medidas.largura)],
          ['Profundidade', cm(medidas.profundidade)],
          ['Peso', medidas.peso ? `${medidas.peso} kg` : undefined],
        ]
      : produto.especificacoes.map((e) => [e.nome, e.valor]);
  return (
    <View style={{ gap: 12 }}>
      <View style={estilos.abas} accessibilityRole="tablist">
        {abas.map((a) => (
          <Pressable
            key={a.chave}
            accessibilityRole="tab"
            accessibilityState={{ selected: aba === a.chave }}
            onPress={() => setAba(a.chave)}
            style={[estilos.aba, aba === a.chave && estilos.abaAtiva]}>
            <Texto variante="rotulo" cor={aba === a.chave ? cores.marca : cores.textoSuave}>
              {a.rotulo}
            </Texto>
          </Pressable>
        ))}
      </View>
      {aba === 'descricao' ? (
        <Texto>{produto.descricao || semDescricao || 'Descrição em breve.'}</Texto>
      ) : (
        <View style={estilos.tabela}>
          {linhas
            .filter(([, v]) => v)
            .map(([nome, valor]) => (
              <View key={nome} style={estilos.linha}>
                <Texto cor={cores.textoSuave} style={{ flex: 1 }}>
                  {nome}
                </Texto>
                <Texto variante="forte" style={{ flex: 1, textAlign: 'right' }}>
                  {valor}
                </Texto>
              </View>
            ))}
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  abas: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: cores.borda },
  aba: { paddingVertical: 10, paddingHorizontal: 12, borderBottomWidth: 2.5, borderBottomColor: 'transparent', marginBottom: -1 },
  abaAtiva: { borderBottomColor: cores.marca },
  tabela: { borderRadius: raio.m, borderWidth: 1, borderColor: cores.borda, overflow: 'hidden' },
  linha: { flexDirection: 'row', padding: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda, backgroundColor: cores.superficie },
});
