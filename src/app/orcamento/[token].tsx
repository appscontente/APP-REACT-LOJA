// Orçamento do vendedor (/orcamento/{token}), o mesmo link que ele manda pelo WhatsApp: lê GET /api/app/orcamentos/{token}
// (a carga da página do site) e mostra os itens, o desconto combinado e a validade. Fechar com o desconto é pagando na
// loja: "Falar com a loja para fechar" abre a conversa com a loja do orçamento (quando a conversa existir no backend, o
// orçamento vira cartão nela). "Comprar pelo app" põe os itens no carrinho do site com os preços e promoções do site,
// remontando os conjuntos; com o backend, o pedido sai atribuído à loja e ao vendedor (contrato 18.6).

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Alert, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { useCarrinho } from '@/estado/carrinho';
import { useConversas } from '@/estado/conversas';
import { api, ErroApi } from '@/lib/api';
import { itemCarrinhoDoConjunto } from '@/lib/conjuntos';
import { formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { EscolhaConjunto, ItemOrcamento, OrcamentoApp } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

type Linha = [string, string, string?];

/** Conjunto do orçamento: as peças da mesma configuração (chave) juntas, como o vendedor montou. */
type GrupoConjunto = { chave: string; id: string; nome: string; vezes: number; pecas: ItemOrcamento[] };

/** Itens avulsos e conjuntos, na ordem do orçamento; as peças de conjunto se juntam pela chave da configuração. */
function agrupar(itens: ItemOrcamento[]) {
  const lista: (ItemOrcamento | GrupoConjunto)[] = [];
  const grupos = new Map<string, GrupoConjunto>();
  for (const i of itens) {
    if (!i.conjunto) {
      lista.push(i);
      continue;
    }
    const chave = i.conjunto.chave ?? i.conjunto.id;
    let grupo = grupos.get(chave);
    if (!grupo) {
      grupo = { chave, id: i.conjunto.id, nome: i.conjunto.nome, vezes: i.conjunto.quantidadeConjuntos ?? 1, pecas: [] };
      grupos.set(chave, grupo);
      lista.push(grupo);
    }
    grupo.pecas.push(i);
  }
  return lista;
}

const ehGrupo = (x: ItemOrcamento | GrupoConjunto): x is GrupoConjunto => 'pecas' in x;

/** Dá para remontar o conjunto no app: todas as peças trazem a chave da configuração e o slot. */
const remontavel = (g: GrupoConjunto) => g.pecas.every((p) => p.conjunto?.chave && p.conjunto.slot);

/** Escolhas da configuração: a quantidade de cada peça dividida pelo número de conjuntos. */
const escolhasDoGrupo = (g: GrupoConjunto): EscolhaConjunto[] =>
  g.pecas.map((p) => ({ slot: p.conjunto!.slot!, codprod: p.codprod, quantidade: Math.max(1, Math.round(p.quantidade / g.vezes)) }));

const valorDoGrupo = (g: GrupoConjunto) => g.pecas.reduce((s, p) => s + p.preco * p.quantidade, 0);

/** Aviso com um botão só, que segue adiante ao fechar (no navegador, que não tem Alert, vai o alerta da página). */
function avisarEContinuar(titulo: string, texto: string, depois: () => void) {
  if (Platform.OS === 'web') {
    window.alert(`${titulo}\n\n${texto}`);
    depois();
    return;
  }
  Alert.alert(titulo, texto, [{ text: 'Ver o carrinho', onPress: depois }], { cancelable: true, onDismiss: depois });
}

function Tela({ children }: { children: ReactNode }) {
  return (
    <>
      <Stack.Screen options={{ title: 'Orçamento' }} />
      {children}
    </>
  );
}

export default function Orcamento() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { dados, erro, status, carregando, recarregar } = useDados(() => api.orcamento(token), [token]);

  if (!dados && carregando)
    return (
      <Tela>
        <Carregando />
      </Tela>
    );
  if (!dados) {
    // Token errado, orçamento apagado ou link antigo: o site responde 404. O resto é rede ou falha do site.
    if (status === 404)
      return (
        <Tela>
          <Aviso
            titulo="Orçamento não encontrado"
            texto="O link pode estar errado ou o orçamento foi removido. Fale com a loja."
            acao="Ver as lojas"
            aoTocar={() => router.push('/lojas')}
            triste
          />
        </Tela>
      );
    return (
      <Tela>
        <Erro mensagem={erro ?? ''} tentar={recarregar} />
      </Tela>
    );
  }
  return (
    <Tela>
      <Conteudo dados={dados} token={token} />
    </Tela>
  );
}

