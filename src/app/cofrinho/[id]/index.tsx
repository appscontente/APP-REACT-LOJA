// Um Cofrinho Contente (regulamento v4): quanto já foi guardado, o pedido contratado, o prazo do primeiro pagamento, o
// aviso de preço que subiu (o preço do cofrinho não sobe; a promoção baixa e fica), o lembrete opcional, o extrato e as
// ações: guardar, trocar o produto, escolher o que fazer se o produto faltar, desistir (da abertura até 7 dias depois
// do recebimento, com protocolo) e concluir quando completar.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Botao } from '@/componentes/botao';
import { EscolhaLembrete, Progresso, SituacaoCofrinho } from '@/componentes/cofrinho';
import { Campo } from '@/componentes/campo';
import { Copiar } from '@/componentes/copiar';
import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { ativo, contas, expirado, pixVencido, temPagamento, useCofrinho, type Cofrinho, type LinhaExtrato } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { creditoComBonus, dentroDoArrependimento, descontoDoCofrinho, diasAte, DIAS_SEMANA, entradaMinima, formatarData, lerReais, protegidoAte } from '@/lib/cofrinho';
import { arredondar, formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import type { RegrasCofrinho } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

const NOME_TIPO: Record<LinhaExtrato['tipo'], string> = {
  pagamento: 'Pagamento',
  reducao: 'Redução de preço',
  troca: 'Troca',
  transferencia: 'Transferência',
  devolucao: 'Devolução',
  credito: 'Crédito',
  bonus: 'Bônus',
};

type Confirmacao = 'desistir' | 'devolucao' | 'credito' | 'concluir';

export default function TelaCofrinho() {
  const { id, novo, caixa } = useLocalSearchParams<{ id: string; novo?: string; caixa?: string }>();
  const cofrinho = useCofrinho();
  const { buscar, pronto, informarPreco } = cofrinho;
  const { dados } = useDados(() => Promise.all([api.regrasCofrinho(), api.termosCofrinho()]), []);
  const c = buscar(id);
  const vivo = c ? ativo(c) : false;
  // Preço à vista de hoje e estoque (com o backend, o Happy recebe o preço pelo informar_preco e avisa).
  const { dados: hoje } = useDados(() => (c && vivo ? api.simularCofrinho({ slug: c.item.slug }) : Promise.resolve(undefined)), [c?.item.slug, vivo]);
  useEffect(() => {
    if (c && hoje) informarPreco(c.id, hoje.precoGarantido);
  }, [c, hoje, informarPreco]);

  if (!pronto) return null;
  if (!c) return <Aviso titulo="Cofrinho não encontrado" texto="Ele pode ter saído deste celular ao sair da conta." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} triste />;
  const regras = dados?.[0].regras;
  const condicoesBonus = dados?.[1].condicoesBonus.texto;

  if (expirado(c))
    return (
      <Aviso
        titulo="Este cofrinho expirou"
        texto={`O primeiro pagamento não chegou até ${formatarDataHora(c.primeiroPagamentoAte)}, então o cofrinho foi encerrado, sem dívida nem cobrança. Se quiser, abra de novo.`}
        acao="Abrir de novo"
        aoTocar={() => router.replace({ pathname: '/cofrinho/novo', params: { slug: c.item.slug } })}
        secundaria={{ titulo: 'Ver meus cofrinhos', aoTocar: () => router.replace('/cofrinho') }}
      />
    );
  return (
    <Detalhe c={c} regras={regras} condicoesBonus={condicoesBonus} avistaHoje={hoje?.precoGarantido} esgotado={hoje ? !(hoje.produto.estoque > 0) : false} novo={Boolean(novo)} caixa={caixa === '1'} />
  );
}

