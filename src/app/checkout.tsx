// Checkout do app em uma tela, nas etapas do site: seus dados, entrega ou retirada, pagamento e resumo. O servidor
// recalcula preço, estoque e frete antes de autorizar (CLAUDE.md: só o checkout consulta o Sankhya ao vivo).
// Pagamento como no site: cartão vai direto do app para o serviço de pagamento isolado, que devolve um token; o app
// nunca guarda número nem CVV. Nesta versão de demonstração nada é cobrado nem enviado: o pedido fica só no celular.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Aviso } from '@/componentes/estado-tela';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { totais, useCarrinho } from '@/estado/carrinho';
import { useConta } from '@/estado/conta';
import { useFigital } from '@/estado/figital';
import { consultarRetirada, cotarFrete, type CotacaoFrete, type ResultadoRetirada } from '@/lib/api';
import { arredondar, calcularParcelas, formatarCep, formatarPreco } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { dividir, escreverValor, lerValor, sugerirCartao } from '@/lib/pagamento-dividido';
import { cores, fontes, raio } from '@/lib/tema';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function Etapa({ numero, titulo, children }: { numero: number; titulo: string; children: React.ReactNode }) {
  return (
    <View style={estilos.etapa}>
      <View style={estilos.cabecalhoEtapa}>
        <View style={estilos.numero}>
          <Texto variante="rotulo" cor="#fff">
            {numero}
          </Texto>
        </View>
        <Texto variante="subtitulo">{titulo}</Texto>
      </View>
      {children}
    </View>
  );
}

function Opcao({
  ativa,
  titulo,
  texto,
  destaque,
  icone,
  desativada,
  aoTocar,
}: {
  ativa: boolean;
  titulo: string;
  texto?: string;
  /** Linha em verde abaixo do título (ex.: prazo da retirada). */
  destaque?: string;
  icone: React.ComponentProps<typeof Ionicons>['name'];
  desativada?: boolean;
  aoTocar: () => void;
}) {
  return (
    <Pressable
      onPress={aoTocar}
      disabled={desativada}
      style={[estilos.opcao, ativa && estilos.opcaoAtiva, desativada && { opacity: 0.5 }]}
      accessibilityRole="radio"
      accessibilityState={{ checked: ativa, disabled: desativada }}>
      <Ionicons name={icone} size={22} color={ativa ? cores.marca : cores.textoSuave} />
      <View style={{ flex: 1 }}>
        <Texto variante="forte">{titulo}</Texto>
        {destaque ? (
          <Texto variante="pequeno" cor={cores.sucesso} style={{ fontFamily: fontes.textoForte }}>
            {destaque}
          </Texto>
        ) : null}
        {texto ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {texto}
          </Texto>
        ) : null}
      </View>
      <Ionicons name={ativa ? 'radio-button-on' : 'radio-button-off'} size={22} color={ativa ? cores.marca : cores.borda} />
    </Pressable>
  );
}

/** Número provisório do pedido no modo de demonstração; com o backend, vem da resposta do pedido. */
const novoNumeroPedido = () => `APP-${Date.now().toString().slice(-7)}`;

