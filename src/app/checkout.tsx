// Checkout do app em uma tela, nas etapas do site: seus dados, entrega ou retirada, pagamento e resumo. O servidor
// recalcula preço, estoque e frete antes de autorizar (CLAUDE.md: só o checkout consulta o Sankhya ao vivo).
// Pagamento como no site: cartão vai direto do app para o serviço de pagamento isolado, que devolve um token; o app
// nunca guarda número nem CVV. Nesta versão de demonstração nada é cobrado nem enviado: o pedido fica só no celular.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Aviso } from '@/componentes/estado-tela';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { disponiveis, totais, useCarrinho } from '@/estado/carrinho';
import { useConta } from '@/estado/conta';
import { useFigital } from '@/estado/figital';
import { useRegraPagamento } from '@/estado/pagamento';
import { consultarRetirada, cotarFrete, type CotacaoFrete, type ResultadoRetirada } from '@/lib/api';
import {
  arredondar,
  calcularParcelas,
  celularValido,
  cpfValido,
  formatarCelular,
  formatarCep,
  formatarCpf,
  formatarPreco,
  nomeCompleto,
} from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { dividir, escreverValor, lerValor, sugerirCartao } from '@/lib/pagamento-dividido';
import { cores, fontes, raio } from '@/lib/tema';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Validade MM/AA com mês de 01 a 12 (cartão vencido a e.Rede recusa e a tela mostra o erro). */
const VALIDADE = /^(0[1-9]|1[0-2])\/\d{2}$/;
/** Cotação do frete que não volta nesse tempo vira erro, com "Tentar de novo". */
const ESPERA_FRETE_MS = 15000;

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
  const { itens, esvaziar, atualizar } = useCarrinho();
  const conta = useConta();
  const { lojas, lojaAtual } = useFigital();
  const regra = useRegraPagamento();
  // Só entra no pedido o que pode ser comprado aqui: some o que ficou indisponível e, vindo da loja, o que só sai
  // pelo caixa (o botão do carrinho da loja já bloqueia, mas um link direto para o checkout não passa por ele).
  const todos = itens(destino);
  const lista = disponiveis(todos).filter((i) => !daLoja || i.entregavel !== false);
  const deFora = todos.length - lista.length;
  const { subtotal, pix } = totais(lista);
  // Android: a tela do checkout não sai em print, gravação nem na miniatura dos apps recentes (FLAG_SECURE). No
  // iPhone a capa sobre os campos do cartão cobre o seletor de apps, e o print continua liberado para os testes.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    ScreenCapture.preventScreenCaptureAsync('checkout').catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync('checkout').catch(() => undefined);
    };
  }, []);
  // Confere preço e disponibilidade com o site ao abrir (o carrinho pode estar guardado há dias).
  useEffect(() => {
    atualizar(destino).catch(() => undefined);
  }, [atualizar, destino]);

  const [email, setEmail] = useState(conta.email ?? '');
  const [nome, setNome] = useState(conta.nome ?? '');
  const [cpf, setCpf] = useState('');
  const [celular, setCelular] = useState('');
  /** Campos que o cliente já deixou: o erro de cada um só aparece depois disso (o CPF completo já mostra na hora). */
  const [saiu, setSaiu] = useState<Record<string, boolean>>({});
  const [cep, setCep] = useState((conta.cep ?? '').replace(/\D/g, '').slice(0, 8));
  const [logradouro, setLogradouro] = useState('');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [bairro, setBairro] = useState('');
  const [cidade, setCidade] = useState('');
  const [uf, setUf] = useState('');
  const [referencia, setReferencia] = useState('');
  const [entrega, setEntrega] = useState<'entrega' | 'retirada'>(daLoja ? 'retirada' : 'entrega');
  const [loja, setLoja] = useState<string | undefined>(daLoja);
  /** Retirada com a peça de exposição: o cliente aceita antes de pagar (contrato 3.6.1, aceitaExposicao). */
  const [aceitaExposicao, setAceitaExposicao] = useState(false);
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
  /** Sobe a cada "Tentar de novo" do frete, para a cotação rodar outra vez com o mesmo CEP. */
  const [tentativaFrete, setTentativaFrete] = useState(0);
  const [enviando, setEnviando] = useState(false);
  /** Recusa do cartão, preço que mudou, sem estoque: com o backend, a mensagem do servidor aparece aqui. */
  const [erroPagamento, setErroPagamento] = useState<string>();
  /** Fora de primeiro plano (seletor de apps), os dados do cartão ficam cobertos para não aparecerem na miniatura. */
  const [emPrimeiroPlano, setEmPrimeiroPlano] = useState(AppState.currentState === 'active');

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => setEmPrimeiroPlano(estado === 'active'));
    return () => assinatura.remove();
  }, []);

  // O frete é cotado com qualquer CEP completo: na entrega dá o valor; nas duas opções, preenche rua, bairro e cidade.
  const chaveFrete = cep.length === 8 ? `${cep}:${subtotal}:${tentativaFrete}` : undefined;
  useEffect(() => {
    if (!chaveFrete) return;
    let ativo = true;
    const espera = setTimeout(() => ativo && setCotado((c) => (c?.chave === chaveFrete ? c : { chave: chaveFrete })), ESPERA_FRETE_MS);
    cotarFrete(cep, subtotal)
      .then((frete) => {
        if (!ativo) return;
        setCotado({ chave: chaveFrete, frete });
        const e = frete.endereco;
        if (!e) return;
        // Só preenche o que o cliente ainda não digitou. CEP geral de cidade vem sem rua e sem bairro.
        if (e.logradouro) setLogradouro((atual) => atual || e.logradouro || '');
        if (e.bairro) setBairro((atual) => atual || e.bairro);
        if (e.cidade) setCidade((atual) => atual || e.cidade);
        if (e.uf) setUf((atual) => atual || e.uf.toUpperCase());
      })
      .catch(() => ativo && setCotado({ chave: chaveFrete }))
      .finally(() => clearTimeout(espera));
    return () => {
      ativo = false;
      clearTimeout(espera);
    };
  }, [cep, chaveFrete, subtotal]);
  const frete = chaveFrete && cotado?.chave === chaveFrete ? cotado.frete : undefined;
  const freteCarregando = Boolean(chaveFrete) && cotado?.chave !== chaveFrete;
  const freteFalhou = Boolean(chaveFrete) && cotado?.chave === chaveFrete && !cotado?.frete;

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

  if (!lista.length) return <Aviso titulo="Seu carrinho está vazio" acao="Voltar ao início" aoTocar={() => router.dismissTo('/')} />;

  const valorFrete = entrega === 'retirada' ? 0 : frete?.atendido ? frete.cotacao.valor : undefined;
  const bruto = arredondar(subtotal + (valorFrete ?? 0));
  const taxaPix = subtotal > 0 ? (subtotal - pix) / subtotal : 0;
  const dividido = forma === 'cartao' && parteNoPix;
  const divisao = dividido ? dividir(lerValor(noCartaoTexto), subtotal, valorFrete ?? 0, taxaPix, regra) : undefined;
  // Com a divisão errada, nenhuma parte ganha o desconto do Pix: o total fica cheio até o valor ser corrigido.
  const total = divisao && !divisao.erro ? divisao.total : arredondar((forma === 'pix' ? pix : subtotal) + (valorFrete ?? 0));
  const valorCartao = divisao ? divisao.cartao : bruto;
  const maxParcelas = calcularParcelas(valorCartao, regra).quantidade;
  // Se o valor no cartão cai e o máximo diminui, a escolha volta para o maior número permitido.
  const parcelasValidas = Math.min(parcelas, maxParcelas);
  const maxParcelasOpcao = calcularParcelas(bruto, regra).quantidade;
  const parcelamento = `${parcelasValidas}x de ${formatarPreco(arredondar(valorCartao / parcelasValidas))}`;

  const cpfDigitos = cpf.replace(/\D/g, '');
  const erroEmail = saiu.email && !EMAIL.test(email.trim()) ? 'E-mail inválido.' : undefined;
  const erroNome = saiu.nome && !nomeCompleto(nome) ? 'Informe nome e sobrenome.' : undefined;
  const erroCpf = (cpfDigitos.length === 11 || (saiu.cpf && cpfDigitos.length > 0)) && !cpfValido(cpf) ? 'CPF inválido.' : undefined;
  const erroCelular = saiu.celular && !celularValido(celular) ? 'Informe o celular com DDD.' : undefined;
  const sair = (campo: string) => () => setSaiu((s) => (s[campo] ? s : { ...s, [campo]: true }));

  // O que ainda falta, na ordem da tela. A mesma lista liga o botão de pagar e aparece embaixo dele.
  const falta = [
    !EMAIL.test(email.trim()) && 'e-mail',
    !nomeCompleto(nome) && 'nome e sobrenome',
    !cpfValido(cpf) && 'CPF válido',
    !celularValido(celular) && 'celular com DDD',
    entrega === 'retirada' && (!loja || lojaEscolhida?.disponivel === false) && 'loja de retirada',
    entrega === 'retirada' && lojaEscolhida?.exposicao && !aceitaExposicao && 'aceite da peça de exposição',
    cep.length !== 8 && 'CEP',
    entrega === 'entrega' &&
      cep.length === 8 &&
      valorFrete === undefined &&
      (freteCarregando ? 'aguardar o frete' : freteFalhou ? 'calcular o frete' : 'CEP com entrega'),
    !logradouro.trim() && 'rua',
    !numero.trim() && 'número do endereço',
    !bairro.trim() && 'bairro',
    !cidade.trim() && 'cidade',
    !/^[A-Za-z]{2}$/.test(uf.trim()) && 'UF',
    forma === 'cartao' && divisao?.erro && 'valor no cartão',
    forma === 'cartao' && cartao.numero.replace(/\D/g, '').length < 13 && 'número do cartão',
    forma === 'cartao' && cartao.nome.trim().length <= 2 && 'nome impresso',
    forma === 'cartao' && !VALIDADE.test(cartao.validade) && 'validade (MM/AA)',
    forma === 'cartao' && !/^\d{3,4}$/.test(cartao.cvv) && 'CVV',
  ].filter((f): f is string => typeof f === 'string');
  const pronto = falta.length === 0;

  const finalizar = async () => {
    if (!pronto || enviando) return;
    setEnviando(true);
    setErroPagamento(undefined);
    try {
      // Com o backend: POST do pedido (contrato 3.3). Recusa (402), preço mudado ou sem estoque (409) e retirada
      // indisponível (422) caem no catch com a mensagem do servidor, e o carrinho fica como está.
      const numeroPedido = novoNumeroPedido();
      const temPix = forma === 'pix' || dividido;
      conta.registrarPedido({
        numero: numeroPedido,
        criadoEm: new Date().toISOString(),
        itens: lista,
        total,
        forma: dividido ? 'cartao-pix' : forma,
        entrega,
        // Loja do pedido: a da retirada ou, entrega pedida dentro de uma loja, a loja onde o cliente estava.
        loja: entrega === 'retirada' ? loja : daLoja,
        situacao: temPix ? 'aguardando-pix' : 'em-analise',
        celular: celular.replace(/\D/g, ''),
        endereco: {
          cep,
          logradouro: logradouro.trim(),
          numero: numero.trim(),
          complemento: complemento.trim() || undefined,
          bairro: bairro.trim(),
          cidade: cidade.trim(),
          uf: uf.trim().toUpperCase(),
          referencia: referencia.trim() || undefined,
        },
        // Valor que falta no Pix (o pedido todo ou a parte do Pix). Código e QR vêm do servidor, nunca da rota.
        pix: temPix ? { valor: divisao ? divisao.pix : total } : undefined,
      });
      if (!conta.logado) conta.entrar(email.trim().toLowerCase(), nome.trim());
      esvaziar(destino);
      router.replace({ pathname: '/pedido-recebido', params: { numero: numeroPedido } });
    } catch (e) {
      setErroPagamento(e instanceof Error && e.message ? e.message : 'Não conseguimos concluir o pedido. Confira os dados e tente de novo.');
      // O CVV nunca fica guardado: depois de uma recusa o cliente digita de novo.
      setCartao((c) => ({ ...c, cvv: '' }));
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
      {daLoja ? <VoltarParaLoja slug={daLoja} nome={lojas.find((l) => l.slug === daLoja)?.nome} /> : null}
      {deFora > 0 ? (
        <View style={estilos.alerta} accessibilityRole="alert">
          <Ionicons name="information-circle" size={20} color={cores.aviso} />
          <Texto style={{ flex: 1 }}>
            {deFora === 1 ? '1 produto do carrinho ficou de fora desta compra' : `${deFora} produtos do carrinho ficaram de fora desta compra`}
            {daLoja ? ': indisponível agora ou só pode ser pago no caixa da loja.' : ': indisponível agora.'}
          </Texto>
        </View>
      ) : null}
      <Etapa numero={1} titulo="Seus dados">
        <Campo
          rotulo="E-mail"
          value={email}
          onChangeText={setEmail}
          onBlur={sair('email')}
          erro={erroEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} onBlur={sair('nome')} erro={erroNome} autoComplete="name" />
        <Campo
          rotulo="CPF"
          value={formatarCpf(cpf)}
          onChangeText={(t) => setCpf(t.replace(/\D/g, '').slice(0, 11))}
          onBlur={sair('cpf')}
          erro={erroCpf}
          keyboardType="number-pad"
          maxLength={14}
        />
        <Campo
          rotulo="Celular com DDD"
          value={formatarCelular(celular)}
          onChangeText={(t) => setCelular(t.replace(/\D/g, '').slice(0, 11))}
          onBlur={sair('celular')}
          erro={erroCelular}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={15}
        />
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
        {entrega === 'retirada' ? (
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
                  aoTocar={() => {
                    if (o.loja !== loja) setAceitaExposicao(false);
                    setLoja(o.loja);
                  }}
                />
              );
            })}
            {lojaEscolhida?.exposicao ? (
              <View style={{ gap: 8 }}>
                <Texto variante="pequeno" cor={cores.aviso}>
                  Uma das peças é a de exposição desta loja. A loja confere o estado dela e confirma antes de aprovar o pedido.
                </Texto>
                <Pressable
                  onPress={() => setAceitaExposicao((a) => !a)}
                  style={estilos.aceite}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: aceitaExposicao }}>
                  <Ionicons
                    name={aceitaExposicao ? 'checkbox' : 'square-outline'}
                    size={24}
                    color={aceitaExposicao ? cores.marca : cores.textoSuave}
                  />
                  <Texto style={{ flex: 1 }}>Aceito retirar a peça de exposição, depois da conferência da loja.</Texto>
                </Pressable>
              </View>
            ) : null}
            {!retiradaCarregando && !opcoesRetirada ? (
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Não conseguimos ver o prazo agora. A loja avisa quando o pedido estiver pronto.
              </Texto>
            ) : null}
          </>
        ) : null}

        <Texto variante="forte">{entrega === 'entrega' ? 'Endereço de entrega' : 'Seu endereço (vai na nota fiscal)'}</Texto>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Campo
            rotulo="CEP"
            value={formatarCep(cep)}
            onChangeText={(t) => setCep(t.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            autoComplete="postal-code"
            maxLength={9}
          />
          <Campo rotulo="Número" placeholder="S/N se não tiver" value={numero} onChangeText={setNumero} autoCapitalize="characters" />
        </View>
        {entrega === 'entrega' ? (
          frete?.atendido ? (
            <Texto variante="forte" cor={frete.cotacao.valor === 0 ? cores.sucesso : cores.texto}>
              {frete.cotacao.valor === 0 ? 'Frete grátis' : `Frete ${formatarPreco(frete.cotacao.valor)}`}, {frete.cotacao.prazo}
            </Texto>
          ) : frete ? (
            <Texto cor={cores.aviso}>Ainda não entregamos nesse CEP. Escolha retirar na loja.</Texto>
          ) : freteCarregando ? (
            <Texto cor={cores.textoSuave}>Calculando o frete…</Texto>
          ) : freteFalhou ? (
            <View style={{ gap: 8 }}>
              <Texto cor={cores.aviso}>Não conseguimos calcular o frete agora. Tente de novo ou escolha retirar na loja.</Texto>
              <Botao titulo="Tentar de novo" variante="contorno" onPress={() => setTentativaFrete((t) => t + 1)} />
            </View>
          ) : null
        ) : null}
        <Campo rotulo="Rua" value={logradouro} onChangeText={setLogradouro} autoComplete="street-address" />
        <Campo rotulo="Complemento (opcional)" value={complemento} onChangeText={setComplemento} />
        <Campo rotulo="Bairro" value={bairro} onChangeText={setBairro} />
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Campo rotulo="Cidade" value={cidade} onChangeText={setCidade} />
          <View style={{ width: 84 }}>
            <Campo
              rotulo="UF"
              value={uf}
              onChangeText={(t) => setUf(t.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase())}
              autoCapitalize="characters"
              maxLength={2}
            />
          </View>
        </View>
        <Campo rotulo="Ponto de referência (opcional)" value={referencia} onChangeText={setReferencia} />
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
          texto={maxParcelasOpcao > 1 ? `Até ${maxParcelasOpcao}x sem juros` : 'À vista no cartão'}
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
                  accessibilityState={{ checked: parteNoPix === b.sim, selected: parteNoPix === b.sim }}>
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
            <View style={{ gap: 12 }}>
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
                // 'cc-name' não existe no Android: lá o React Native desliga o preenchimento do campo.
                autoComplete={Platform.OS === 'ios' ? 'cc-name' : undefined}
                autoCorrect={false}
                spellCheck={false}
                autoCapitalize="characters"
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
                  autoComplete="cc-exp"
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
                  autoComplete="cc-csc"
                  secureTextEntry
                />
              </View>
              {emPrimeiroPlano ? null : (
                // Capa para a miniatura do seletor de apps (o sistema tira a foto quando o app sai da frente).
                <View style={[StyleSheet.absoluteFill, estilos.capa]}>
                  <Ionicons name="lock-closed-outline" size={28} color={cores.textoSuave} />
                  <Texto cor={cores.textoSuave}>Dados do cartão protegidos</Texto>
                </View>
              )}
            </View>
            <View style={estilos.parcelas} accessibilityRole="radiogroup" accessibilityLabel="Parcelas">
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                <Pressable
                  key={n}
                  onPress={() => setParcelas(n)}
                  style={[estilos.parcela, parcelasValidas === n && estilos.opcaoAtiva]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: parcelasValidas === n, selected: parcelasValidas === n }}
                  accessibilityLabel={`${n} ${n === 1 ? 'vez' : 'vezes'} de ${formatarPreco(arredondar(valorCartao / n))}`}>
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
              ? [['Desconto no Pix', `- ${formatarPreco(divisao.descontoPix)}`, cores.sucesso] as [string, string, string]]
              : []),
            entrega === 'retirada'
              ? ['Retirada', lojaEscolhida?.prazo ? `grátis · ${lojaEscolhida.prazo.replace(/^Pronto para retirar /, '')}` : 'grátis']
              : [
                  'Frete',
                  valorFrete !== undefined
                    ? `${valorFrete === 0 ? 'grátis' : formatarPreco(valorFrete)}${frete?.atendido ? ` · ${frete.cotacao.prazo}` : ''}`
                    : !chaveFrete
                      ? 'informe o CEP'
                      : freteCarregando
                        ? 'calculando…'
                        : freteFalhou
                          ? 'tente de novo'
                          : 'sem entrega no CEP',
                ],
          ]}
          total={total}
          rodape={
            forma === 'pix'
              ? undefined
              : divisao
                ? divisao.erro
                  ? undefined
                  : `Como você vai pagar: cartão ${formatarPreco(divisao.cartao)} em ${parcelamento} · Pix ${formatarPreco(divisao.pix)}`
                : `No cartão: ${parcelamento}`
          }
        />
        {erroPagamento ? (
          <View style={estilos.erro} accessibilityRole="alert">
            <Ionicons name="alert-circle-outline" size={22} color={cores.marca} />
            <Texto style={{ flex: 1 }}>{erroPagamento}</Texto>
          </View>
        ) : null}
        <Botao
          titulo={forma === 'pix' ? 'Gerar Pix' : dividido ? 'Pagar no cartão e gerar Pix' : 'Pagar com cartão'}
          disabled={!pronto}
          carregando={enviando}
          onPress={finalizar}
        />
        {!pronto && !enviando ? (
          <Texto variante="pequeno" cor={cores.aviso} style={{ textAlign: 'center' }}>
            Falta: {falta.join(', ')}.
          </Texto>
        ) : null}
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
      <Texto variante="pequeno" cor={cores.aviso}>
        O desconto do autoatendimento só vale pagando no caixa da loja. Aqui vale o preço do app, com o desconto do Pix.
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
  aceite: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 4 },
  capa: {
    backgroundColor: cores.superficie,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: raio.m,
  },
  alerta: { flexDirection: 'row', gap: 8, alignItems: 'flex-start', backgroundColor: cores.avisoFundo, borderRadius: raio.m, padding: 12 },
  erro: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.marca,
    backgroundColor: '#fff5f5',
  },
  parcela: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
  },
});