function Conteudo({ dados, token }: { dados: OrcamentoApp; token: string }) {
  const { orcamento, loja, vencido } = dados;
  const { adicionar } = useCarrinho();
  const { iniciar } = useConversas();
  const baixo = useSafeAreaInsets().bottom;
  const [comprando, setComprando] = useState(false);
  const [avisos, setAvisos] = useState<string[]>([]);
  const nomeLoja = loja?.nome ?? 'Casa Contente';
  const aberto = !vencido && !orcamento.pedido;
  const lista = agrupar(orcamento.itens);
  // O que dá para comprar pelo app: conjunto que dá para remontar ou item com página no site (slug); peça de um
  // conjunto que não dá para remontar entra sozinha, como no site. O resto é vendido só na loja.
  const compraveis = lista.flatMap((x): (ItemOrcamento | GrupoConjunto)[] => (ehGrupo(x) ? (remontavel(x) ? [x] : x.pecas.filter((p) => p.slug)) : x.slug ? [x] : []));
  const soNaLoja = lista.some((x) => (ehGrupo(x) ? !remontavel(x) && x.pecas.some((p) => !p.slug) : !x.slug));

  const situacao = orcamento.pedido
    ? `Este orçamento já virou o pedido ${orcamento.pedido}.`
    : vencido
      ? `Este orçamento venceu em ${formatarDataHora(orcamento.validoAte)}. Peça um novo ao vendedor.`
      : `Preços válidos até ${formatarDataHora(orcamento.validoAte)}`;

  const linhas: Linha[] = [
    ['Produtos', formatarPreco(orcamento.totais.produtos)],
    ...(orcamento.totais.descontos > 0 ? [['Desconto do vendedor', `- ${formatarPreco(orcamento.totais.descontos)}`, cores.sucesso] as Linha] : []),
  ];

  const falarComALoja = () => {
    // Com a mesma loja e o mesmo assunto, "iniciar" reaproveita a conversa: tocar de novo não cria outra.
    const id = iniciar({ loja: orcamento.loja, nomeLoja, assunto: `Orçamento ${token.slice(0, 6)}` });
    router.push(`/conversas/${id}`);
  };

  const comprarPeloApp = async () => {
    if (comprando) return;
    setComprando(true);
    setAvisos([]);
    const fora: string[] = [];
    let adicionados = 0;
    try {
      // Avulsos: uma consulta com todos os códigos; a mesma peça em duas linhas vira uma só, com a soma.
      const avulsos = new Map<string, { nome: string; quantidade: number }>();
      for (const x of compraveis) {
        if (ehGrupo(x)) continue;
        avulsos.set(x.codprod, { nome: x.nome, quantidade: (avulsos.get(x.codprod)?.quantidade ?? 0) + x.quantidade });
      }
      const produtos = avulsos.size ? await api.produtos({ codprods: [...avulsos.keys()] }) : [];
      for (const [codprod, { nome, quantidade }] of avulsos) {
        const p = produtos.find((c) => c.codprod === codprod);
        if (!p || p.estoque <= 0) {
          fora.push(nomeLegivel(nome));
          continue;
        }
        // O preço é o do site agora (o desconto do vendedor vale só na loja); "adicionar" limita ao estoque.
        adicionar(
          {
            codprod: p.codprod,
            slug: p.slug,
            nome: p.nome,
            marca: p.marca,
            preco: p.preco,
            precoDe: p.precoDe,
            descontoPix: p.descontoPix,
            imagem: p.imagem,
            sujeitoConfirmacao: p.sujeitoConfirmacao,
            estoque: p.estoque,
          },
          'site',
          quantidade,
        );
        adicionados++;
      }
      // Conjuntos: a mesma configuração com o preço e o estoque de agora; 404/410 = saiu do site, o resto é falha.
      for (const g of compraveis) {
        if (!ehGrupo(g)) continue;
        const conjunto = await api.conjunto(g.id).then(
          (r) => r.conjunto,
          (e: unknown) => {
            if (!(e instanceof ErroApi && (e.status === 404 || e.status === 410))) throw e;
            return undefined;
          },
        );
        const linha = conjunto && itemCarrinhoDoConjunto(conjunto, escolhasDoGrupo(g));
        if (!linha) {
          fora.push(nomeLegivel(g.nome));
          continue;
        }
        adicionar(linha, 'site', g.vezes);
        adicionados++;
      }
    } catch (e) {
      const texto = e instanceof ErroApi ? e.message : 'Não conseguimos pôr os produtos no carrinho agora. Tente de novo.';
      setAvisos([texto]);
      AccessibilityInfo.announceForAccessibility(texto);
      return;
    } finally {
      setComprando(false);
    }
    const indisponiveis = fora.map((nome) => `${nome} não está mais disponível.`);
    if (!adicionados) {
      const textos = indisponiveis.length ? indisponiveis : ['Estes produtos não estão à venda no app agora. Fale com a loja.'];
      setAvisos(textos);
      AccessibilityInfo.announceForAccessibility(textos.join(' '));
      return;
    }
    // Volta às abas que já existem (push criaria outra cópia delas por cima do orçamento).
    const irAoCarrinho = () => router.dismissTo('/carrinho');
    if (indisponiveis.length) {
      // Avisa antes de sair da tela: no carrinho não daria para perceber o que ficou de fora.
      setAvisos(indisponiveis);
      avisarEContinuar(indisponiveis.length === 1 ? 'Um produto ficou de fora' : 'Alguns produtos ficaram de fora', indisponiveis.join('\n'), irAoCarrinho);
      return;
    }
    AccessibilityInfo.announceForAccessibility('Produtos adicionados ao carrinho');
    irAoCarrinho();
  };

  return (
    // Folga embaixo para o botão fixo "Na loja" não cobrir o último botão.
    <ScrollView contentContainerStyle={[estilos.conteudo, { paddingBottom: 120 + baixo }]}>
      <View style={{ gap: 4 }}>
        <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.tipo}>
          Orçamento Casa Contente
        </Texto>
        <Texto variante="titulo" accessibilityRole="header">
          Orçamento de {orcamento.vendedor.primeiroNome} para {orcamento.cliente.primeiroNome}
        </Texto>
        {loja ? <Texto cor={cores.textoSuave}>Loja {loja.nome}</Texto> : null}
        <Texto cor={aberto ? cores.textoSuave : cores.aviso} accessibilityLiveRegion="polite">
          {situacao}
        </Texto>
      </View>

      <View style={estilos.caixa}>
        {lista.map((x, n) => (ehGrupo(x) ? <LinhaConjunto key={x.chave} grupo={x} /> : <LinhaAvulsa key={`${x.codprod}-${n}`} item={x} />))}
      </View>

      <View style={estilos.caixa}>
        <Resumo linhas={linhas} total={orcamento.totais.total} rotuloTotal="Total na loja" />
      </View>

      {aberto ? (
        <>
          <View style={estilos.caixa}>
            <Texto variante="subtitulo" accessibilityRole="header">
              Fechar na loja
            </Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              O desconto combinado com o vendedor vale pagando na loja; ele finaliza para você.
            </Texto>
            <Botao
              titulo="Falar com a loja para fechar"
              icone={<Ionicons name="chatbubble-ellipses-outline" size={20} color="#fff" />}
              onPress={falarComALoja}
            />
          </View>
          {compraveis.length ? (
            <View style={estilos.caixa}>
              <Texto variante="subtitulo" accessibilityRole="header">
                Comprar pelo app
              </Texto>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Pelo app valem os preços e as promoções do site.
                {soNaLoja ? ' Alguns produtos só são vendidos na loja.' : ''}
              </Texto>
              {avisos.map((a) => (
                <Texto key={a} variante="pequeno" cor={cores.marca} accessibilityLiveRegion="polite">
                  {a}
                </Texto>
              ))}
              <Botao titulo="Comprar pelo app" variante="contorno" carregando={comprando} onPress={comprarPeloApp} />
            </View>
          ) : null}
        </>
      ) : null}
    </ScrollView>
  );
}

