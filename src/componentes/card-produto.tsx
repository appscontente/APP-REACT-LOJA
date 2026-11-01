import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useConta } from '@/estado/conta';
import { useRegraPagamento } from '@/estado/pagamento';
import { descontoExibido, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { CardProduto as Dados } from '@/lib/tipos';
import { Imagem } from './imagem';
import { Preco } from './preco';
import { Selo } from './selo';
import { Texto } from './texto';

/**
 * Card da vitrine: foto, selos, nome, preço de/por, Pix e parcelas, com o coração dos favoritos. Conjunto (cozinha,
 * cama box, mesa + cadeiras) ganha o selo "Conjunto" e o preço "a partir de" (o da combinação padrão); sem coração,
 * porque os favoritos buscam por CODPROD de produto e o conjunto tem código próprio (KIT-...).
 */
export function CardProduto({ produto, largura, href }: { produto: Dados; largura?: number; href?: string }) {
  const { favorito, alternarFavorito } = useConta();
  const desconto = descontoExibido(produto);
  const conjunto = produto.tipo === 'conjunto';
  const marcado = !conjunto && favorito(produto.codprod);
  const regra = useRegraPagamento();
  const disponivel = produto.estoque > 0;
  // O rótulo substitui o conteúdo para o leitor de tela: nome legível, preço (ou esgotado) e desconto.
  const rotulo = [
    conjunto ? 'Conjunto' : '',
    nomeLegivel(produto.nome),
    disponivel ? `${conjunto ? 'a partir de ' : ''}${formatarPreco(produto.preco)}` : 'esgotado',
    desconto > 0 ? `${desconto}% de desconto` : '',
  ]
    .filter(Boolean)
    .join(', ');
  return (
      <Pressable
        onPress={() => router.push((href ?? rotaProduto(produto)) as never)}
        accessibilityRole="link"
        style={[estilos.card, largura ? { width: largura } : { flex: 1 }]}
        accessibilityLabel={rotulo}
        // No iPhone o VoiceOver não chega ao coração dentro do card: o favorito vira uma ação do próprio card.
        accessibilityActions={conjunto ? undefined : [{ name: 'favorito', label: marcado ? 'Tirar dos favoritos' : 'Guardar nos favoritos' }]}
        onAccessibilityAction={(e) => {
          if (e.nativeEvent.actionName === 'favorito' && !conjunto) alternarFavorito(produto.codprod);
        }}>
        <View style={estilos.foto}>
          <Imagem uri={produto.imagem} style={estilos.imagem} accessibilityIgnoresInvertColors />
          <View style={estilos.selos}>
            {conjunto && <Selo texto="Conjunto" cor="escuro" />}
            {desconto > 0 && <Selo texto={`${desconto}% OFF`} />}
            {produto.selos?.slice(0, 1).map((s) => <Selo key={s.texto} texto={s.texto} cor={s.cor} />)}
          </View>
          {conjunto ? null : (
            <Pressable
              hitSlop={8}
              onPress={() => alternarFavorito(produto.codprod)}
              accessibilityRole="button"
              accessibilityLabel={marcado ? 'Tirar dos favoritos' : 'Guardar nos favoritos'}
              style={estilos.coracao}>
              <Ionicons name={marcado ? 'heart' : 'heart-outline'} size={20} color={marcado ? cores.marca : cores.texto} />
            </Pressable>
          )}
        </View>
        <View style={estilos.corpo}>
          <Texto variante="pequeno" cor={cores.textoSuave} numberOfLines={1}>
            {produto.marca}
          </Texto>
          <Texto variante="rotulo" numberOfLines={2} style={estilos.nome}>
            {nomeLegivel(produto.nome)}
          </Texto>
          {disponivel ? (
            <View>
              {conjunto ? (
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  a partir de
                </Texto>
              ) : null}
              <Preco preco={produto.preco} precoDe={produto.precoDe} descontoPix={produto.descontoPix} pagamento={regra} />
            </View>
          ) : (
            <Texto variante="forte" cor={cores.textoSuave}>
              Esgotado
            </Texto>
          )}
        </View>
      </Pressable>
  );
}

const estilos = StyleSheet.create({
  card: {
    backgroundColor: cores.superficie,
    borderRadius: raio.l,
    borderWidth: 1,
    borderColor: cores.borda,
    overflow: 'hidden',
  },
  foto: { aspectRatio: 1, backgroundColor: '#fff', padding: 8 },
  imagem: { flex: 1 },
  selos: { position: 'absolute', top: 8, left: 8, gap: 4 },
  coracao: {
    position: 'absolute',
    top: 6,
    right: 6,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  corpo: { padding: 12, gap: 4 },
  nome: { minHeight: 36 },
});
