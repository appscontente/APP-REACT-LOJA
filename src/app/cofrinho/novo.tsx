// Abrir um Cofrinho Contente para um produto (?slug=). Regulamento v4: antes do primeiro pagamento, o pedido completo
// (frete pelo CEP, montagem, prazos, endereço, volume e a proteção do preço), que vale até a entrega; uma caixa só de aceite
// (pedido, regulamento e declarações do termo de adesão) e, à parte e já marcada (o cliente pode desmarcar), a opção de ofertas; as condições do bônus; uma cópia do
// regulamento e do pedido para guardar; e o primeiro pagamento, em até 24 horas. O preço e o frete vêm do site; com o
// backend, o servidor calcula de novo e grava o aceite (versão, hash, pedido exibido, data, IP e aparelho).

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { EscolhaLembrete } from '@/componentes/cofrinho';
import { DepositoCofrinho } from '@/componentes/deposito-cofrinho';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { useCofrinho, type Lembrete, type PedidoCofrinho } from '@/estado/cofrinho';
import { useConta } from '@/estado/conta';
import { api, ErroApi } from '@/lib/api';
import { DIAS_SEMANA, formatarData, primeiroPagamentoAte, protegidoAte } from '@/lib/cofrinho';
import { arredondar, formatarCep, formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { PedidoSimulado, SimulacaoCofrinho, TermosCofrinho } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function NovoCofrinho() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { logado, cep: cepConta, definirCep } = useConta();
  const { ativos, abrir } = useCofrinho();
  const [agora] = useState(() => Date.now());
  const [cep, setCep] = useState(cepConta ?? '');
  const [numero, setNumero] = useState('');
  const [complemento, setComplemento] = useState('');
  const [pedido, setPedido] = useState<PedidoSimulado>();
  const [cotando, setCotando] = useState(false);
  const [erroCep, setErroCep] = useState<string>();
  const [aceitou, setAceitou] = useState(false);
  // Já vem marcada (usuário, 09/11/2026); o cliente pode desmarcar.
  const [ofertas, setOfertas] = useState(true);
  const [querLembrete, setQuerLembrete] = useState(false);
  const [lembrete, setLembrete] = useState<Lembrete>();
  const { dados, erro, carregando, recarregar } = useDados(() => Promise.all([api.regrasCofrinho(), api.termosCofrinho(), api.simularCofrinho({ slug: slug ?? '' })]), [slug]);

  if (!slug) return <Aviso titulo="Escolha um produto" texto="Abra o produto que você quer e toque em Guardar no Cofrinho Contente." acao="Buscar produtos" aoTocar={() => router.replace('/busca')} />;
  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const [{ regras, termos: versao, abertura }, termos, sim] = dados;
  const nome = nomeLegivel(sim.produto.nome);

  if (!abertura.ligada)
    return (
      <Aviso
        titulo="O Cofrinho Contente abre em breve"
        texto={abertura.mensagem ?? 'Os cofrinhos já abertos seguem normalmente.'}
        acao="Ver meus cofrinhos"
        aoTocar={() => router.replace('/cofrinho')}
      />
    );
  if (!sim.elegivel.pode) return <Aviso titulo="Este produto não entra no cofrinho" texto={sim.elegivel.motivo} acao="Escolher outro produto" aoTocar={() => router.replace('/busca')} triste />;
  if (ativos.length >= regras.maxAbertos)
    return (
      <Aviso
        titulo={`Você já tem ${regras.maxAbertos} cofrinhos ativos`}
        texto="Conclua um deles ou troque o produto de um cofrinho ativo para guardar este."
        acao="Ver meus cofrinhos"
        aoTocar={() => router.replace('/cofrinho')}
      />
    );
  if (!logado) return <Aviso titulo="Entre na sua conta" texto="O cofrinho fica na sua conta, com o CPF de quem vai receber a nota." acao="Entrar" aoTocar={() => router.push('/conta')} />;

  const cotar = async () => {
    const limpo = cep.replace(/\D/g, '');
    if (limpo.length !== 8) return setErroCep('Digite os 8 números do CEP.');
    setCotando(true);
    setErroCep(undefined);
    try {
      const s = await api.simularCofrinho({ slug, cep: limpo });
      setPedido(s.pedido);
      definirCep(limpo);
    } catch (e) {
      setPedido(undefined);
      setErroCep(e instanceof ErroApi ? e.message : 'Não conseguimos calcular o frete agora. Tente de novo.');
    } finally {
      setCotando(false);
    }
  };

  const total = pedido ? arredondar(sim.precoGarantido + pedido.frete.valor + pedido.montagem.valor) : sim.precoGarantido;
  const prazoPrimeiro = primeiroPagamentoAte(new Date(agora).toISOString(), regras);
  const protecaoSePagarHoje = protegidoAte(new Date(agora).toISOString(), regras);
  const endereco = pedido?.endereco
    ? [pedido.endereco.logradouro, numero.trim(), complemento.trim(), pedido.endereco.bairro, `${pedido.endereco.cidade}/${pedido.endereco.uf}`].filter(Boolean).join(', ')
    : '';
  const falta = !pedido
    ? 'Calcule o frete pelo CEP para ver o pedido completo.'
    : !numero.trim()
      ? 'Digite o número do endereço de entrega.'
      : !aceitou
        ? 'Marque o aceite do regulamento para abrir o cofrinho.'
        : undefined;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={estilos.produto}>
        <Imagem uri={sim.produto.imagem} style={estilos.foto} contentFit="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <Texto variante="forte" numberOfLines={3}>
            {nome}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Código {sim.produto.codprod}
          </Texto>
        </View>
      </View>

      <View style={estilos.destaque}>
        <Texto variante="rotulo">Preço à vista garantido</Texto>
        <Texto variante="titulo">{formatarPreco(sim.precoGarantido)}</Texto>
        <Texto variante="pequeno">O seu preço não sobe mais. Se o produto entrar em promoção, o cofrinho baixa junto e fica com o preço menor.</Texto>
      </View>

      <View style={{ gap: 10 }}>
        <Texto variante="subtitulo">Entrega</Texto>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
          <View style={{ flex: 1 }}>
            <Campo
              rotulo="CEP"
              value={formatarCep(cep)}
              onChangeText={(t) => setCep(t.replace(/\D/g, '').slice(0, 8))}
              keyboardType="number-pad"
              placeholder="00000-000"
              erro={erroCep}
              onSubmitEditing={cotar}
            />
          </View>
          <Botao titulo="Calcular" variante="contorno" carregando={cotando} onPress={cotar} />
        </View>
        {pedido?.endereco ? (
          <>
            <Texto cor={cores.textoSuave}>{[pedido.endereco.logradouro, pedido.endereco.bairro, `${pedido.endereco.cidade}/${pedido.endereco.uf}`].filter(Boolean).join(', ')}</Texto>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flex: 1 }}>
                <Campo rotulo="Número" value={numero} onChangeText={setNumero} keyboardType="default" />
              </View>
              <View style={{ flex: 2 }}>
                <Campo rotulo="Complemento (opcional)" value={complemento} onChangeText={setComplemento} />
              </View>
            </View>
          </>
        ) : null}
      </View>

      {pedido ? (
        <ResumoPedido
          sim={sim}
          pedido={pedido}
          total={total}
          endereco={endereco}
          protegido={protecaoSePagarHoje}
          prazoPrimeiro={prazoPrimeiro}
          prazoDias={regras.prazoDias}
          compensacao={regras.compensacao}
        />
      ) : null}

      <View style={estilos.regras}>
        <Linha
          icone="calendar-outline"
          texto={`Primeiro pagamento em até ${regras.primeiroPagamentoHoras} horas, de pelo menos ${formatarPreco(sim.entradaMinima)}. Depois, você guarda quanto e quando quiser, sem parcela e sem cobrança.`}
        />
        <Linha icone="arrow-undo-outline" texto={`Desistiu? Até ${regras.arrependimentoDiasAposEntrega} dias depois de receber o produto, devolvemos tudo, inclusive o frete.`} />
        <Linha icone="swap-horizontal" texto="Pode trocar de produto, até por um mais barato: você escolhe o destino do que sobrar." />
        <Linha icone="cube-outline" texto={`Se o produto faltar, você escolhe: esperar, um equivalente, o dinheiro de volta ou crédito com ${regras.bonusCreditoPercentual}% de bônus.`} />
        <Linha icone="pricetag-outline" texto="Não é poupança nem investimento: não rende juros. Sem cupom e sem cashback." />
      </View>

      <View style={{ gap: 8 }}>
        <Pressable onPress={() => setQuerLembrete((q) => !q)} style={estilos.opcao} accessibilityRole="checkbox" accessibilityState={{ checked: querLembrete }}>
          <Ionicons name={querLembrete ? 'checkbox' : 'square-outline'} size={24} color={querLembrete ? cores.marca : cores.textoSuave} />
          <Texto style={{ flex: 1 }}>Quero um lembrete semanal (opcional)</Texto>
        </Pressable>
        {querLembrete ? (
          <>
            <EscolhaLembrete inicial={lembrete} aoSalvar={setLembrete} />
            <Texto variante="pequeno" cor={cores.textoSuave}>
              {lembrete ? `Toda ${DIAS_SEMANA[lembrete.diaSemana]}, às 9h, o app lembra você de guardar um pouco. ` : 'Escolha o dia. '}É só um lembrete: não gera Pix nem cobrança, e você muda ou
              desliga quando quiser.
            </Texto>
          </>
        ) : null}
      </View>

      <View style={estilos.bonus}>
        <Texto variante="forte">Condições do bônus de {regras.bonusCreditoPercentual}%</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {termos.condicoesBonus.texto}
        </Texto>
      </View>

      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo">Termo de adesão</Texto>
        <View style={{ flexDirection: 'row', gap: 16, flexWrap: 'wrap' }}>
          <Botao titulo="Ler o regulamento" variante="texto" onPress={() => router.push('/cofrinho/termos')} />
          <Botao titulo="Guardar uma cópia" variante="texto" onPress={() => Share.share({ title: termos.titulo, message: copia(termos, nome, sim.precoGarantido, pedido, endereco, total) })} />
        </View>
        <Declaracao
          texto={termos.aceite ?? 'Li e concordo com o pedido acima e com o Regulamento do Cofrinho Contente, incluindo as declarações do termo de adesão.'}
          marcada={aceitou}
          aoTocar={() => setAceitou((a) => !a)}
        />
        <View style={{ height: 4 }} />
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Opcional:
        </Texto>
        <Declaracao texto={termos.ofertas.texto} marcada={ofertas} aoTocar={() => setOfertas((o) => !o)} />
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Regulamento de {versao.atualizadoEm} · conferência {versao.hash.slice(0, 12)}
        </Texto>
      </View>

      <Texto variante="subtitulo">Primeiro pagamento</Texto>
      <DepositoCofrinho
        regras={regras}
        preco={sim.precoGarantido}
        falta={total}
        primeiro
        valorInicial={sim.entradaMinima}
        primeiroAte={prazoPrimeiro}
        titulo="Abrir cofrinho e guardar"
        bloqueado={falta}
        aoPagar={(pagamento) => {
          if (!pedido) return;
          const dadosPedido: PedidoCofrinho = {
            cep: pedido.cep,
            endereco,
            frete: pedido.frete.valor,
            montagem: pedido.montagem,
            prazoEntrega: pedido.prazoEntrega,
            ...(sim.volumeM3 && { volumeM3: sim.volumeM3 }),
          };
          const id = abrir({
            item: { codprod: sim.produto.codprod, slug: sim.produto.slug, nome: sim.produto.nome, imagem: sim.produto.imagem },
            preco: sim.precoGarantido,
            primeiroPagamentoAte: prazoPrimeiro,
            pedido: dadosPedido,
            ...(querLembrete && lembrete && { lembrete }),
            aceite: { versao: termos.versao, hash: termos.hash, em: new Date().toISOString(), aceitou: true, ofertas, hashCondicoesBonus: termos.condicoesBonus.hash },
            pagamento,
          });
          router.replace({ pathname: '/cofrinho/[id]', params: { id, novo: '1', ...(pagamento.forma === 'loja' && { caixa: '1' }) } });
        }}
      />
    </ScrollView>
  );
}

