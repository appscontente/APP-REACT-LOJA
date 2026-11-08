// Um Cofrinho Contente: quanto já foi juntado, até quando o preço está garantido, os depósitos (com o Pix que falta
// pagar), o pagamento semanal e as ações: depositar, trocar o produto e concluir quando completar. O saldo não volta em
// dinheiro (termos, item 10).

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

import { Botao } from '@/componentes/botao';
import { Progresso, SituacaoGarantia } from '@/componentes/cofrinho';
import { Campo } from '@/componentes/campo';
import { Copiar } from '@/componentes/copiar';
import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { contas, garantiaVencida, useCofrinho, type DepositoCofrinho } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { DIAS_SEMANA, entradaMinima, formatarData, lerReais } from '@/lib/cofrinho';
import { arredondar, formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

const NOME_FORMA = { pix: 'Pix', loja: 'No caixa' } as const;

export default function TelaCofrinho() {
  const { id, novo, caixa } = useLocalSearchParams<{ id: string; novo?: string; caixa?: string }>();
  const { buscar, confirmarPagamento, registrarCaixa, concluir, gerarSemana, pararSemanal, pronto } = useCofrinho();
  const { dados: regras } = useDados(() => api.regrasCofrinho(), []);
  const c = buscar(id);
  const vencida = c ? garantiaVencida(c) : false;
  // Chegou o dia do pagamento semanal: o Pix da semana aparece pronto ao abrir o cofrinho.
  useEffect(() => {
    if (pronto && id) gerarSemana(id);
  }, [pronto, id, gerarSemana]);
  // Depois do prazo, o cofrinho vale o preço à vista do dia de cada produto (termos, item 8).
  const { dados: precosDoDia } = useDados(
    () => (c && vencida && c.situacao === 'aberto' ? Promise.all(c.itens.map((i) => api.simularCofrinho({ slug: i.slug }).then((s) => s.precoGarantido))) : Promise.resolve(undefined)),
    [c?.id, vencida, c?.itens.map((i) => i.slug).join(',')],
  );

  if (!pronto) return null;
  if (!c) return <Aviso titulo="Cofrinho não encontrado" texto="Ele pode ter saído deste celular ao sair da conta." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} triste />;

  const conta = contas(c);
  const alvo = precosDoDia ? arredondar(precosDoDia.reduce((s, v) => s + v, 0)) : conta.alvo;
  const falta = arredondar(Math.max(0, alvo - conta.saldo));
  const aberto = c.situacao === 'aberto';
  const pixPendente = c.depositos.filter((d) => d.situacao === 'aguardando-pix');

  const confirmarConclusao = () =>
    Alert.alert(
      'Concluir o cofrinho',
      'Com o sistema da loja ligado, aqui você escolhe entregar em casa ou retirar numa loja e paga o frete, se houver. Nesta demonstração, o cofrinho só fica marcado como concluído.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Concluir', onPress: () => concluir(c.id) },
      ],
    );
  const confirmarParada = () =>
    Alert.alert('Parar o pagamento semanal?', 'O app deixa de gerar o Pix toda semana. O saldo continua no cofrinho e você deposita quando quiser.', [
      { text: 'Manter', style: 'cancel' },
      { text: 'Parar', style: 'destructive', onPress: () => pararSemanal(c.id) },
    ]);

  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <Stack.Screen options={{ title: c.id }} />
      {novo ? (
        <View style={estilos.sucesso}>
          <Ionicons name="checkmark-circle" size={22} color={cores.sucesso} />
          <Texto cor={cores.sucesso} style={{ flex: 1 }}>
            Cofrinho aberto! O preço está garantido até {formatarData(c.garantidoAte)}.
            {c.depositos.length === 0 ? ' Ele começa a valer com o primeiro depósito no caixa.' : ''}
          </Texto>
        </View>
      ) : null}

      {c.itens.map((i) => (
        <View key={i.codprod} style={estilos.produto}>
          <Imagem uri={i.imagem} style={estilos.foto} contentFit="contain" />
          <View style={{ flex: 1, gap: 2 }}>
            <Texto variante="forte" numberOfLines={3}>
              {nomeLegivel(i.nome)}
            </Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Preço garantido {formatarPreco(i.precoGarantido)}
            </Texto>
          </View>
        </View>
      ))}

      <View style={estilos.saldo}>
        <Texto variante="rotulo">Juntado</Texto>
        <Texto variante="titulo">{formatarPreco(conta.saldo)}</Texto>
        <Progresso percentual={alvo > 0 ? Math.min(1, conta.saldo / alvo) : 0} />
        <Texto variante="pequeno">
          de {formatarPreco(alvo)}
          {aberto ? (falta > 0 ? ` · faltam ${formatarPreco(falta)}` : ' · completo!') : ''}
        </Texto>
        {precosDoDia ? (
          <Texto variante="pequeno" cor={cores.aviso}>
            O prazo do preço garantido acabou: o valor foi recalculado pela tabela de hoje, com o desconto à vista.
          </Texto>
        ) : null}
        <SituacaoGarantia cofrinho={c} />
      </View>

      {pixPendente.map((d) => (
        <PixPendente key={d.id} deposito={d} cofrinho={c.id} aoConfirmar={() => confirmarPagamento(c.id, d.id)} />
      ))}
      {aberto && falta > 0 ? (
        <CodigoCaixa
          key={caixa ?? 'fechado'}
          cofrinho={c.id}
          aberto={caixa === '1' || c.depositos.length === 0}
          minimo={Math.min(falta, c.depositos.some((d) => d.situacao === 'aprovado') ? (regras?.regras.depositoMinimo ?? 20) : regras ? entradaMinima(alvo, regras.regras) : Math.max(20, Math.ceil(alvo / 10)))}
          falta={arredondar(falta - conta.pendente)}
          aoReceber={(v) => registrarCaixa(c.id, v)}
        />
      ) : null}

      {aberto && c.plano ? (
        <View style={estilos.plano}>
          <Ionicons name="repeat" size={22} color={cores.marca} />
          <View style={{ flex: 1, gap: 2 }}>
            <Texto variante="forte">
              Toda {DIAS_SEMANA[c.plano.diaSemana]}: {formatarPreco(c.plano.valor)} no Pix
            </Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              O app gera o Pix no dia e avisa você. Próximo: {formatarData(c.plano.proximo)}.
            </Texto>
            <View style={{ flexDirection: 'row', gap: 16 }}>
              <Botao titulo="Mudar" variante="texto" onPress={() => router.push({ pathname: '/cofrinho/[id]/depositar', params: { id: c.id } })} />
              <Botao titulo="Parar" variante="texto" onPress={confirmarParada} />
            </View>
          </View>
        </View>
      ) : null}

      {aberto ? (
        <View style={{ gap: 10 }}>
          {falta > 0 ? (
            <Botao titulo="Depositar" onPress={() => router.push({ pathname: '/cofrinho/[id]/depositar', params: { id: c.id } })} />
          ) : (
            <Botao titulo="Concluir e receber o produto" onPress={confirmarConclusao} />
          )}
          <Botao titulo="Trocar produto" variante="contorno" onPress={() => router.push({ pathname: '/cofrinho/[id]/trocar', params: { id: c.id } })} />
        </View>
      ) : null}

      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo">Depósitos</Texto>
        {c.depositos.length === 0 ? <Texto cor={cores.textoSuave}>Nenhum depósito ainda.</Texto> : null}
        {[...c.depositos].reverse().map((d) => (
          <View key={d.id} style={estilos.linha}>
            <Texto style={{ flex: 1 }}>
              {formatarDataHora(d.quando)} · {NOME_FORMA[d.forma]}
            </Texto>
            <Texto style={{ fontFamily: fontes.textoForte }} cor={d.situacao === 'aprovado' ? cores.texto : cores.textoSuave}>
              {formatarPreco(d.valor)}
              {d.situacao === 'aguardando-pix' ? ' (a pagar)' : d.situacao === 'devolvido' ? ' (devolvido)' : ''}
              {d.semanal ? ' · semanal' : ''}
            </Texto>
          </View>
        ))}
      </View>

      {c.trocas.length ? (
        <View style={{ gap: 8 }}>
          <Texto variante="subtitulo">Trocas</Texto>
          {c.trocas.map((t) => (
            <Texto key={t.quando} variante="pequeno" cor={cores.textoSuave}>
              {formatarDataHora(t.quando)}: {t.de.map(nomeLegivel).join(', ')} → {t.para.map(nomeLegivel).join(', ')} ({t.motivo === 'esgotado' ? 'produto esgotou' : 'por escolha'})
            </Texto>
          ))}
        </View>
      ) : null}

      <View style={estilos.regras}>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          O saldo é deste cofrinho: não volta em dinheiro, não paga outras compras e não ganha nem usa cashback. Aberto em {formatarDataHora(c.abertoEm)}, com os termos de{' '}
          {c.aceite.versao.split('-').reverse().join('/')}.
        </Texto>
        <Botao titulo="Termos e condições" variante="texto" onPress={() => router.push('/cofrinho/termos')} />
      </View>
    </ScrollView>
  );
}

