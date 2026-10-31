// Portal da loja no app (modo loja / Figital): endereço e horário, ler a etiqueta, conversar com os vendedores e as
// peças expostas, com o estoque da loja e do CD.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { BotaoSairDaLoja, CabecalhoLoja } from '@/componentes/cabecalho-loja';
import { ComoFuncionaAutoatendimento } from '@/componentes/como-funciona-autoatendimento';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { GradeProdutos } from '@/componentes/grade-produtos';
import { Texto } from '@/componentes/texto';
import { useConversas } from '@/estado/conversas';
import { useLojas } from '@/estado/figital';
import { api } from '@/lib/api';
import { formatarHora } from '@/lib/formatar';
import { rotaCarrinhoLoja, rotaFigital } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function PortalLoja() {
  const { loja: slug } = useLocalSearchParams<{ loja: string }>();
  const { lojas, erroLojas, tentarLojas, entrar, comprovante } = useLojas();
  const { iniciar } = useConversas();
  const loja = lojas.find((l) => l.slug === slug);
  const [texto, setTexto] = useState('');
  const [termo, setTermo] = useState('');
  // Sem busca, a vitrine mostra o que está exposto; com busca, o catálogo inteiro, aberto no modo desta loja.
  const { dados, erro, carregando, recarregar } = useDados(
    () => (termo ? api.busca(termo).then((r) => r.produtos) : api.expostos(slug)),
    [slug, termo],
  );
  const [comoFunciona, setComoFunciona] = useState(false);

  useEffect(() => {
    if (loja) entrar(loja.slug);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loja?.slug]);

  if (!lojas.length) return erroLojas ? <Erro mensagem="Não conseguimos carregar as lojas." tentar={tentarLojas} /> : <Carregando />;
  if (!loja) return <Aviso titulo="Loja não encontrada" acao="Voltar ao início" aoTocar={() => router.dismissTo('/')} triste />;
  const aberto = comprovante(loja.slug);

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
            {aberto ? (
              <Pressable
                style={estilos.comprovante}
                onPress={() => router.push(`${rotaCarrinhoLoja(loja.slug)}?comprovante=1` as never)}
                accessibilityRole="button">
                <Ionicons name="receipt-outline" size={22} color={cores.texto} />
                <View style={{ flex: 1 }}>
                  <Texto variante="rotulo">Seu comprovante Nº {aberto.numero}: mostrar no caixa</Texto>
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    Reserva até {formatarHora(aberto.expiraEm)}
                  </Texto>
                </View>
                <Ionicons name="chevron-forward" size={20} color={cores.texto} />
              </Pressable>
            ) : null}
            <Botao
              titulo="Como funciona o autoatendimento"
              icone={<Ionicons name="help-circle-outline" size={20} color="#fff" />}
              onPress={() => setComoFunciona(true)}
            />
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
                  Mega descontos no autoatendimento: finalizando no caixa sem vendedor, o desconto aparece no carrinho conforme
                  a forma de pagamento.
                </Texto>
              </View>
              <BotaoSairDaLoja />
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
          ) : erro ? (
            <Erro mensagem={erro} tentar={recarregar} />
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
  comprovante: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: raio.l, backgroundColor: cores.sorriso },
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
