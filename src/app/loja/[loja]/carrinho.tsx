// Carrinho da loja (Figital): "finalizar no caixa" gera o comprovante com QR e o caixa fatura pelo fluxo normal do
// Sankhya; "concluir pelo app" leva os itens para o checkout (entrega ou retirada). Desconto de autoatendimento só
// sem vendedor vinculado: o Happy diz o % de cada item em cada forma de pagamento, e o cliente escolhe como vai pagar no
// caixa (pagar em mais parcelas cancela o pedido). Nesta versão de demonstração o pedido é simulado; com o backend,
// POST /figital/pedidos.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Botao } from '@/componentes/botao';
import { CabecalhoLoja } from '@/componentes/cabecalho-loja';
import { Campo } from '@/componentes/campo';
import { Aviso, Carregando } from '@/componentes/estado-tela';
import { ItemCarrinho } from '@/componentes/item-carrinho';
import { Resumo } from '@/componentes/resumo';
import { Texto } from '@/componentes/texto';
import { totais, useCarrinho } from '@/estado/carrinho';
import { useFigital } from '@/estado/figital';
import { api } from '@/lib/api';
import { arredondar, formatarHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
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

type Comprovante = { numero: string; expiraEm: string; total: number; itens: { nome: string; quantidade: number }[] };

export default function CarrinhoLoja() {
  const { loja: slug } = useLocalSearchParams<{ loja: string }>();
  const { lojas } = useFigital();
  const { itens, esvaziar, adicionar } = useCarrinho();
  const [nome, setNome] = useState('');
  const [cpf, setCpf] = useState('');
  const [comprovante, setComprovante] = useState<Comprovante>();
  const [pagamento, setPagamento] = useState<PagamentoFigital>('pix');
  const loja = lojas.find((l) => l.slug === slug);
  const lista = loja ? itens(loja.slug) : [];
  const codprods = lista.map((i) => i.codprod).sort();
  const { dados: descontos } = useDados(
    () => (slug && codprods.length ? api.descontos(slug, codprods) : Promise.resolve({ itens: [] })),
    [slug, codprods.join(',')],
  );
  if (!loja) return <Carregando />;
  const tabela = descontos?.itens ?? [];
  const { subtotal } = totais(lista);
  const desconto = arredondar(descontoEm(lista, tabela, pagamento));
  const total = arredondar(subtotal - desconto);

  if (comprovante)
    return (
      <ScrollView contentContainerStyle={estilos.conteudo}>
        <CabecalhoLoja loja={loja} titulo="Comprovante" />
        <View style={[estilos.caixa, { alignItems: 'center' }]}>
          <Texto cor={cores.textoSuave}>Mostre no caixa da loja {loja.nome}</Texto>
          <Texto variante="titulo">Nº {comprovante.numero}</Texto>
          <View style={{ padding: 12, backgroundColor: '#fff', borderRadius: raio.m }}>
            <QRCode value={comprovante.numero} size={200} color={cores.texto} />
          </View>
          <Texto variante="forte">{formatarPreco(comprovante.total)}</Texto>
          <Texto variante="pequeno" cor={cores.textoSuave} style={{ textAlign: 'center' }}>
            Produtos reservados até {formatarHora(comprovante.expiraEm)}. Depois disso a reserva cai sozinha.
          </Texto>
          {comprovante.itens.map((i) => (
            <Texto key={i.nome} variante="pequeno">
              {i.quantidade} × {nomeLegivel(i.nome)}
            </Texto>
          ))}
        </View>
        <Botao titulo="Continuar comprando" variante="contorno" onPress={() => router.replace(rotaLoja(loja.slug) as never)} />
      </ScrollView>
    );

  if (!lista.length)
    return (
      <>
        <CabecalhoLoja loja={loja} titulo="Carrinho da loja" />
        <Aviso titulo="Carrinho da loja vazio" texto="Leia o QR das etiquetas para pôr produtos aqui." acao="Ler etiqueta" aoTocar={() => router.push('/leitor')} />
      </>
    );

  const pronto = nome.trim().length > 2 && cpf.replace(/\D/g, '').length === 11;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled">
      <CabecalhoLoja loja={loja} titulo="Carrinho da loja" />
      {lista.map((i) => (
        <ItemCarrinho key={i.codprod} item={i} destino={loja.slug} />
      ))}
      <View style={estilos.caixa}>
        <Resumo
          linhas={[
            ['Produtos', formatarPreco(subtotal)],
            ...(desconto > 0
              ? [[`Autoatendimento (${NOME_PAGAMENTO(pagamento)})`, `- ${formatarPreco(desconto)}`, cores.sucesso] as [string, string, string]]
              : []),
          ]}
          total={total}
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
          O desconto vale só nesta forma de pagamento: no caixa, pagar em mais parcelas cancela o pedido. Com menos parcelas
          pode.
        </Texto>
      </View>
      <View style={estilos.caixa}>
        <Texto variante="subtitulo">Finalizar no caixa</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Você recebe um comprovante com QR e paga no caixa. Os produtos ficam reservados por {loja.horasReserva} horas.
        </Texto>
        <Campo rotulo="Nome completo" value={nome} onChangeText={setNome} autoComplete="name" />
        <Campo rotulo="CPF" value={cpf} onChangeText={(t) => setCpf(t.replace(/\D/g, '').slice(0, 11))} keyboardType="number-pad" />
        <Botao
          titulo="Gerar comprovante para o caixa"
          disabled={!pronto}
          onPress={() => {
            setComprovante({
              numero: `${loja.codigoEmpresa}${Date.now().toString().slice(-6)}`,
              expiraEm: new Date(Date.now() + loja.horasReserva * 3600_000).toISOString(),
              total,
              itens: lista.map((i) => ({ nome: i.nome, quantidade: i.quantidade })),
            });
            esvaziar(loja.slug);
          }}
        />
      </View>
      <Botao
        titulo="Concluir pelo app (entrega ou retirada)"
        variante="texto"
        onPress={() => {
          lista.forEach(({ quantidade, ...i }) => adicionar(i, 'site', quantidade));
          esvaziar(loja.slug);
          router.push('/checkout');
        }}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 12, paddingBottom: 48 },
  caixa: { backgroundColor: cores.superficie, borderRadius: raio.l, padding: 16, gap: 12, borderWidth: 1, borderColor: cores.borda },
  opcao: { paddingVertical: 10, paddingHorizontal: 14, borderRadius: raio.m, borderWidth: 1, borderColor: cores.borda, gap: 2 },
  opcaoAtiva: { borderColor: cores.marca, borderWidth: 2 },
});