function Detalhe({
  c,
  regras,
  condicoesBonus,
  avistaHoje,
  esgotado,
  novo,
  caixa,
}: {
  c: Cofrinho;
  regras?: RegrasCofrinho['regras'];
  condicoesBonus?: string;
  avistaHoje?: number;
  esgotado: boolean;
  novo: boolean;
  caixa: boolean;
}) {
  const acoes = useCofrinho();
  const [confirmando, setConfirmando] = useState<Confirmacao>();
  const [mudandoLembrete, setMudandoLembrete] = useState(false);
  const [agora] = useState(() => Date.now());
  const conta = contas(c);
  const vivo = ativo(c, agora);
  const emFalta = vivo && (c.situacao === 'em_falta' || esgotado);
  const pago = temPagamento(c);
  const pixPendente = c.extrato.filter((l) => l.situacao === 'aguardando-pix' && !pixVencido(l, agora));
  const podeDesistir = regras && ['aberto', 'em_falta', 'concluido'].includes(c.situacao) && dentroDoArrependimento(c.recebidoEm, regras, agora);
  const subiu = vivo && avistaHoje !== undefined && avistaHoje > c.preco && c.protegidoAte && diasAte(c.protegidoAte, agora) > 0;
  const desconto = avistaHoje !== undefined ? descontoDoCofrinho(c.preco, avistaHoje) : 0;
  const protecao = regras ? protegidoAte(new Date(agora).toISOString(), regras) : undefined;
  const minimo = Math.min(conta.falta, pago ? (regras?.depositoMinimo ?? 20) : regras ? entradaMinima(c.preco, regras) : 20);
  const credito = regras ? creditoComBonus(conta.saldo, regras) : undefined;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <Stack.Screen options={{ title: c.id }} />
      {novo && vivo && !pago ? (
        <View style={estilos.sucesso}>
          <Ionicons name="checkmark-circle" size={22} color={cores.sucesso} />
          <Texto cor={cores.sucesso} style={{ flex: 1 }}>
            Cofrinho aberto! Faça o primeiro pagamento até {formatarDataHora(c.primeiroPagamentoAte)}. Depois dele, nada vence.
          </Texto>
        </View>
      ) : null}
      {c.protocolo ? (
        <View style={estilos.protocolo}>
          <Texto variante="forte">Protocolo {c.protocolo}</Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {c.situacao === 'credito'
              ? 'O crédito já está na sua conta e o bônus no seu cashback.'
              : `Devolvemos pelo mesmo meio de cada pagamento: o Pix pela própria transação e o caixa pela forma usada na loja${c.situacao === 'desistido' ? ', na hora' : `, em até ${regras?.prazoDevolucaoDiasUteis ?? 5} dias úteis`}. A atualização do valor vem à parte, pelo nosso financeiro.`}
          </Texto>
        </View>
      ) : null}

      <View style={estilos.produto}>
        <Imagem uri={c.item.imagem} style={estilos.foto} contentFit="contain" />
        <View style={{ flex: 1, gap: 2 }}>
          <Texto variante="forte" numberOfLines={3}>
            {nomeLegivel(c.item.nome)}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Seu preço {formatarPreco(c.preco)}
            {desconto > 0 ? ` · hoje ${formatarPreco(avistaHoje!)}, desconto do cofrinho de ${formatarPreco(desconto)}` : ''}
          </Texto>
        </View>
      </View>

      <View style={estilos.saldo}>
        <Texto variante="rotulo">Guardado</Texto>
        <Texto variante="titulo">{formatarPreco(conta.saldo)}</Texto>
        <Progresso percentual={conta.percentual} />
        <Texto variante="pequeno">
          de {formatarPreco(conta.alvo)} (produto, frete e montagem)
          {vivo ? (conta.falta > 0 ? ` · faltam ${formatarPreco(conta.falta)}` : ' · completo!') : ''}
        </Texto>
        <SituacaoCofrinho cofrinho={c} />
      </View>

      {subiu ? (
        <View style={estilos.subiu}>
          <Ionicons name="trending-up" size={22} color={cores.sucesso} />
          <View style={{ flex: 1, gap: 2 }}>
            <Texto variante="forte">O preço do produto subiu, o seu não</Texto>
            <Texto variante="pequeno">
              Hoje ele custa {formatarPreco(avistaHoje!)} à vista. O seu continua {formatarPreco(c.preco)}: você economiza {formatarPreco(desconto)}.
              {conta.falta > 0 ? ` Faltam ${formatarPreco(conta.falta)} para completar.` : ''} Avisamos cada alta por mais {diasAte(c.protegidoAte!, agora)} dias.
            </Texto>
          </View>
        </View>
      ) : null}

      {c.excedente ? (
        <View style={estilos.alerta}>
          <Texto variante="forte">Sobrou {formatarPreco(c.excedente)} da troca</Texto>
          <Texto variante="pequeno">Escolha o destino: outro cofrinho seu, de volta para você ou guardado como crédito. Nada sai sem a sua escolha.</Texto>
          <Botao titulo="Escolher o destino" onPress={() => router.push({ pathname: '/cofrinho/[id]/sobra', params: { id: c.id } })} />
        </View>
      ) : null}

      {emFalta && regras ? (
        <FaltaProduto
          c={c}
          regras={regras}
          aoEscolher={(o) =>
            o === 'equivalente' ? router.push({ pathname: '/cofrinho/[id]/trocar', params: { id: c.id, motivo: 'falha' } }) : setConfirmando(o === 'devolucao' ? 'devolucao' : 'credito')
          }
        />
      ) : null}

      {pixPendente.map((d) => (
        <PixPendente key={d.id} linha={d} cofrinho={c.id} aoConfirmar={() => acoes.confirmarPagamento(c.id, d.id, protecao)} />
      ))}
      {vivo && conta.falta > 0 ? (
        <CodigoCaixa
          key={caixa ? 'aberto' : 'fechado'}
          cofrinho={c.id}
          aberto={caixa || (!pago && pixPendente.length === 0)}
          minimo={minimo}
          falta={arredondar(conta.falta - conta.pendente)}
          aoReceber={(v) => acoes.registrarCaixa(c.id, v, protecao)}
        />
      ) : null}

      {confirmando ? (
        <Confirmar
          tipo={confirmando}
          c={c}
          saldo={conta.saldo}
          credito={credito}
          condicoesBonus={condicoesBonus}
          aoCancelar={() => setConfirmando(undefined)}
          aoConfirmar={() => {
            setConfirmando(undefined);
            if (confirmando === 'concluir') acoes.concluir(c.id);
            else if (confirmando === 'credito' && credito) acoes.converterCredito(c.id, credito.principal, credito.bonus);
            else acoes.desistir(c.id, confirmando === 'desistir' ? 'arrependimento' : 'falha_fornecimento');
          }}
        />
      ) : null}

      {vivo ? (
        <View style={{ gap: 10 }}>
          {conta.falta > 0 ? (
            <Botao titulo="Guardar" onPress={() => router.push({ pathname: '/cofrinho/[id]/depositar', params: { id: c.id } })} />
          ) : emFalta ? null : (
            <Botao titulo="Concluir e receber o produto" onPress={() => setConfirmando('concluir')} />
          )}
          <Botao titulo="Trocar produto" variante="contorno" onPress={() => router.push({ pathname: '/cofrinho/[id]/trocar', params: { id: c.id } })} />
        </View>
      ) : null}
      {c.situacao === 'concluido' && !c.recebidoEm ? <Botao titulo="Marcar como recebido (demonstração)" variante="texto" onPress={() => acoes.marcarRecebido(c.id)} /> : null}

      {vivo ? (
        <View style={estilos.cartao}>
          <Texto variante="forte">Lembrete (opcional)</Texto>
          {c.lembrete && !mudandoLembrete ? (
            <>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Toda {DIAS_SEMANA[c.lembrete.diaSemana]}, às 9h{c.lembrete.valorSugerido ? `, com a sugestão de ${formatarPreco(c.lembrete.valorSugerido)}` : ''}. É só um lembrete: não gera Pix nem
                cobrança.
              </Texto>
              <View style={{ flexDirection: 'row', gap: 16 }}>
                <Botao titulo="Mudar" variante="texto" onPress={() => setMudandoLembrete(true)} />
                <Botao titulo="Desligar" variante="texto" onPress={() => acoes.mudarLembrete(c.id, undefined)} />
              </View>
            </>
          ) : (
            <>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Escolha um dia da semana e, se quiser, um valor sugerido. Você guarda o que couber, quando quiser.
              </Texto>
              <EscolhaLembrete
                inicial={c.lembrete}
                comValor
                aoSalvar={(l) => {
                  acoes.mudarLembrete(c.id, l);
                  setMudandoLembrete(false);
                }}
                aoDesligar={c.lembrete ? () => (acoes.mudarLembrete(c.id, undefined), setMudandoLembrete(false)) : undefined}
              />
            </>
          )}
        </View>
      ) : null}

      <View style={estilos.cartao}>
        <Texto variante="forte">Pedido contratado</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Frete {c.pedido.frete > 0 ? formatarPreco(c.pedido.frete) : 'grátis'} · {c.pedido.montagem.texto} · entrega {c.pedido.prazoEntrega}
          {c.pedido.volumeM3 ? ` · ${c.pedido.volumeM3.toLocaleString('pt-BR')} m³` : ''}
        </Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {c.pedido.endereco}
        </Texto>
      </View>

      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo">Extrato</Texto>
        {c.extrato.length === 0 ? <Texto cor={cores.textoSuave}>Nada ainda.</Texto> : null}
        {[...c.extrato].reverse().map((l) => (
          <View key={l.id} style={estilos.linha}>
            <View style={{ flex: 1, gap: 2 }}>
              <Texto>
                {NOME_TIPO[l.tipo]}
                {l.tipo === 'pagamento' ? ` · ${l.texto}` : ''}
              </Texto>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                {formatarDataHora(l.quando)}
                {l.tipo !== 'pagamento' ? ` · ${l.texto}` : ''}
                {l.protocolo ? ` · protocolo ${l.protocolo}` : ''}
              </Texto>
            </View>
            <Texto style={{ fontFamily: fontes.textoForte }} cor={l.situacao === 'aguardando-pix' ? cores.textoSuave : l.efeito < 0 ? cores.aviso : cores.texto}>
              {l.efeito < 0 ? '− ' : ''}
              {formatarPreco(l.valor)}
              {l.situacao === 'aguardando-pix' ? (pixVencido(l, agora) ? ' (vencido)' : ' (a pagar)') : ''}
            </Texto>
          </View>
        ))}
      </View>

      {podeDesistir ? <Botao titulo="Desistir do cofrinho" variante="texto" onPress={() => setConfirmando('desistir')} /> : null}
      {vivo && !emFalta ? <Botao titulo="Simular falta do produto (demonstração)" variante="texto" onPress={() => acoes.marcarFalta(c.id)} /> : null}

      <View style={estilos.regras}>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Aberto em {formatarDataHora(c.abertoEm)}, com o regulamento de {c.aceite.versao.split('-').reverse().join('/')} (conferência {c.aceite.hash.slice(0, 12)}). Sem parcela, multa ou cobrança.
          Itens do cofrinho não ganham nem usam cashback.
        </Texto>
        <Botao titulo="Regulamento" variante="texto" onPress={() => router.push('/cofrinho/termos')} />
      </View>
    </ScrollView>
  );
}

