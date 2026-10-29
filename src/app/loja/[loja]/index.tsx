// Portal da loja no app (modo loja / Figital): endereço e horário, ler a etiqueta, conversar com os vendedores e as
// peças expostas, com o estoque da loja e do CD.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { CabecalhoLoja } from '@/componentes/cabecalho-loja';
import { ComoFuncionaAutoatendimento } from '@/componentes/como-funciona-autoatendimento';
import { Aviso, Carregando } from '@/componentes/estado-tela';
import { GradeProdutos } from '@/componentes/grade-produtos';
import { Texto } from '@/componentes/texto';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { rotaFigital } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function PortalLoja() {
  const { loja: slug } = useLocalSearchParams<{ loja: string }>();
  const { lojas, entrar } = useFigital();
  const { iniciar } = useConversas();
  const loja = lojas.find((l) => l.slug === slug);
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  // Sem busca, a vitrine mostra o que está exposto; com busca, o catálogo inteiro, aberto no modo desta loja.
  const { dados, carregando, recarregar } = useDados(
    () => (termo ? api.busca(termo).then((r) => r.produtos) : api.expostos(slug)),
    [slug, termo],
  );
  const [comoFunciona, setComoFunciona] = useState(false);

  useEffect(() => {
    if (loja) entrar(loja.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja?.slug]);

  if (!lojas.length) return <Carregando />;
  if (!loja) return <Aviso titulo="Loja não encontrada" acao="Voltar ao início" aoTocar={() => router.replace('/')} triste />;

  const conversar = () => {
    const id = iniciar({ loja: loja.slug, nomeLoja: loja.nome, assunto: 'Dúvida na loja' });
    router.push(`/conversas/${id}`);
  };

  return (
    <>
      <CabecalhoLoja loja={loja} />
      <ComoFuncionaAutoatendimento visivel={comoFunciona} aoFechar={() => setComoFunciona(false)} aoComecar={() => setComoFunciona(false)} />
      <GradeProdutos
        produtos={dados ?? []}
        atualizando={carregando}
        aoAtualizar={recarregar}
        hrefDe={(p) => rotaFigital(loja.slug, p.slug)}
        cabecalho={
          <View style={estilos.topo}>
            <View style={estilos.cartao}>
              <Texto variante="subtitulo">Você está na loja {loja.nome}</Texto>
              <View style={estilos.linha}>
                <Ionicons name="location-outline" size={18} color={cores.marca} />
                <Texto variante="pequeno" style={{ flex: 1 }}>
                  {loja.endereco}
                </Texto>
              </View>
              {loja.horario ? (
                <View style={estilos.linha}>
                  <Ionicons name="time-outline" size={18} color={cores.marca} />
                  <Texto variante="pequeno" style={{ flex: 1 }}>
                    {loja.horario}
                  </Texto>
                </View>
              ) : null}
              <View style={estilos.desconto}>
                <Texto variante="rotulo" cor={cores.sucesso}>
                  Mega descontos no autoatendimento: comprando sozinho pelo app, o desconto aparece no carrinho conforme a
                  forma de pagamento.
                </Texto>
              </View>
              <Botao titulo="Como funciona o autoatendimento" variante="texto" onPress={() => setComoFunciona(true)} />
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <Botao
                titulo="Ler etiqueta"
                variante="sorriso"
                style={{ flex: 1 }}
                icone={<Ionicons name="qr-code" size={18} color={cores.texto} />}
                onPress={() => router.push('/leitor')}
              />
              <Botao
                titulo="Vendedor"
                variante="contorno"
                style={{ flex: 1 }}
                icone={<Ionicons name="chatbubble-ellipses-outline" size={18} color={cores.marca} />}
                onPress={conversar}
              />
            </View>
            <View style={estilos.busca}>
              <Ionicons name="search" size={20} color={cores.textoSuave} />
              <TextInput
                value={texto}
                onChangeText={setTexto}
                onSubmitEditing={() => setTermo(texto.trim().length >= 2 ? texto.trim() : '')}
                placeholder="Procure o produto que deseja ver"
                placeholderTextColor={cores.textoSuave}
                returnKeyType="search"
                autoCorrect={false}
                style={estilos.entrada}
                accessibilityLabel="Procurar produto nesta loja"
              />
              {texto ? (
                <Pressable onPress={() => (setTexto(''), setTermo(''))} hitSlop={8} accessibilityLabel="Limpar busca">
                  <Ionicons name="close-circle" size={20} color={cores.textoSuave} />
                </Pressable>
              ) : null}
            </View>
            <Texto variante="secao">{termo ? `Resultado para “${termo}”` : 'Expostos nesta loja'}</Texto>
          </View>
        }
        vazio={
          carregando ? (
            <Carregando />
          ) : termo ? (
            <Aviso titulo="Não achamos esse produto" texto="Tente outro nome ou leia o QR da etiqueta." />
          ) : (
            <Aviso titulo="Nenhuma peça exposta listada" texto="Leia o QR da etiqueta ou procure o produto que você está vendo." />
          )
        }
      />
    </>
  );
}

const estilos = StyleSheet.create({
  topo: { padding: 16, paddingBottom: 0, gap: 14 },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 8, borderWidth: 1, borderColor: cores.borda },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  desconto: { backgroundColor: cores.sucessoFundo, padding: 10, borderRadius: raio.m, marginTop: 4 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: cores.superficie,
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.borda,
    paddingHorizontal: 16,
    height: 50,
  },
  entrada: { flex: 1, fontSize: 16, fontFamily: fontes.texto, color: cores.texto },
});
