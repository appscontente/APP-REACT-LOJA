// Checkout do app em uma tela, nas etapas do site: seus dados, entrega ou retirada, pagamento e resumo. O servidor
// recalcula preço, estoque e frete antes de autorizar (CLAUDE.md: só o checkout consulta o Sankhya ao vivo).
// Pagamento como no site: cartão vai direto do app para o serviço de pagamento isolado, que devolve um token; o app
// nunca guarda número nem CVV. Nesta versão de demonstração nada é cobrado nem enviado: o pedido fica só no celular.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
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
import { cotarFrete, type CotacaoFrete } from '@/lib/api';
import { arredondar, calcularParcelas, formatarCep, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

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

function Opcao({ ativa, titulo, texto, icone, aoTocar }: { ativa: boolean; titulo: string; texto?: string; icone: React.ComponentProps<typeof Ionicons>['name']; aoTocar: () => void }) {
  return (
    <Pressable onPress={aoTocar} style={[estilos.opcao, ativa && estilos.opcaoAtiva]} accessibilityRole="radio" accessibilityState={{ checked: ativa }}>
      <Ionicons name={icone} size={22} color={ativa ? cores.marca : cores.textoSuave} />
      <View style={{ flex: 1 }}>
        <Texto variante="forte">{titulo}</Texto>
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
  const { itens, esvaziar } = useCarrinho();
  const conta = useConta();
  const { lojas } = useFigital();
  const lista = itens();
  const { subtotal, pix } = totais(lista);

  const [email, setEmail] = useState(conta.email ?? '');
  const [nome, setNome] = useState(conta.nome ?? '');
  const [cpf, setCpf] = useState('');
  const [cep, setCep] = useState(conta.cep ?? '');
  const [numero, setNumero] = useState('');
  const [entrega, setEntrega] = useState<'entrega' | 'retirada'>('entrega');
  const [loja, setLoja] = useState<string>();
  const [forma, setForma] = useState<'pix' | 'cartao'>('pix');
  const [parcelas, setParcelas] = useState(1);
  const [cartao, setCartao] = useState({ numero: '', nome: '', validade: '', cvv: '' });
  const [cotado, setCotado] = useState<{ chave: string; frete?: CotacaoFrete }>();
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

  if (!lista.length) return <Aviso titulo="Seu carrinho está vazio" acao="Voltar ao início" aoTocar={() => router.replace('/')} />;

  const valorFrete = entrega === 'retirada' ? 0 : frete?.atendido ? frete.cotacao.valor : undefined;
  const produtos = forma === 'pix' ? pix : subtotal;
  const total = arredondar(produtos + (valorFrete ?? 0));
  const maxParcelas = calcularParcelas(subtotal).quantidade;
  const cartaoOk =
    cartao.numero.replace(/\D/g, '').length >= 13 && cartao.nome.trim().length > 2 && /^\d{2}\/\d{2}$/.test(cartao.validade) && /^\d{3,4}$/.test(cartao.cvv);
  const pronto =
    EMAIL.test(email.trim()) &&
    nome.trim().length > 2 &&
    cpf.replace(/\D/g, '').length === 11 &&
    (entrega === 'retirada' ? Boolean(loja) : valorFrete !== undefined && numero.trim().length > 0) &&
    (forma === 'pix' || cartaoOk);

  const finalizar = () => {
    setEnviando(true);
    const numeroPedido = novoNumeroPedido();
    conta.registrarPedido({
      numero: numeroPedido,
      criadoEm: new Date().toISOString(),
      itens: lista,
      total,
      forma,
      entrega,
      loja,
      situacao: forma === 'pix' ? 'aguardando-pix' : 'em-analise',
    });
    if (!conta.logado) conta.entrar(email.trim().toLowerCase(), nome.trim());
    esvaziar();
    router.replace({ pathname: '/pedido-recebido', params: { numero: numeroPedido, forma } });
  };

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <Etapa numero={1} titulo="Seus dados">
        <Campo rotulo="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
        <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" />
      </Etapa>

      <Etapa numero={2} titulo="Entrega ou retirada">
        <Opcao ativa={entrega === 'entrega'} icone="car-outline" titulo="Receber em casa" texto="Entrega própria em Belém e região" aoTocar={() => setEntrega('entrega')} />
        <Opcao ativa={entrega === 'retirada'} icone="storefront-outline" titulo="Retirar na loja" texto="Grátis, quando o pedido estiver pronto" aoTocar={() => setEntrega('retirada')} />
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
          lojas.map((l) => (
            <Opcao key={l.slug} ativa={loja === l.slug} icone="location-outline" titulo={`Loja ${l.nome}`} texto={l.endereco} aoTocar={() => setLoja(l.slug)} />
          ))
        )}
      </Etapa>

      <Etapa numero={3} titulo="Pagamento">
        <Opcao ativa={forma === 'pix'} icone="flash-outline" titulo="Pix" texto={`${formatarPreco(pix)} à vista, com desconto`} aoTocar={() => setForma('pix')} />
        <Opcao ativa={forma === 'cartao'} icone="card-outline" titulo="Cartão de crédito" texto={`Até ${maxParcelas}x sem juros`} aoTocar={() => setForma('cartao')} />
        {forma === 'cartao' && (
          <View style={{ gap: 12 }}>
            <Campo rotulo="Número do cartão" value={cartao.numero} onChangeText={(t) => setCartao((c) => ({ ...c, numero: t.replace(/[^\d ]/g, '').slice(0, 23) }))} keyboardType="number-pad" autoComplete="cc-number" />
            <Campo rotulo="Nome impresso" value={cartao.nome} onChangeText={(t) => setCartao((c) => ({ ...c, nome: t.toUpperCase() }))} autoComplete="cc-name" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Campo
                rotulo="Validade"
                placeholder="MM/AA"
                value={cartao.validade}
                onChangeText={(t) => {
                  const d = t.replace(/\D/g, '').slice(0, 4);
                  setCartao((c) => ({ ...c, validade: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                }}
                keyboardType="number-pad"
              />
              <Campo rotulo="CVV" value={cartao.cvv} onChangeText={(t) => setCartao((c) => ({ ...c, cvv: t.replace(/\D/g, '').slice(0, 4) }))} keyboardType="number-pad" secureTextEntry />
            </View>
            <View style={estilos.parcelas}>
              {Array.from({ length: maxParcelas }, (_, i) => i + 1).map((n) => (
                <Pressable key={n} onPress={() => setParcelas(n)} style={[estilos.parcela, parcelas === n && estilos.opcaoAtiva]}>
                  <Texto variante="rotulo">
                    {n}x {formatarPreco(arredondar(subtotal / n))}
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
            ...(forma === 'pix' ? [['Desconto no Pix', `- ${formatarPreco(arredondar(subtotal - pix))}`, cores.sucesso] as [string, string, string]] : []),
            ['Frete', valorFrete === undefined ? 'informe o CEP' : valorFrete === 0 ? 'grátis' : formatarPreco(valorFrete)],
          ]}
          total={total}
        />
        <Botao titulo={forma === 'pix' ? 'Gerar Pix' : 'Pagar com cartão'} disabled={!pronto} carregando={enviando} onPress={finalizar} />
        <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
          Demonstração: nenhum valor é cobrado. Na versão final o pagamento passa pela e.Rede e pela análise da ClearSale.
        </Texto>
      </Etapa>
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 16, paddingBottom: 48 },
  etapa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  cabecalhoEtapa: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numero: { width: 26, height: 26, borderRadius: 13, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: raio.m, borderWidth: 1.5, borderColor: cores.borda },
  opcaoAtiva: { borderColor: cores.marca, backgroundColor: '#fff5f5' },
  parcelas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  parcela: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: raio.m, borderWidth: 1.5, borderColor: cores.borda },
});