/** Produto em falta (regulamento, 7): esperar com data combinada, equivalente, devolução ou crédito com bônus. */
function FaltaProduto({ c, regras, aoEscolher }: { c: Cofrinho; regras: RegrasCofrinho['regras']; aoEscolher: (o: 'equivalente' | 'devolucao' | 'credito') => void }) {
  const { aguardarReposicao } = useCofrinho();
  const [esperar, setEsperar] = useState(false);
  const [agora] = useState(() => Date.now());
  return (
    <View style={estilos.alerta}>
      <Texto variante="forte">{c.aguardarAte ? `Esperando o produto até ${formatarData(c.aguardarAte)}` : 'O produto do seu cofrinho está em falta'}</Texto>
      <Texto variante="pequeno">Você escolhe o que prefere. Nada muda sem a sua escolha, e o que você guardou continua seu.</Texto>
      {regras.opcoesFalta.map((o) => (
        <Botao key={o.id} titulo={o.titulo} variante={o.id === 'aguardar' ? 'contorno' : 'texto'} onPress={() => (o.id === 'aguardar' ? setEsperar((e) => !e) : aoEscolher(o.id))} />
      ))}
      {esperar ? (
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {[15, 30, 45].map((dias) => {
            const ate = new Date(agora + dias * 86_400_000).toISOString();
            return (
              <Botao
                key={dias}
                titulo={`Até ${formatarData(ate)}`}
                variante="contorno"
                onPress={() => {
                  aguardarReposicao(c.id, ate);
                  setEsperar(false);
                }}
              />
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Confirmar({
  tipo,
  c,
  saldo,
  credito,
  condicoesBonus,
  aoCancelar,
  aoConfirmar,
}: {
  tipo: Confirmacao;
  c: Cofrinho;
  saldo: number;
  credito?: { principal: number; bonus: number };
  condicoesBonus?: string;
  aoCancelar: () => void;
  aoConfirmar: () => void;
}) {
  const textos: Record<Confirmacao, { titulo: string; texto: string; botao: string }> = {
    desistir: {
      titulo: 'Desistir do cofrinho?',
      texto: `Devolvemos tudo o que você pagou, ${formatarPreco(saldo)}, inclusive o frete, sem taxa nem desconto, pelo mesmo meio de cada pagamento. A atualização do valor vem à parte.${c.recebidoEm ? ' Combinamos a coleta do produto, sem custo.' : ''} Você recebe um protocolo na hora.`,
      botao: 'Desistir e receber de volta',
    },
    devolucao: {
      titulo: 'Receber o dinheiro de volta?',
      texto: `Devolvemos ${formatarPreco(saldo)}, atualizado, pelo mesmo meio de cada pagamento, e o cofrinho é encerrado.`,
      botao: 'Receber de volta',
    },
    credito: {
      titulo: 'Converter em crédito com bônus?',
      texto: credito
        ? `Você recebe ${formatarPreco(credito.principal)} de crédito na loja e mais ${formatarPreco(credito.bonus)} de bônus no seu cashback, separados no extrato. ${condicoesBonus ?? ''} Se preferir o dinheiro, escolha a devolução.`
        : '',
      botao: 'Converter em crédito',
    },
    concluir: {
      titulo: 'Concluir o cofrinho',
      texto: `O pedido sai pelo seu preço, ${formatarPreco(c.preco)}, com o frete e a montagem contratados, para ${c.pedido.endereco}. Nesta demonstração, o cofrinho só fica marcado como concluído.`,
      botao: 'Concluir',
    },
  };
  const t = textos[tipo];
  return (
    <View style={estilos.confirmar} accessibilityRole="alert">
      <Texto variante="forte">{t.titulo}</Texto>
      <Texto variante="pequeno">{t.texto}</Texto>
      <Botao titulo={t.botao} onPress={aoConfirmar} />
      <Botao titulo="Voltar" variante="texto" onPress={aoCancelar} />
    </View>
  );
}

/** Pix gerado e ainda não pago. Demonstração: o código é de exemplo e "Já paguei" faz o papel do banco. */
function PixPendente({ linha, cofrinho, aoConfirmar }: { linha: LinhaExtrato; cofrinho: string; aoConfirmar: () => void }) {
  const codigo = `00020126DEMONSTRACAO-COFRINHO-${cofrinho}-${linha.id}5204000053039865802BR`;
  return (
    <View style={estilos.pix}>
      <Texto variante="forte">Pix de {formatarPreco(linha.valor)}</Texto>
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Copie o código e pague no app do seu banco{linha.venceEm ? ` até ${formatarDataHora(linha.venceEm)}` : ''}. O valor entra no saldo assim que o banco confirmar. Se não pagar, ele só perde a
        validade.
      </Texto>
      <Texto variante="pequeno" selectable numberOfLines={2} style={estilos.codigo}>
        {codigo}
      </Texto>
      <Copiar texto={codigo} />
      <Botao titulo="Já paguei (demonstração)" variante="texto" onPress={aoConfirmar} />
    </View>
  );
}

/**
 * Pagar no caixa de uma loja: o cliente mostra o código do cofrinho (o próprio número, com QR) e diz quanto quer
 * guardar; o caixa digita o valor e recebe no Happy (contrato 39.2). O app não pede valor. Demonstração: o campo de
 * baixo faz o papel do caixa.
 */
function CodigoCaixa({ cofrinho, aberto: abertoInicial, minimo, falta, aoReceber }: { cofrinho: string; aberto: boolean; minimo: number; falta: number; aoReceber: (valor: number) => void }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [texto, setTexto] = useState('');
  const valor = lerReais(texto);
  const valido = Number.isFinite(valor) && valor >= minimo && valor <= falta;
  if (!aberto) return <Botao titulo="Pagar no caixa de uma loja" variante="contorno" onPress={() => setAberto(true)} />;
  return (
    <View style={estilos.pix}>
      <Texto variante="forte">Pagar no caixa de uma loja</Texto>
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Mostre este código no caixa de qualquer loja Casa Contente e diga quanto quer guardar (de {formatarPreco(minimo)} até {formatarPreco(falta)}). Você paga como a loja aceitar e o valor entra no
        saldo na hora.
      </Texto>
      <View style={estilos.qr}>
        <QRCode value={cofrinho} size={150} />
        <Texto variante="titulo" selectable style={{ letterSpacing: 2 }}>
          {cofrinho}
        </Texto>
      </View>
      <Campo rotulo="Valor pago no caixa (demonstração)" value={texto} onChangeText={(t) => setTexto(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" />
      <Botao
        titulo="Registrar como o caixa (demonstração)"
        variante="texto"
        disabled={!valido}
        onPress={() => {
          aoReceber(Math.round(valor * 100) / 100);
          setTexto('');
        }}
      />
    </View>
  );
}

const estilos = StyleSheet.create({
  qr: { alignItems: 'center', gap: 10, padding: 16, borderRadius: raio.m, backgroundColor: cores.superficie },
  conteudo: { padding: 16, gap: 18, paddingBottom: 140 },
  sucesso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.sucessoFundo, alignItems: 'center' },
  protocolo: { gap: 4, padding: 14, borderRadius: raio.l, backgroundColor: cores.sucessoFundo },
  produto: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 72, height: 72, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  saldo: { gap: 6, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
  subiu: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: raio.l, backgroundColor: cores.sucessoFundo },
  alerta: { gap: 8, padding: 14, borderRadius: raio.l, backgroundColor: cores.avisoFundo },
  confirmar: { gap: 8, padding: 16, borderRadius: raio.l, borderWidth: 1.5, borderColor: cores.marca, backgroundColor: cores.superficie },
  pix: { gap: 8, padding: 14, borderRadius: raio.l, backgroundColor: cores.avisoFundo },
  codigo: { padding: 10, borderRadius: raio.s, backgroundColor: cores.superficie },
  linha: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda },
  cartao: { gap: 6, padding: 14, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  regras: { gap: 4, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
});