export default function Checkout() {
  // Vindo do carrinho da loja (Figital), o checkout usa o carrinho dela e o cliente pode voltar ao caixa.
  const { loja: daLoja } = useLocalSearchParams<{ loja?: string }>();
  const destino = daLoja ?? 'site';
  const { itens, esvaziar } = useCarrinho();
  const conta = useConta();
  const { lojas, lojaAtual } = useFigital();
  const lista = itens(destino);
  const { subtotal, pix } = totais(lista);

  const [email, setEmail] = useState(conta.email ?? '');
  const [nome, setNome] = useState(conta.nome ?? '');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState(conta.cep ?? '');
  const [numero, setNumero] = useState('');
  const [entrega, setEntrega] = useState<'entrega' | 'retirada'>(daLoja ? 'retirada' : 'entrega');
  const [loja, setLoja] = useState<string | undefined>(daLoja);
  const [forma, setForma] = useState<'pix' | 'cartao'>('pix');
  /** No cartão: o cliente responde se uma parte vai no Pix (com o desconto só nessa parte). */
  const [parteNoPix, setParteNoPix] = useState(false);
  const [noCartaoTexto, setNoCartaoTexto] = useState('');
  const [retirada, setRetirada] = useState<{
    chave: string;
    resultado?: ResultadoRetirada;
  }>();
  const [parcelas, setParcelas] = useState(1);
  const [cartao, setCartao] = useState({
    numero: '',
    nome: '',
    validade: '',
    cvv: '',
  });
  const [cotado, setCotado] = useState<{
    chave: string;
    frete?: CotacaoFrete;
  }>();
  const [enviando, setEnviando] = useState(false);

  const chaveFrete = entrega === 'entrega' && cep.replace(/\D/g, '').length === 8 ? `${cep}:${subtotal}` : undefined;
  useEffect(() => {
    if (!chaveFrete) return;
    let ativo = true;
    cotarFrete(cep, subtotal)
      .then((frete) => ativo && setCotado({ chave: chaveFrete, frete }))
      .catch(() => ativo && setCotado({ chave: chaveFrete }));
    return () => {
      ativo = false;
    };
  }, [cep, chaveFrete, subtotal]);
  const frete = chaveFrete && cotado?.chave === chaveFrete ? cotado.frete : undefined;

  // Retirada: prazo de cada loja e a sugerida (CD da empresa 7 primeiro, como no site).
  const itensRetirada = lista.map((i) => ({
    codprod: i.codprod,
    quantidade: i.quantidade,
  }));
  const chaveRetirada = entrega === 'retirada' ? `${JSON.stringify(itensRetirada)}:${cep}` : undefined;
  useEffect(() => {
    if (!chaveRetirada) return;
    let ativo = true;
    consultarRetirada(JSON.parse(chaveRetirada.slice(0, chaveRetirada.lastIndexOf(':'))), { cep, preferida: daLoja ?? lojaAtual?.slug })
      .then((resultado) => {
        if (!ativo) return;
        setRetirada({ chave: chaveRetirada, resultado });
        setLoja((atual) => atual ?? resultado.sugerida);
      })
      .catch(() => ativo && setRetirada({ chave: chaveRetirada }));
    return () => {
      ativo = false;
    };
  }, [chaveRetirada, cep, daLoja, lojaAtual?.slug]);
  const opcoesRetirada = chaveRetirada && retirada?.chave === chaveRetirada ? retirada.resultado?.opcoes : undefined;
  const retiradaCarregando = Boolean(chaveRetirada) && retirada?.chave !== chaveRetirada;
  const lojaEscolhida = opcoesRetirada?.find((o) => o.loja === loja);

  if (!lista.length) return <Aviso titulo="Seu carrinho está vazio" acao="Voltar ao início" aoTocar={() => router.replace('/')} />;

  const valorFrete = entrega === 'retirada' ? 0 : frete?.atendido ? frete.cotacao.valor : undefined;
  const taxaPix = subtotal > 0 ? (subtotal - pix) / subtotal : 0;
  const dividido = forma === 'cartao' && parteNoPix;
  const divisao = dividido ? dividir(lerValor(noCartaoTexto), subtotal, valorFrete ?? 0, taxaPix) : undefined;
  const total = divisao ? divisao.total : arredondar((forma === 'pix' ? pix : subtotal) + (valorFrete ?? 0));
  const valorCartao = divisao ? divisao.cartao : arredondar(subtotal + (valorFrete ?? 0));
  const maxParcelas = calcularParcelas(valorCartao).quantidade;
  const cartaoOk =
    cartao.numero.replace(/\D/g, '').length >= 13 &&
    cartao.nome.trim().length > 2 &&
    /^\d{2}\/\d{2}$/.test(cartao.validade) &&
    /^\d{3,4}$/.test(cartao.cvv);
  const pronto =
    EMAIL.test(email.trim()) &&
    nome.trim().length > 2 &&
    cpf.replace(/\D/g, '').length === 11 &&
    (entrega === 'retirada' ? Boolean(loja) && lojaEscolhida?.disponivel !== false : valorFrete !== undefined && numero.trim().length > 0) &&
    (forma === 'pix' || (cartaoOk && !divisao?.erro));

  const finalizar = () => {
    setEnviando(true);
    const numeroPedido = novoNumeroPedido();
    conta.registrarPedido({
      numero: numeroPedido,
      criadoEm: new Date().toISOString(),
      itens: lista,
      total,
      forma: dividido ? 'cartao-pix' : forma,
      entrega,
      // Loja do pedido: a da retirada ou, entrega pedida dentro de uma loja, a loja onde o cliente estava.
      loja: entrega === 'retirada' ? loja : daLoja,
      situacao: forma === 'pix' ? 'aguardando-pix' : 'em-analise',
    });
    if (!conta.logado) conta.entrar(email.trim().toLowerCase(), nome.trim());
    esvaziar(destino);
    router.replace({
      pathname: '/pedido-recebido',
      params: { numero: numeroPedido, forma: dividido ? 'cartao-pix' : forma },
    });
  };

  return (
    <ScrollView
      contentContainerStyle={estilos.conteudo}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="interactive">
      {daLoja ? <VoltarParaLoja slug={daLoja} nome={lojas.find((l) => l.slug === daLoja)?.nome} /> : null}
      <Etapa numero={1} titulo="Seus dados">
        <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
        <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" />
      </Etapa>

      <Etapa numero={2} titulo="Entrega ou retirada">
        <Opcao
          ativa={entrega === 'entrega'}
          icone="car-outline"
          titulo="Receber em casa"
          texto="Entrega própria em Belém e região"
          aoTocar={() => setEntrega('entrega')}
        />
        <Opcao
          ativa={entrega === 'retirada'}
          icone="storefront-outline"
          titulo="Retirar na loja"
          texto="Grátis, quando o pedido estiver pronto"
          aoTocar={() => setEntrega('retirada')}
        />
        {entrega === 'entrega' ? (
          <>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Campo rotulo="CEP" value={formatarCep(cep)} onChangeText={setCep} keyboardType="number-pad" maxLength={9} />
              <Campo rotulo="Número" value={numero} onChangeText={setNumero} />
            </View>
            {frete?.atendido ? (
              <Texto variante="forte" cor={frete.cotacao.valor === 0 ? cores.sucesso : cores.texto}>
                {frete.cotacao.valor === 0 ? 'Frete grátis' : `Frete ${formatarPreco(frete.cotacao.valor)}`}, {frete.cotacao.prazo}
              </Texto>
            ) : frete ? (
              <Texto cor={cores.aviso}>Ainda não entregamos nesse CEP. Escolha retirar na loja.</Texto>
            ) : null}
          </>
        ) : (
          <>
            {retiradaCarregando ? <Texto cor={cores.textoSuave}>Calculando o prazo de cada loja…</Texto> : null}
            {(
              opcoesRetirada ??
              lojas.map(
                (l) =>
                  ({ loja: l.slug }) as {
                    loja: string;
                    prazo?: string;
                    disponivel?: boolean;
                    motivo?: string;
                    destaques?: string[];
                    exposicao?: boolean;
                  },
              )
            ).map((o) => {
              const l = lojas.find((x) => x.slug === o.loja);
              if (!l) return null;
              const destaques = o.destaques?.length ? ` · ${o.destaques.join(' · ')}` : '';
              return (
                <Opcao
                  key={o.loja}
                  ativa={loja === o.loja}
                  icone="location-outline"
                  titulo={`Loja ${l.nome}`}
                  destaque={o.disponivel === false ? undefined : o.prazo ? `${o.prazo}${destaques}` : undefined}
                  texto={o.disponivel === false ? (o.motivo ?? 'Sem os produtos para retirar aqui') : l.endereco}
                  desativada={o.disponivel === false}
                  aoTocar={() => setLoja(o.loja)}
                />
              );
            })}
            {lojaEscolhida?.exposicao ? (
              <Texto variante="pequeno" cor={cores.aviso}>
                Uma das peças é a de exposição desta loja. A loja confere o estado dela e confirma antes de aprovar o pedido.
              </Texto>
            ) : null}
            {!retiradaCarregando && !opcoesRetirada ? (
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Não conseguimos ver o prazo agora. A loja avisa quando o pedido estiver pronto.
              </Texto>
            ) : null}
          </>
        )}
      </Etapa>

      <Etapa numero={3} titulo="Pagamento">
        <Opcao
          ativa={forma === 'pix'}
          icone="flash-outline"
          titulo="Pix"
          texto={`${formatarPreco(pix)} à vista, com desconto`}
          aoTocar={() => setForma('pix')}
        />
        <Opcao
          ativa={forma === 'cartao'}
          icone="card-outline"
          titulo="Cartão de crédito"
          texto={`Até ${calcularParcelas(subtotal).quantidade}x sem juros`}
          aoTocar={() => setForma('cartao')}
        />
        {forma === 'cartao' && (
          <View style={{ gap: 12 }}>
            <Texto variante="forte">Quer pagar uma parte no Pix?</Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              A parte do Pix ganha o desconto do Pix. O resto vai no cartão.
            </Texto>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[
                { sim: false, titulo: 'Não, tudo no cartão' },
                { sim: true, titulo: 'Sim, uma parte no Pix' },
              ].map((b) => (
                <Pressable
                  key={b.titulo}
                  onPress={() => {
                    setParteNoPix(b.sim);
                    if (b.sim && !noCartaoTexto) setNoCartaoTexto(escreverValor(sugerirCartao(subtotal, valorFrete ?? 0)));
                    setParcelas(1);
                  }}
                  style={[estilos.parcela, { flex: 1, alignItems: 'center' }, parteNoPix === b.sim && estilos.opcaoAtiva]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: parteNoPix === b.sim }}>
                  <Texto variante="rotulo">{b.titulo}</Texto>
                </Pressable>
              ))}
            </View>
            {divisao ? (
              <View style={{ gap: 6 }}>
                <Campo rotulo="Quanto vai no cartão (R$)" value={noCartaoTexto} onChangeText={setNoCartaoTexto} keyboardType="decimal-pad" />
                {divisao.erro ? (
                  <Texto variante="pequeno" cor={cores.aviso}>
                    {divisao.erro}
                  </Texto>
                ) : (
                  <Texto variante="pequeno" cor={cores.sucesso}>
                    No Pix: {formatarPreco(divisao.pix)} (com {formatarPreco(divisao.descontoPix)} de desconto)
                  </Texto>
                )}
              </View>
            ) : null}
            <Campo
              rotulo="Número do cartão"
              value={cartao.numero}
              onChangeText={(t) =>
                setCartao((c) => ({
                  ...c,
                  numero: t.replace(/[^\d ]/g, '').slice(0, 23),
                }))
              }
              keyboardType="number-pad"
              autoComplete="cc-number"
            />
            <Campo
              rotulo="Nome impresso"
              value={cartao.nome}
              onChangeText={(t) => setCartao((c) => ({ ...c, nome: t.toUpperCase() }))}
              autoComplete="cc-name"
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Campo
                rotulo="Validade"
                placeholder="MM/AA"
                value={cartao.validade}
                onChangeText={(t) => {
                  const d = t.replace(/\D/g, '').slice(0, 4);
                  setCartao((c) => ({
                    ...c,
                    validade: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d,
                  }));
                }}
                keyboardType="number-pad"
              />
              <Campo
                rotulo="CVV"
                value={cartao.cvv}
                onChangeText={(t) =>
                  setCartao((c) => ({
                    ...c,
                    cvv: t.replace(/\D/g, '').slice(0, 4),
                  }))
                }
                keyboardType="number-pad"
                secureTextEntry
              />
            </View>
            <View style={estilos.parcelas}>
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                <Pressable key={n} onPress={() => setParcelas(n)} style={[estilos.parcela, parcelas === n && estilos.opcaoAtiva]}>
                  <Texto variante="rotulo">
                    {n}x {formatarPreco(arredondar(valorCartao / n))}
                  </Texto>
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </Etapa>

      <Etapa numero={4} titulo="Resumo">
        <Resumo
          linhas={[
            [`Produtos (${lista.reduce((t, i) => t + i.quantidade, 0)})`, formatarPreco(subtotal)],
            ...(forma === 'pix'
              ? [['Desconto no Pix', `- ${formatarPreco(arredondar(subtotal - pix))}`, cores.sucesso] as [string, string, string]]
              : []),
            ...(divisao && !divisao.erro
              ? ([
                  ['Desconto no Pix', `- ${formatarPreco(divisao.descontoPix)}`, cores.sucesso],
                  ['No cartão', formatarPreco(divisao.cartao)],
                  ['No Pix', formatarPreco(divisao.pix)],
                ] as [string, string, string?][])
              : []),
            entrega === 'retirada'
              ? ['Retirada', lojaEscolhida?.prazo ? `grátis · ${lojaEscolhida.prazo.replace(/^Pronto para retirar /, '')}` : 'grátis']
              : [
                  'Frete',
                  valorFrete === undefined
                    ? 'informe o CEP'
                    : `${valorFrete === 0 ? 'grátis' : formatarPreco(valorFrete)}${frete?.atendido ? ` · ${frete.cotacao.prazo}` : ''}`,
                ],
          ]}
          total={total}
        />
        <Botao
          titulo={forma === 'pix' ? 'Gerar Pix' : dividido ? 'Pagar no cartão e gerar Pix' : 'Pagar com cartão'}
          disabled={!pronto}
          carregando={enviando}
          onPress={finalizar}
        />
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
          Demonstração: nenhum valor é cobrado. Na versão final o pagamento passa pela e.Rede e pela análise da ClearSale.
        </Texto>
      </Etapa>
    </ScrollView>
  );
}