function ResumoPedido({
  sim,
  pedido,
  total,
  endereco,
  protegido,
  prazoPrimeiro,
  prazoDias,
  compensacao,
}: {
  compensacao?: { percentual: number };
  sim: SimulacaoCofrinho;
  pedido: PedidoSimulado;
  total: number;
  endereco: string;
  protegido: string;
  prazoPrimeiro: string;
  prazoDias: number;
}) {
  return (
    <View style={estilos.resumo} accessibilityLabel="Pedido do cofrinho">
      <Texto variante="subtitulo">Seu pedido</Texto>
      <Item rotulo="Canal" valor="Aplicativo" />
      <Item rotulo="Quantidade" valor="1" />
      <Item rotulo="Produto" valor={formatarPreco(sim.precoGarantido)} />
      <Item rotulo="Frete" valor={pedido.frete.valor > 0 ? formatarPreco(pedido.frete.valor) : 'Grátis'} />
      <Item rotulo="Montagem" valor={pedido.montagem.valor > 0 ? formatarPreco(pedido.montagem.valor) : pedido.montagem.texto} />
      <View style={estilos.total}>
        <Texto variante="forte" style={{ flex: 1 }}>
          Total a juntar
        </Texto>
        <Texto variante="forte">{formatarPreco(total)}</Texto>
      </View>
      <Item rotulo="Entrega" valor={pedido.prazoEntrega} />
      {pedido.montagem.prazo ? <Item rotulo="Prazo de montagem" valor={pedido.montagem.prazo} /> : null}
      <Item rotulo="Endereço" valor={endereco || 'Digite o número'} />
      {sim.volumeM3 ? <Item rotulo="Volume embalado" valor={`${sim.volumeM3.toLocaleString('pt-BR')} m³`} /> : null}
      <Item rotulo="Disponibilidade" valor="Sem separação de estoque" />
      <Item rotulo="Primeiro pagamento até" valor={formatarDataHora(prazoPrimeiro)} />
      <Item rotulo="Proteção do preço" valor={`${prazoDias} dias do primeiro pagamento (até ${formatarData(protegido)}, se pagar hoje)`} />
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Estes valores e prazos valem até a entrega: não mudam depois.
        {compensacao
          ? ` Se você desistir depois de quitar e antes da entrega, fica uma compensação de ${compensacao.percentual}% do valor pago (seção 10); no arrependimento e na falta do produto, a devolução é integral.`
          : ''}
      </Texto>
    </View>
  );
}

