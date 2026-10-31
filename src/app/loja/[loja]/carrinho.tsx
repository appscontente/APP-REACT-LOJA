// Carrinho da loja (Figital): "finalizar no caixa" gera o comprovante com QR e o caixa fatura pelo fluxo normal do
// Sankhya; "concluir pelo app" leva os itens para o checkout (entrega ou retirada). Desconto de autoatendimento só
// sem vendedor vinculado: o Happy diz o % de cada item em cada forma de pagamento, e o cliente escolhe como vai pagar no
// caixa (pagar em mais parcelas cancela o pedido). Nesta versão de demonstração o pedido é simulado; com o backend,
// POST /figital/pedidos. O comprovante fica guardado no celular (estado/figital.tsx) até a reserva vencer.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Botao } from '@/componentes/botao';
import { BotaoSairDaLoja, CabecalhoLoja } from '@/componentes/cabecalho-loja';
import { Campo } from '@/componentes/campo';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { ItemCarrinho } from '@/componentes/item-carrinho';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { totais, useCarrinho } from '@/estado/carrinho';
import { useLojas, type ComprovanteLoja } from '@/estado/figital';
import { api } from '@/lib/api';
import { arredondar, cpfValido, formatarHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { PAGAMENTOS_FIGITAL, type DescontoFigital, type PagamentoFigital } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const NOME_PAGAMENTO = (pg: PagamentoFigital) =>
  pg === 'pix' ? 'Pix ou dinheiro' : pg === 'debito' ? 'Débito' : pg === '1' ? 'Crédito 1x' : `Crédito até ${pg}x`;

/** Desconto do carrinho no pagamento: cada item com o % do Happy, no caixa. */
function descontoEm(lista: { codprod: string; preco: number; quantidade: number }[], tabela: DescontoFigital[], pg: PagamentoFigital) {
  const centavos = lista.reduce((s, i) => {
    const pct = tabela.find((d) => d.codprod === i.codprod)?.descontos[pg]?.caixa ?? 0;
    return s + Math.round(i.preco * i.quantidade * pct);
  }, 0);
  return centavos / 100;
}

/** "Já paguei": confirma antes de tirar o comprovante do celular. */
function confirmarDescarte(descartar: () => void) {
  const texto = 'O comprovante sai do celular. Faça isso só depois de pagar no caixa.';
  if (Platform.OS === 'web') {
    if (window.confirm(texto)) descartar();
    return;
  }
  Alert.alert('Descartar o comprovante?', texto, [
    { text: 'Voltar', style: 'cancel' },
    { text: 'Já paguei, descartar', style: 'destructive', onPress: descartar },
  ]);
}

export default function CarrinhoLoja() {
  const { loja: slug, comprovante: abrirComprovante } = useLocalSearchParams<{ loja: string; comprovante?: string }>();
  const { lojas, erroLojas, tentarLojas, comprovante, guardarComprovante, descartarComprovante } = useLojas();
  const { itens, esvaziar } = useCarrinho();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [verComprovante, setVerComprovante] = useState(abrirComprovante === '1');
  const [pagamento, setPagamento] = useState<PagamentoFigital>('pix');
  const loja = lojas.find((l) => l.slug === slug);
  const lista = loja ? itens(loja.slug) : [];
  const codprods = lista.map((i) => i.codprod).sort();
  const { dados: descontos } = useDados(
    () => (slug && codprods.length ? api.descontos(slug, codprods) : Promise.resolve({ itens: [] })),
    [slug, codprods.join(',')],
  );
  if (!lojas.length) return erroLojas ? <Erro mensagem="Não conseguimos carregar as lojas." tentar={tentarLojas} /> : <Carregando />;
  if (!loja) return <Aviso titulo="Loja não encontrada" acao="Voltar ao início" aoTocar={() => router.dismissTo('/')} triste />;
  const tabela = descontos?.itens ?? [];
  const { subtotal, pix: pixPeloApp } = totais(lista);
  const desconto = arredondar(descontoEm(lista, tabela, pagamento));
  const total = arredondar(subtotal - desconto);
  const aberto = comprovante(loja.slug);

  if (aberto && (!lista.length || verComprovante))
    return (
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <CabecalhoLoja loja={loja} titulo="Comprovante" />
        <ComprovanteCaixa comprovante={aberto} nomeLoja={loja.nome} />
        <Botao titulo="Continuar comprando" variante="contorno" onPress={() => router.replace(rotaLoja(loja.slug) as never)} />
        {lista.length ? <Botao titulo="Ver o carrinho novo" variante="contorno" onPress={() => setVerComprovante(false)} /> : null}
        <Botao
          titulo="Já paguei / descartar comprovante"
          variante="texto"
          onPress={() => confirmarDescarte(() => descartarComprovante(loja.slug))}
        />
      </ScrollView>
    );

  if (!lista.length)
    return (
      <>
        <CabecalhoLoja loja={loja} titulo="Carrinho da loja" />
        <Aviso
          titulo="Carrinho da loja vazio"
          texto="Leia o QR das etiquetas para pôr produtos aqui."
          acao="Ler etiqueta"
          aoTocar={() => router.push('/leitor')}
        />
      </>
    );

  const digitosCpf = cpf.replace(/\D/g, '');
  const cpfOk = cpfValido(digitosCpf);
  const pronto = nome.trim().length > 2 && cpfOk;
  // Só o caixa finaliza produto sem medidas de embalagem (contrato 4.2): ele não entra no "Pagar pelo app".
  const todosEntregaveis = lista.every((i) => i.entregavel !== false);

  const gerarComprovante = () => {
    if (enviando) return;
    setEnviando(true);
    try {
      // Demonstração: número e validade feitos no celular. Com o backend, vêm da resposta do pedido da loja.
      guardarComprovante(loja.slug, {
        numero: `${loja.codigoEmpresa}${Date.now().toString().slice(-6)}`,
        expiraEm: new Date(Date.now() + loja.horasReserva * 3600_000).toISOString(),
        total,
        desconto,
        pagamento,
        itens: lista.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
      });
      esvaziar(loja.slug);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive">
      <CabecalhoLoja loja={loja} titulo="Carrinho da loja" />
      {aberto ? (
        <Pressable style={estilos.faixa} onPress={() => setVerComprovante(true)} accessibilityRole="button">
          <Texto variante="rotulo" style={{ flex: 1 }}>
            Comprovante Nº {aberto.numero} ativo até {formatarHora(aberto.expiraEm)}
          </Texto>
          <Texto variante="rotulo" cor={cores.marca}>
            Ver
          </Texto>
        </Pressable>
      ) : null}
      {lista.map((i) => (
        <ItemCarrinho key={i.codprod} item={i} destino={loja.slug} />
      ))}
      <Botao
        titulo="Ler outra etiqueta"
        variante="sorriso"
        icone={<Ionicons name="qr-code" size={18} color={cores.texto} />}
        onPress={() => router.push('/leitor')}
      />
      <View style={estilos.caixa}>
        <Resumo
          linhas={[
            ['Produtos', formatarPreco(subtotal)],
            ...(desconto > 0
              ? [[`Autoatendimento (${NOME_PAGAMENTO(pagamento)})`, `- ${formatarPreco(desconto)}`, cores.sucesso] as [string, string, string]]
              : []),
          ]}
          total={total}
          rotuloTotal="Total no caixa"
        />
      </View>
      <View style={estilos.caixa}>
        <Texto variante="subtitulo">Como você vai pagar no caixa?</Texto>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {PAGAMENTOS_FIGITAL.map((pg) => {
            const ativo = pg === pagamento;
            const valor = descontoEm(lista, tabela, pg);
            return (
              <Pressable
                key={pg}
                onPress={() => setPagamento(pg)}
                accessibilityRole="radio"
                accessibilityState={{ checked: ativo }}
                style={[estilos.opcao, ativo && estilos.opcaoAtiva]}>
                <Texto variante="rotulo" cor={ativo ? cores.marca : cores.texto}>
                  {NOME_PAGAMENTO(pg)}
                </Texto>
                <Texto variante="pequeno" cor={valor > 0 ? cores.sucesso : cores.textoSuave}>
                  {valor > 0 ? `- ${formatarPreco(valor)}` : 'sem desconto'}
                </Texto>
              </Pressable>
            );
          })}
        </ScrollView>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          O desconto vale só nesta forma de pagamento: no caixa, pagar em mais parcelas cancela o pedido. Com menos parcelas pode.
        </Texto>
      </View>
      <View style={estilos.caixa}>
        <Texto variante="subtitulo">Quer pagar no caixa da loja?</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Informe seu nome e CPF e gere o comprovante. É só mostrar no caixa e pagar, sem precisar chamar um vendedor. Seus produtos ficam separados
          para você por {loja.horasReserva} horas.
        </Texto>
        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
        <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" />
        {digitosCpf.length === 11 && !cpfOk ? (
          <Texto variante="pequeno" cor={cores.marca}>
            CPF inválido.
          </Texto>
        ) : null}
        <Botao
          titulo={`Gerar comprovante para pagar em ${NOME_PAGAMENTO(pagamento)}`}
          disabled={!pronto}
          carregando={enviando}
          onPress={gerarComprovante}
        />
      </View>
      <View style={estilos.caixa}>
        <Texto variante="subtitulo">Prefere pagar pelo celular?</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Pague pelo app e receba em casa ou retire depois. Se mudar de ideia, dá para voltar aqui e pagar no caixa.
        </Texto>
        <Texto variante="pequeno">
          Pelo app o desconto do autoatendimento não entra: {formatarPreco(pixPeloApp)} no Pix. O desconto acima vale só pagando no caixa.
        </Texto>
        {todosEntregaveis ? null : (
          <Texto variante="pequeno" cor={cores.aviso}>
            Indisponível: há produto no carrinho que só pode ser finalizado no caixa.
          </Texto>
        )}
        <Botao
          titulo="Pagar pelo app"
          variante="contorno"
          disabled={!todosEntregaveis}
          // Os itens continuam no carrinho da loja: se o cliente voltar, ainda pode pagar no caixa.
          onPress={() => router.push({ pathname: '/checkout', params: { loja: loja.slug } })}
        />
      </View>
      <BotaoSairDaLoja />
    </ScrollView>
  );
}

/** O que o caixa precisa ver: número, QR, total, forma de pagamento combinada e itens. */
function ComprovanteCaixa({ comprovante: c, nomeLoja }: { comprovante: ComprovanteLoja; nomeLoja: string }) {
  return (
    <View style={[estilos.caixa, { alignItems: 'center' }]}>
      <Texto cor={cores.textoSuave}>Mostre no caixa da loja {nomeLoja}</Texto>
      <Texto variante="titulo">Nº {c.numero}</Texto>
      <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: raio.m }}>
        <QRCode value={c.numero} size={200} color={cores.texto} />
      </View>
      <Texto variante="forte">{formatarPreco(c.total)}</Texto>
      <View style={estilos.combinado}>
        <Texto variante="rotulo" style={{ textAlign: 'center' }}>
          Pagamento combinado: {NOME_PAGAMENTO(c.pagamento)}
          {c.desconto > 0 ? ` (desconto de ${formatarPreco(c.desconto)})` : ''}
        </Texto>
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
          No caixa pode pagar com menos parcelas, não com mais.
        </Texto>
      </View>
      <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
        Produtos reservados até {formatarHora(c.expiraEm)}. Depois disso a reserva cai sozinha.
      </Texto>
      {c.itens.map((i) => (
        <Texto key={i.nome} variante="pequeno">
          {i.quantidade} × {nomeLegivel(i.nome)}
        </Texto>
      ))}
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12, paddingBottom: 48 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  opcao: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: raio.m, borderWidth: 1, borderColor: cores.borda, gap: 2 },
  opcaoAtiva: { borderColor: cores.marca, borderWidth: 2 },
  faixa: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.creme },
  combinado: { gap: 2, padding: 10, borderRadius: raio.m, backgroundColor: cores.sucessoFundo, alignSelf: 'stretch' },
});
