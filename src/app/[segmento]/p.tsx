// Página do produto, no mesmo endereço do site (/{slug}/p): fotos, preço de/por, Pix e parcelas, frete pelo CEP,
// descrição, medidas e ficha técnica, "Combina com" e a barra fixa com a conversa com a loja e o carrinho.

import { Ionicons } from '@expo/vector-icons';
import { Redirect, router, Stack, useLocalSearchParams, type Href } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform, Pressable, ScrollView, Share, StyleSheet, useWindowDimensions, View } from 'react-native';

import { AbasProduto } from '@/componentes/abas-produto';
import { AbrirNoSite } from '@/componentes/abrir-no-site';
import { AvisoCarrinho, BarraCompra } from '@/componentes/barra-compra';
import { Botao } from '@/componentes/botao';
import { Carregando, Erro } from '@/componentes/estado-tela';
import { FreteCep } from '@/componentes/frete-cep';
import { Galeria } from '@/componentes/galeria';
import { Prateleira } from '@/componentes/prateleira';
import { Preco } from '@/componentes/preco';
import { Selo } from '@/componentes/selo';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConta } from '@/estado/conta';
import { useConversas } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { useDefinirRegraPagamento } from '@/estado/pagamento';
import { api, SITE_URL } from '@/lib/api';
import { descontoExibido, nomeLegivel } from '@/lib/formatar';
import { rotaProduto } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

/** Respostas do site que a página do site resolve melhor (conjunto, produto encerrado ou endereço que não existe mais). */
const ABRIR_NO_SITE = ['conjunto', 'nao_encontrado', 'encerrado'];

