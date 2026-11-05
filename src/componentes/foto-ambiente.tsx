// Foto de um ambiente com as marcações numeradas e o cartão do produto tocado (stories e página do ambiente).
// Produto sem foto: "Pedir fotos e detalhes" abre a conversa com a loja marcada no post, dentro do app.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { useConversas } from '@/estado/conversas';
import { formatarPreco } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import type { AmbienteApp, ItemAmbiente } from '@/lib/tipos';
import { Imagem } from './imagem';
import { Texto } from './texto';

/** Abre (ou reaproveita) a conversa com a loja do post, já com o cartão do produto, e manda o pedido de fotos. */
export function usePedirFotos() {
  const { iniciar, enviar } = useConversas();
  return (ambiente: AmbienteApp, item: ItemAmbiente) => {
    if (!ambiente.loja) return;
    const id = iniciar({
      loja: ambiente.loja.slug,
      nomeLoja: ambiente.loja.nome,
      assunto: `Fotos e detalhes: ${item.nome}`,
      produto: { codprod: item.codprod, slug: item.slug, nome: item.nome, marca: '', preco: item.preco, precoDe: item.precoDe, estoque: item.disponivel ? 1 : 0 },
    });
    enviar(id, `Olá! Vi este produto num ambiente da loja ${ambiente.loja.nome} e queria fotos e mais detalhes, por favor.`);
    return id;
  };
}

export function FotoAmbiente({
  ambiente,
  largura,
  aberto,
  aoTocarMarcacao,
  aoSair,
  escuro,
}: {
  ambiente: AmbienteApp;
  largura: number;
  aberto?: number;
  aoTocarMarcacao: (numero: number | undefined) => void;
  /** Antes de trocar de tela (o visualizador de stories fecha). */
  aoSair?: () => void;
  escuro?: boolean;
}) {
  const pedirFotos = usePedirFotos();
  const { largura: l, altura: a } = ambiente.imagem;
  const proporcao = l && a ? l / a : 3 / 4;
  const altura = largura / proporcao;
  const atual = ambiente.itens.find((i) => i.numero === aberto);
  const ir = (rota: string) => {
    aoSair?.();
    router.push(rota as never);
  };

  return (
    <View style={{ width: largura, height: altura }}>
      <Pressable onPress={() => aoTocarMarcacao(undefined)} accessible={false}>
        <Imagem
          uri={ambiente.imagem.src}
          contentFit="cover"
          accessibilityLabel={ambiente.imagem.alt}
          style={{ width: largura, height: altura, borderRadius: raio.l, backgroundColor: escuro ? '#111' : cores.fundoAlt }}
        />
      </Pressable>
      {ambiente.itens.map((i) => (
        <Pressable
          key={i.numero}
          onPress={() => aoTocarMarcacao(aberto === i.numero ? undefined : i.numero)}
          accessibilityRole="button"
          accessibilityLabel={`${i.numero}. ${i.nome}, ${formatarPreco(i.preco)}`}
          hitSlop={8}
          style={[
            estilos.marcacao,
            { left: (i.x / 100) * largura - 16, top: (i.y / 100) * altura - 16 },
            aberto === i.numero && estilos.marcacaoAberta,
          ]}>
          <Texto style={[estilos.numero, aberto === i.numero && { color: '#fff' }]}>{i.numero}</Texto>
        </Pressable>
      ))}
      {atual && (
        <View style={estilos.cartao} accessibilityLabel={atual.nome}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            {atual.foto ? <Imagem uri={atual.foto} style={estilos.miniatura} /> : null}
            <View style={{ flex: 1 }}>
              <Texto variante="forte" numberOfLines={2}>
                {atual.nome}
              </Texto>
              <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8 }}>
                {atual.precoDe && atual.precoDe > atual.preco ? (
                  <Texto variante="pequeno" cor={cores.textoSuave} style={{ textDecorationLine: 'line-through' }}>
                    {formatarPreco(atual.precoDe)}
                  </Texto>
                ) : null}
                <Texto variante="subtitulo">{formatarPreco(atual.preco)}</Texto>
              </View>
              {atual.soNaLoja && ambiente.loja ? (
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  Vendido na loja {ambiente.loja.nome}
                </Texto>
              ) : null}
              {!atual.disponivel ? (
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  Indisponível
                </Texto>
              ) : null}
            </View>
          </View>
          <View style={estilos.acoes}>
            <Pressable onPress={() => ir(atual.href)} style={estilos.acaoPrincipal} accessibilityRole="link">
              <Texto style={estilos.textoAcaoPrincipal}>{atual.soNaLoja ? 'Comprar nesta loja' : 'Ver produto'}</Texto>
            </Pressable>
            {!atual.foto && ambiente.loja ? (
              <Pressable
                onPress={() => {
                  const id = pedirFotos(ambiente, atual);
                  if (id) ir(`/conversas/${id}`);
                }}
                style={estilos.acao}
                accessibilityRole="button">
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={cores.marca} />
                <Texto variante="rotulo" cor={cores.marca}>
                  Pedir fotos e detalhes
                </Texto>
              </Pressable>
            ) : null}
          </View>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  marcacao: {
    position: 'absolute',
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  marcacaoAberta: { backgroundColor: cores.marca, transform: [{ scale: 1.2 }] },
  numero: { fontFamily: fontes.tituloMedio, fontSize: 14, color: cores.texto },
  cartao: {
    position: 'absolute',
    left: 10,
    right: 10,
    bottom: 10,
    backgroundColor: cores.superficie,
    borderRadius: raio.l,
    padding: 12,
    gap: 10,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
  },
  miniatura: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: cores.fundoAlt },
  acoes: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  acaoPrincipal: { backgroundColor: cores.marca, borderRadius: raio.pilula, paddingHorizontal: 14, paddingVertical: 8 },
  textoAcaoPrincipal: { fontFamily: fontes.tituloMedio, fontSize: 14, color: '#fff' },
  acao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.pilula,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
});