/** Texto da cópia que o cliente guarda: o pedido aceito e o regulamento inteiro. */
function copia(t: TermosCofrinho, nome: string, preco: number, pedido: PedidoSimulado | undefined, endereco: string, total: number) {
  const linhas = [
    `Cofrinho Contente: ${nome}`,
    `Preço garantido: ${formatarPreco(preco)}`,
    ...(pedido
      ? [
          `Frete: ${pedido.frete.valor > 0 ? formatarPreco(pedido.frete.valor) : 'grátis'}`,
          `Montagem: ${pedido.montagem.texto}`,
          `Total a juntar: ${formatarPreco(total)}`,
          `Entrega: ${pedido.prazoEntrega}`,
          `Endereço: ${endereco}`,
        ]
      : []),
    '',
    `${t.titulo} (versão de ${t.atualizadoEm}, conferência ${t.hash.slice(0, 12)})`,
    ...t.secoes.flatMap((s) => ['', s.titulo, ...s.paragrafos]),
    '',
    'Termo de adesão',
    ...t.declaracoes.map((d, i) => `${i + 1}. ${d.texto}`),
    ...(t.aceite ? ['', t.aceite] : []),
  ];
  return linhas.join('\n');
}

function Item({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <Texto variante="pequeno" cor={cores.textoSuave} style={{ width: 120 }}>
        {rotulo}
      </Texto>
      <Texto variante="pequeno" style={{ flex: 1, textAlign: 'right' }}>
        {valor}
      </Texto>
    </View>
  );
}

