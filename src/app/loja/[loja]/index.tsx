// Portal da loja no app (modo loja / Figital): endereço e horário, ler a etiqueta, conversar com os vendedores e as
// peças expostas, com o estoque da loja e do CD.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function PortalLoja() {
  const { loja: slug } = useLocalSearchParams<{ loja: string }>();
  const { lojas, entrar } = useFigital();
  const { iniciar } = useConversas();
  const loja = lojas.find((l) => l.slug === slug);
  const { dados, carregando, recarregar } = useDados(() => api.expostos(slug), [slug]);
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
            <Texto variante="secao">Expostos nesta loja</Texto>
          </View>
        }
        vazio={carregando ? <Carregando /> : <Aviso titulo="Nenhuma peça exposta listada" texto="Leia o QR da etiqueta do produto que você está vendo." />}
      />
    </>
  );
}

const estilos = StyleSheet.create({
  topo: { padding: 16, paddingBottom: 0, gap: 14 },
  cartao: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 8, borderWidth: 1, borderColor: cores.borda },
  linha: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  desconto: { backgroundColor: cores.sucessoFundo, padding: 10, borderRadius: raio.m, marginTop: 4 },
});
