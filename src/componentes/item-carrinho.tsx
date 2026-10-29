import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useCarrinho, type Destino, type ItemCarrinho as Item } from '@/estado/carrinho';
import { formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaFigital, rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { Imagem } from './imagem';
import { Texto } from './texto';

export function ItemCarrinho({ item, destino = 'site' }: { item: Item; destino?: Destino }) {
  const { alterar, remover } = useCarrinho();
  const href = destino === 'site' ? rotaProduto(item) : rotaFigital(destino, item.slug);
  return (
    <View style={estilos.item}>
      <Pressable onPress={() => router.push(href as never)}>
        <Imagem uri={item.imagem} style={estilos.foto} />
      </Pressable>
      <View style={{ flex: 1, gap: 4 }}>
        <Texto variante="rotulo" numberOfLines={2}>
          {nomeLegivel(item.nome)}
        </Texto>
        {item.sujeitoConfirmacao ? (
          <Texto variante="pequeno" cor={cores.aviso}>
            Peça de exposição: a loja confirma antes da cobrança
          </Texto>
        ) : null}
        <Texto variante="forte">{formatarPreco(item.preco * item.quantidade)}</Texto>
        <View style={estilos.acoes}>
          <View style={estilos.quantidade}>
            <Pressable
              onPress={() => alterar(item.codprod, item.quantidade - 1, destino)}
              hitSlop={6}
              accessibilityLabel="Diminuir quantidade">
              <Ionicons name="remove" size={18} color={cores.texto} />
            </Pressable>
            <Texto variante="forte" style={{ minWidth: 24, textAlign: 'center' }}>
              {item.quantidade}
            </Texto>
            <Pressable
              onPress={() => alterar(item.codprod, item.quantidade + 1, destino)}
              hitSlop={6}
              disabled={item.quantidade >= item.estoque}
              accessibilityLabel="Aumentar quantidade">
              <Ionicons name="add" size={18} color={item.quantidade >= item.estoque ? cores.borda : cores.texto} />
            </Pressable>
          </View>
          <Pressable onPress={() => remover(item.codprod, destino)} hitSlop={8} accessibilityLabel="Tirar do carrinho">
            <Ionicons name="trash-outline" size={20} color={cores.textoSuave} />
          </Pressable>
        </View>
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
  foto: { width: 84, height: 84, borderRadius: raio.m, backgroundColor: '#fff' },
  acoes: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
  quantidade: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.pilula,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
});