function Declaracao({ texto, marcada, aoTocar }: { texto: string; marcada: boolean; aoTocar: () => void }) {
  return (
    <Pressable onPress={aoTocar} style={[estilos.opcao, marcada && { borderColor: cores.marca }]} accessibilityRole="checkbox" accessibilityState={{ checked: marcada }}>
      <Ionicons name={marcada ? 'checkbox' : 'square-outline'} size={24} color={marcada ? cores.marca : cores.textoSuave} />
      <Texto style={{ flex: 1 }}>{texto}</Texto>
    </Pressable>
  );
}

function Linha({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name={icone} size={18} color={cores.textoSuave} />
      <Texto variante="pequeno" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 16, paddingBottom: 140 },
  produto: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 84, height: 84, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  destaque: { gap: 2, padding: 16, borderRadius: raio.l, backgroundColor: cores.sorriso },
  resumo: { gap: 8, padding: 16, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  total: { flexDirection: 'row', paddingVertical: 8, borderTopWidth: StyleSheet.hairlineWidth, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: cores.borda },
  regras: { gap: 10, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
  bonus: { gap: 4, padding: 14, borderRadius: raio.l, backgroundColor: cores.creme },
  opcao: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 12, borderRadius: raio.l, borderWidth: 1.5, borderColor: cores.borda, backgroundColor: cores.superficie },
});