/** Pix gerado e ainda não pago. Demonstração: o código é de exemplo e "Já paguei" faz o papel do banco. */
function PixPendente({ deposito, cofrinho, aoConfirmar }: { deposito: DepositoCofrinho; cofrinho: string; aoConfirmar: () => void }) {
  const codigo = `00020126DEMONSTRACAO-COFRINHO-${cofrinho}-${deposito.id}5204000053039865802BR`;
  return (
    <View style={estilos.pix}>
      <Texto variante="forte">Pix de {formatarPreco(deposito.valor)} esperando pagamento</Texto>
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Copie o código e pague no app do seu banco. O valor entra no saldo assim que o banco confirmar.
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
 * depositar; o caixa digita o valor e recebe no Happy (contrato 39.2). O app não pede valor. Demonstração: o campo de
 * baixo faz o papel do caixa.
 */
function CodigoCaixa({ cofrinho, aberto: abertoInicial, minimo, falta, aoReceber }: { cofrinho: string; aberto: boolean; minimo: number; falta: number; aoReceber: (valor: number) => void }) {
  const [aberto, setAberto] = useState(abertoInicial);
  const [texto, setTexto] = useState('');
  const valor = lerReais(texto);
  const valido = Number.isFinite(valor) && valor >= minimo && valor <= falta;
  if (!aberto)
    return <Botao titulo="Pagar no caixa de uma loja" variante="contorno" onPress={() => setAberto(true)} />;
  return (
    <View style={estilos.pix}>
      <Texto variante="forte">Pagar no caixa de uma loja</Texto>
      <Texto variante="pequeno" cor={cores.textoSuave}>
        Mostre este código no caixa de qualquer loja Casa Contente e diga quanto quer depositar (de {formatarPreco(minimo)} até {formatarPreco(falta)}). Você paga como a loja aceitar e o valor
        entra no saldo na hora.
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
  produto: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 72, height: 72, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  saldo: { gap: 6, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
  pix: { gap: 8, padding: 14, borderRadius: raio.l, backgroundColor: cores.avisoFundo },
  codigo: { padding: 10, borderRadius: raio.s, backgroundColor: cores.superficie },
  linha: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda },
  plano: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: raio.l, borderWidth: 1.5, borderColor: cores.sorriso, backgroundColor: cores.superficie },
  regras: { gap: 4, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
});
