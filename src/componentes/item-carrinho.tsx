import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { AccessibilityInfo, Pressable, StyleSheet, View } from 'react-native';

import { useCarrinho, type Destino, type ItemCarrinho as Item } from '@/estado/carrinho';
import { resumoPecas } from '@/lib/conjuntos';
import { formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaFigital, rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { Botao } from './botao';
import { Imagem } from './imagem';
import { Texto } from './texto';

export function ItemCarrinho({ item, destino = 'site' }: { item: Item; destino?: Destino }) {
  const { alterar, remover } = useCarrinho();
  // Tirar do carrinho pede confirmação (no "−" com 1 unidade e na lixeira), para um toque sem querer não apagar o item.
  const [confirmando, setConfirmando] = useState(false);
  // Linha de conjunto: a foto e o nome levam à página do conjunto (item.slug é o dele), o preço já é o total dele.
  const href = destino === 'site' ? rotaProduto({ slug: item.slug }) : rotaFigital(destino, item.slug);
  const nome = nomeLegivel(item.nome);
  const conjunto = item.conjunto;
  const noLimite = item.quantidade >= item.estoque;
  const unidades = (n: number) => (conjunto ? (n === 1 ? 'conjunto' : 'conjuntos') : n === 1 ? 'unidade' : 'unidades');

  const mudarQuantidade = (quantidade: number) => {
    if (quantidade < 1) return setConfirmando(true);
    if (quantidade > item.quantidade && noLimite) return;
    alterar(item.codprod, quantidade, destino);
    AccessibilityInfo.announceForAccessibility(`${nome}: ${quantidade} ${unidades(quantidade)} no carrinho`);
  };
  const tirar = () => {
    remover(item.codprod, destino);
    AccessibilityInfo.announceForAccessibility(`${nome} saiu do carrinho`);
  };

  return (
    <View style={[estilos.item, item.indisponivel && estilos.apagado]}>
      <Pressable onPress={() => router.push(href as never)} accessibilityRole="link" accessibilityLabel={`Ver ${conjunto ? 'o conjunto ' : ''}${nome}`}>
        <Imagem uri={item.imagem} style={estilos.foto} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        {conjunto ? (
          <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.tipo}>
            Conjunto
          </Texto>
        ) : null}
        <Texto variante="rotulo" numberOfLines={2}>
          {nome}
        </Texto>
        {conjunto ? (
          <Texto variante="pequeno" cor={cores.textoSuave} numberOfLines={2}>
            {resumoPecas(conjunto.escolhas.map((e) => ({ nome: nomeLegivel(e.nome), quantidade: e.quantidade })))}
          </Texto>
        ) : null}
        {item.sujeitoConfirmacao && !item.indisponivel ? (
          <Texto variante="pequeno" cor={cores.aviso}>
            Peça de exposição: a loja confirma antes da cobrança
          </Texto>
        ) : null}
        {destino !== 'site' && !item.indisponivel ? (
          <Texto variante="pequeno" cor={item.mostruario ? cores.aviso : cores.textoSuave}>
            {item.mostruario
              ? 'Peça de mostruário desta loja'
              : item.origemEstoque === 'loja'
                ? 'Sai da loja'
                : item.origemEstoque === 'outra-loja'
                  ? 'Sai de outra loja'
                  : 'Sai do centro de distribuição'}
          </Texto>
        ) : null}
        {item.indisponivel ? (
          <Texto variante="forte" cor={cores.marca}>
            Indisponível no momento
          </Texto>
        ) : (
          <Texto variante="forte">{formatarPreco(item.preco * item.quantidade)}</Texto>
        )}
        {confirmando ? (
          <View style={estilos.confirmar}>
            <Texto variante="pequeno">Tirar do carrinho?</Texto>
            <View style={estilos.linhaConfirmar}>
              <Botao titulo="Tirar" variante="contorno" onPress={tirar} style={{ minHeight: 44 }} accessibilityLabel={`Tirar ${nome} do carrinho`} />
              <Botao
                titulo="Manter"
                variante="texto"
                onPress={() => setConfirmando(false)}
                style={{ minHeight: 44 }}
                accessibilityLabel={`Manter ${nome} no carrinho`}
              />
            </View>
          </View>
        ) : (
          <View style={estilos.acoes}>
            {item.indisponivel ? (
              <View />
            ) : (
              <View style={estilos.quantidade}>
                <Pressable
                  onPress={() => mudarQuantidade(item.quantidade - 1)}
                  style={estilos.botaoQuantidade}
                  accessibilityRole="button"
                  accessibilityLabel={item.quantidade === 1 ? `Tirar ${nome} do carrinho` : `Diminuir quantidade de ${nome}`}>
                  <Ionicons name={item.quantidade === 1 ? 'trash-outline' : 'remove'} size={18} color={cores.texto} />
                </Pressable>
                <Texto variante="forte" style={{ minWidth: 24, textAlign: 'center' }} accessibilityLabel={`Quantidade: ${item.quantidade}`}>
                  {item.quantidade}
                </Texto>
                <Pressable
                  onPress={() => mudarQuantidade(item.quantidade + 1)}
                  style={estilos.botaoQuantidade}
                  disabled={noLimite}
                  accessibilityRole="button"
                  accessibilityState={{ disabled: noLimite }}
                  accessibilityLabel={`Aumentar quantidade de ${nome}`}>
                  <Ionicons name="add" size={18} color={noLimite ? cores.borda : cores.texto} />
                </Pressable>
              </View>
            )}
            <Pressable
              onPress={() => setConfirmando(true)}
              style={estilos.botaoQuantidade}
              accessibilityRole="button"
              accessibilityLabel={`Tirar ${nome} do carrinho`}>
              <Ionicons name="trash-outline" size={20} color={cores.textoSuave} />
            </Pressable>
          </View>
        )}
        {noLimite && !item.indisponivel && !confirmando ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Quantidade máxima disponível
          </Texto>
        ) : null}
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  item: {
    flexDirection: 'row',
    gap: 12,
    padding: 12,
    backgroundColor: cores.superficie,
    borderRadius: raio.l,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  apagado: { backgroundColor: cores.fundo },
  tipo: { textTransform: 'uppercase', letterSpacing: 0.8 },
  foto: { width: 84, height: 84, borderRadius: raio.m, backgroundColor: '#fff' },
  acoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  quantidade: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.pilula,
  },
  // Área de toque de 44 pt (recomendação do iOS e do Android).
  botaoQuantidade: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  confirmar: { gap: 6, marginTop: 4 },
  linhaConfirmar: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
