// Banner automático (o mesmo do site, loja/src/components/banner-produto.tsx): o app escreve o nome e o preço atuais e
// só a foto é imagem, então o banner nunca mostra preço velho. "oferta" é vermelho com selo de %; "destaque" é creme.

import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { calcularParcelas, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaProduto } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';
import type { BannerAutomatico as Dados } from '@/lib/tipos';
import { Imagem } from './imagem';
import { Sorriso } from './logo';
import { Texto } from './texto';

const TEXTOS = {
  oferta: { olho: 'Oferta da semana', botao: 'Ver oferta' },
  destaque: { olho: 'Achado da Casa', botao: 'Compre agora' },
};

export function BannerAutomatico({ banner, largura, formato }: { banner: Dados; largura: number; formato: 'carrossel' | 'fixo' }) {
  const { produto: p, modelo } = banner;
  const oferta = modelo === 'oferta';
  const tinta = oferta ? '#fff' : cores.texto;
  const fixo = formato === 'fixo';
  const altura = fixo ? largura * 0.58 : largura * 0.9;
  const parcelas = calcularParcelas(p.preco);
  const nome = nomeLegivel(p.nome);
  return (
    <Pressable
      onPress={() => router.push(rotaProduto(p) as never)}
      accessibilityRole="link"
      accessibilityLabel={`${TEXTOS[modelo].olho}: ${nome} por ${formatarPreco(p.preco)}`}
      style={[estilos.banner, { width: largura, height: altura, backgroundColor: oferta ? cores.marca : cores.creme }]}>
      <View
        style={[
          estilos.bola,
          { width: altura * 1.1, height: altura * 1.1, borderRadius: altura, right: -altura * 0.3, top: -altura * 0.05 },
          { backgroundColor: oferta ? cores.marcaEscura : 'rgba(253,185,23,0.18)' },
        ]}
      />
      <View style={[estilos.vitrine, { width: largura * 0.48, height: altura * 0.86 }]}>
        <View
          style={[
            estilos.disco,
            { width: altura * 0.62, height: altura * 0.62, borderRadius: altura, backgroundColor: oferta ? cores.sorriso : '#fde7a8' },
          ]}
        />
        <Imagem uri={banner.imagem} style={estilos.foto} />
      </View>
      {banner.desconto > 0 && (
        <View style={[estilos.selo, { width: largura * 0.17, height: largura * 0.17, borderRadius: largura }]}>
          <Texto style={[estilos.seloNumero, { fontSize: largura * 0.05 }]}>{banner.desconto}%</Texto>
          <Texto style={[estilos.seloOff, { fontSize: largura * 0.028 }]}>OFF</Texto>
        </View>
      )}
      {/* Texto numa coluna própria à esquerda, sem nada por cima: o sorriso fica pequeno acima do título. */}
      <View style={[estilos.coluna, { width: largura * 0.5 - 18 }]}>
        <View style={{ gap: 4 }}>
          <Sorriso largura={36} cor={oferta ? cores.sorriso : cores.marca} />
          <Texto style={[estilos.olho, { color: oferta ? cores.sorriso : cores.marca }]}>{TEXTOS[modelo].olho}</Texto>
          <Texto
            numberOfLines={fixo ? 2 : 3}
            style={[estilos.nome, { color: tinta, fontSize: fixo || nome.length > 30 ? 17 : 22, lineHeight: fixo || nome.length > 30 ? 21 : 26 }]}>
            {nome}
          </Texto>
          {!fixo && p.marca ? (
            <Texto variante="pequeno" numberOfLines={1} cor={oferta ? 'rgba(255,255,255,0.8)' : cores.textoSuave}>
              {p.marca}
            </Texto>
          ) : null}
        </View>
        <View style={{ gap: 2 }}>
          {p.precoDe && p.precoDe > p.preco ? (
            <Texto variante="pequeno" cor={oferta ? 'rgba(255,255,255,0.85)' : cores.textoSuave}>
              de <Texto variante="pequeno" style={{ textDecorationLine: 'line-through' }} cor={oferta ? 'rgba(255,255,255,0.85)' : cores.textoSuave}>{formatarPreco(p.precoDe)}</Texto>
            </Texto>
          ) : null}
          <Texto style={[estilos.preco, { color: tinta }]}>
            <Texto style={estilos.por} cor={tinta}>
              por{' '}
            </Texto>
            {formatarPreco(p.preco)}
          </Texto>
          {!fixo && parcelas.quantidade > 1 && (
            <Texto variante="pequeno" cor={oferta ? 'rgba(255,255,255,0.85)' : cores.textoSuave}>
              {parcelas.quantidade}x de {formatarPreco(parcelas.valor)}
            </Texto>
          )}
          <View style={[estilos.botao, { backgroundColor: oferta ? cores.sorriso : cores.marca }]}>
            <Texto style={estilos.botaoTexto} cor={oferta ? cores.texto : '#fff'}>
              {TEXTOS[modelo].botao}
            </Texto>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  banner: { borderRadius: raio.xl, overflow: 'hidden', padding: 18 },
  bola: { position: 'absolute' },
  vitrine: { position: 'absolute', right: 8, top: '7%', alignItems: 'center', justifyContent: 'center' },
  disco: { position: 'absolute' },
  foto: { width: '100%', height: '100%' },
  selo: {
    position: 'absolute',
    right: 16,
    top: 16,
    backgroundColor: cores.sorriso,
    alignItems: 'center',
    justifyContent: 'center',
    transform: [{ rotate: '-8deg' }],
  },
  seloNumero: { fontFamily: fontes.titulo, color: cores.texto, lineHeight: undefined },
  seloOff: { fontFamily: fontes.titulo, color: cores.texto, marginTop: -2 },
  coluna: { flex: 1, justifyContent: 'space-between' },
  olho: { fontFamily: fontes.titulo, fontSize: 13, textTransform: 'uppercase', letterSpacing: 1 },
  nome: { fontFamily: fontes.titulo },
  preco: { fontFamily: fontes.titulo, fontSize: 22, lineHeight: 28 },
  por: { fontFamily: fontes.texto, fontSize: 13 },
  botao: { alignSelf: 'flex-start', marginTop: 8, borderRadius: raio.pilula, paddingHorizontal: 14, paddingVertical: 8 },
  botaoTexto: { fontFamily: fontes.titulo, fontSize: 14 },
});