/**
 * Carrinho que veio do autoatendimento: o cliente pode mudar de ideia, voltar ao carrinho da loja, mexer nos itens ou
 * pagar no caixa. Os itens continuam lá até o pedido ser feito.
 */
function VoltarParaLoja({ slug, nome }: { slug: string; nome?: string }) {
  const voltar = () => {
    if (router.canGoBack()) router.back();
    else router.replace(rotaCarrinhoLoja(slug) as never);
  };
  return (
    <View style={estilos.daLoja}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
        <Ionicons name="storefront-outline" size={22} color={cores.marca} />
        <Texto variante="forte" style={{ flex: 1 }}>
          Carrinho do autoatendimento{nome ? ` da loja ${nome}` : ''}
        </Texto>
      </View>
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Mudou de ideia? Volte para mexer nos produtos ou para pagar no caixa da loja. Nada se perde.
      </Texto>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <Botao titulo="Editar carrinho" variante="contorno" onPress={voltar} />
        </View>
        <View style={{ flex: 1 }}>
          <Botao titulo="Pagar no caixa" variante="contorno" onPress={voltar} />
        </View>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  daLoja: { backgroundColor: cores.creme, borderRadius: raio.l, padding: 16, gap: 10 },
  conteudo: { padding: 16, gap: 16, paddingBottom: 48 },
  etapa: {
    backgroundColor: cores.superficie,
    borderRadius: raio.l,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cabecalhoEtapa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: cores.marca,
    alignItems: 'center',
    justifyContent: 'center',
  },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
  },
  opcaoAtiva: { borderColor: cores.marca, backgroundColor: '#fff5f5' },
  parcelas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  parcela: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
  },
});