/** Caminho sem domínio do site, query, hash e barra final, decodificado (o parâmetro da rota já chega decodificado). */
function caminhoDe(endereco: string) {
  const semDominio = endereco.startsWith(SITE_URL) ? endereco.slice(SITE_URL.length) : endereco;
  const caminho = semDominio.split(/[?#]/)[0].replace(/\/+$/, '');
  try {
    return decodeURIComponent(caminho);
  } catch {
    return caminho;
  }
}

export default function PaginaProduto() {
  const { segmento: slug } = useLocalSearchParams<{ segmento: string }>();
  const { width } = useWindowDimensions();
  const { dados, erro, codigo, status, carregando, recarregar } = useDados(() => api.produto(slug), [slug]);
  const { adicionar, itens } = useCarrinho();
  const { favorito, alternarFavorito } = useConta();
  const { iniciar } = useConversas();
  const { lojaAtual } = useFigital();
  const [aviso, setAviso] = useState<{ id: number; texto: string; limite?: boolean }>();
  // A regra de parcelas que veio com o produto passa a valer nos cards e no checkout também.
  const definirRegra = useDefinirRegraPagamento();
  const regraSite = dados?.pagamento;
  useEffect(() => {
    definirRegra(regraSite);
  }, [definirRegra, regraSite]);

  if (!dados && carregando) return <Carregando />;
  // Erro de cadastro no site: redirecionar para o próprio endereço da tela entraria em laço; vira "não encontrado".
  const redirecionaParaSi = dados?.redirecionar !== undefined && caminhoDe(dados.redirecionar) === `/${slug}/p`;
  if (!dados || redirecionaParaSi) {
    // Conjunto, produto encerrado (410) ou endereço que o app não conhece: a página do site resolve (301, 410, conjunto).
    if (redirecionaParaSi || status === 404 || status === 410 || (codigo && ABRIR_NO_SITE.includes(codigo)))
      return <AbrirNoSite caminho={`/${encodeURIComponent(slug)}/p`} />;
    return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  }
  // Endereço antigo ou renomeado: vai para o endereço novo, como o 301 do site.
  if (dados.redirecionar !== undefined) return <Redirect href={dados.redirecionar as Href} />;
  const { produto: p, combinaCom, pagamento } = dados;
  const desconto = descontoExibido(p);
  const nome = nomeLegivel(p.nome);
  const marcado = favorito(p.codprod);
  // Peça que só sai no conjunto (cozinha, cama box, mesa com cadeiras): sem preço avulso nem carrinho, como no site.
  const soConjunto = p.vendeIndividualmente === false;
  const item = {
    codprod: p.codprod,
    slug: p.slug,
    nome: p.nome,
    marca: p.marca,
    preco: p.preco,
    precoDe: p.precoDe,
    descontoPix: p.descontoPix,
    imagem: p.imagens[0]?.src,
    sujeitoConfirmacao: p.sujeitoConfirmacao,
    estoque: p.estoque,
  };

  const avisar = (texto: string, limite?: boolean) => {
    setAviso({ id: Date.now(), texto, limite });
    AccessibilityInfo.announceForAccessibility(texto);
  };
  const colocarNoCarrinho = () => {
    // Nunca dizer o número: só que o carrinho já tem tudo o que está disponível.
    const noCarrinho = itens().find((i) => i.codprod === p.codprod && !i.indisponivel)?.quantidade ?? 0;
    if (noCarrinho >= p.estoque) return avisar('Você já tem no carrinho todas as unidades disponíveis.', true);
    adicionar(item);
    avisar('Adicionado ao carrinho');
  };
  const avisarQuandoChegar = () => {
    // Só guarda (nunca tira): o aviso de chegada sai dos favoritos.
    if (!marcado) alternarFavorito(p.codprod);
    AccessibilityInfo.announceForAccessibility('Pronto! Vamos te avisar quando chegar. O produto ficou nos favoritos.');
  };

  const conversar = () => {
    // Quem está numa loja física fala com a equipe daquela loja; fora dela, com o atendimento do site.
    const id = iniciar({ loja: lojaAtual?.slug, nomeLoja: lojaAtual?.nome ?? 'Casa Contente', assunto: nome, produto: item });
    router.push(`/conversas/${id}`);
  };

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{
          title: '',
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 18, paddingRight: Platform.OS === 'web' ? 16 : 0 }}>
              <Pressable
                onPress={() => Share.share({ message: `${nome} na Casa Contente: ${SITE_URL}${rotaProduto(p)}` })}
                hitSlop={8}
                accessibilityLabel="Compartilhar">
                <Ionicons name="share-social-outline" size={22} color={cores.texto} />
              </Pressable>
              <Pressable onPress={() => alternarFavorito(p.codprod)} hitSlop={8} accessibilityLabel={marcado ? 'Tirar dos favoritos' : 'Guardar nos favoritos'}>
                <Ionicons name={marcado ? 'heart' : 'heart-outline'} size={22} color={marcado ? cores.marca : cores.texto} />
              </Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={{ paddingBottom: 180 }}>
        <Galeria imagens={p.imagens} largura={Math.min(width, 600)} />
        <View style={estilos.corpo}>
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {desconto > 0 && <Selo texto={`${desconto}% OFF`} />}
            {p.selos?.map((s) => <Selo key={s.texto} texto={s.texto} cor={s.cor} />)}
          </View>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {p.marca} · código {p.codprod}
          </Texto>
          <Texto variante="titulo">{nome}</Texto>
          {soConjunto ? (
            <Texto variante="subtitulo" cor={cores.textoSuave}>
              Vendido só no conjunto
            </Texto>
          ) : p.estoque > 0 ? (
            <Preco preco={p.preco} precoDe={p.precoDe} descontoPix={p.descontoPix} pagamento={pagamento} tamanho="pagina" />
          ) : (
            <Texto variante="subtitulo" cor={cores.textoSuave}>
              Esgotado no momento
            </Texto>
          )}
          {p.sujeitoConfirmacao ? (
            <View style={estilos.aviso}>
              <Ionicons name="information-circle" size={20} color={cores.aviso} />
              <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
                Peça de exposição numa das nossas lojas. A equipe confirma a peça antes de cobrar.
              </Texto>
            </View>
          ) : !soConjunto && p.estoque > 0 && p.estoque <= 3 ? (
            <Texto variante="rotulo" cor={cores.marca}>
              Últimas unidades
            </Texto>
          ) : null}
          {soConjunto ? null : <FreteCep valor={p.preco} />}
          <AbasProduto produto={p} />
        </View>
        <Prateleira titulo="Combina com" produtos={combinaCom} />
      </ScrollView>
      <BarraCompra
        aoConversar={conversar}
        aviso={
          aviso ? (
            <AvisoCarrinho
              key={aviso.id}
              texto={aviso.texto}
              limite={aviso.limite}
              // Volta às abas que já existem (push criaria outra cópia delas por cima do produto).
              aoVerCarrinho={() => {
                setAviso(undefined);
                router.dismissTo('/carrinho');
              }}
              aoFechar={() => setAviso(undefined)}
            />
          ) : null
        }>
        {soConjunto ? (
          <Botao titulo="Tirar dúvidas com a loja" variante="contorno" onPress={conversar} />
        ) : p.estoque > 0 ? (
          <Botao titulo="Adicionar ao carrinho" onPress={colocarNoCarrinho} />
        ) : marcado ? (
          <Botao
            titulo="Pronto! Vamos te avisar"
            variante="contorno"
            disabled
            icone={<Ionicons name="checkmark-circle" size={20} color={cores.sucesso} />}
          />
        ) : (
          <Botao titulo="Avise-me quando chegar" variante="contorno" onPress={avisarQuandoChegar} />
        )}
      </BarraCompra>
    </View>
  );
}

const estilos = StyleSheet.create({
  corpo: { padding: 16, gap: 12 },
  aviso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.avisoFundo },
});