/** Item vendido sozinho: foto, nome, quantidade × preço unitário e o total da linha. */
function LinhaAvulsa({ item }: { item: ItemOrcamento }) {
  const nome = nomeLegivel(item.nome);
  const total = formatarPreco(item.preco * item.quantidade);
  return (
    <View style={estilos.item} accessible accessibilityLabel={`${item.quantidade} × ${nome}, ${formatarPreco(item.preco)} cada, ${total}${item.slug ? '' : '. Vendido só na loja'}`}>
      <Imagem uri={item.imagem} style={estilos.foto} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="rotulo" numberOfLines={2}>
          {nome}
        </Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {item.quantidade} × {formatarPreco(item.preco)}
        </Texto>
        {item.slug ? null : (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Vendido só na loja
          </Texto>
        )}
      </View>
      <Texto variante="forte">{total}</Texto>
    </View>
  );
}

/** Conjunto (cozinha, cama box, mesa + cadeiras): o nome dele e as peças em pequeno, com o preço rateado de cada uma. */
function LinhaConjunto({ grupo }: { grupo: GrupoConjunto }) {
  const nome = nomeLegivel(grupo.nome);
  const total = formatarPreco(valorDoGrupo(grupo));
  const pecas = grupo.pecas.map((p) => `${p.quantidade} × ${nomeLegivel(p.nome)}`).join(', ');
  return (
    <View style={estilos.item} accessible accessibilityLabel={`Conjunto ${nome}${grupo.vezes > 1 ? `, ${grupo.vezes} conjuntos` : ''}: ${pecas}. ${total}`}>
      <Imagem uri={grupo.pecas.find((p) => p.imagem)?.imagem} style={estilos.foto} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="pequeno" cor={cores.textoSuave} style={estilos.tipo}>
          Conjunto
        </Texto>
        <Texto variante="rotulo" numberOfLines={2}>
          {nome}
        </Texto>
        {grupo.vezes > 1 ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {grupo.vezes} conjuntos
          </Texto>
        ) : null}
        {grupo.pecas.map((p, n) => (
          <Texto key={`${p.codprod}-${n}`} variante="pequeno" cor={cores.textoSuave}>
            {p.quantidade} × {nomeLegivel(p.nome)} · {formatarPreco(p.preco)}
          </Texto>
        ))}
      </View>
      <Texto variante="forte">{total}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12 },
  tipo: { textTransform: 'uppercase', letterSpacing: 0.8 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  item: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: '#fff' },
});
