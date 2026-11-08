// Um Cofrinho Contente: quanto já foi juntado, até quando o preço está garantido, os depósitos (com o Pix que falta
// pagar) e as ações: depositar, trocar o produto, concluir quando completar e desistir nos primeiros 7 dias.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Progresso, SituacaoGarantia } from '@/componentes/cofrinho';
import { Copiar } from '@/componentes/copiar';
import { Aviso } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { contas, garantiaVencida, useCofrinho, type DepositoCofrinho } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { dentroDoArrependimento, formatarData } from '@/lib/cofrinho';
import { arredondar, formatarDataHora, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

const NOME_FORMA = { pix: 'Pix', debito: 'Débito', credito: 'Crédito à vista' } as const;

export default function TelaCofrinho() {
  const { id, novo } = useLocalSearchParams<{ id: string; novo?: string }>();
  const { buscar, confirmarPix, concluir, desistir, pronto } = useCofrinho();
  const c = buscar(id);
  const vencida = c ? garantiaVencida(c) : false;
  const { dados: regras } = useDados(() => api.regrasCofrinho(), []);
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
  const podeDesistir = aberto && regras && dentroDoArrependimento(c.abertoEm, regras.regras) && conta.saldo + conta.pendente > 0;

  const confirmarConclusao = () =>
    Alert.alert(
      'Concluir o cofrinho',
      'Com o sistema da loja ligado, aqui você escolhe entregar em casa ou retirar numa loja e paga o frete, se houver. Nesta demonstração, o cofrinho só fica marcado como concluído.',
      [
        { text: 'Agora não', style: 'cancel' },
        { text: 'Concluir', onPress: () => concluir(c.id) },
      ],
    );
  const confirmarDesistencia = () =>
    Alert.alert(
      'Desistir e receber de volta?',
      `Você está nos ${regras?.regras.arrependimentoDias ?? 7} dias de arrependimento: o cartão é estornado e o Pix volta para a conta de onde saiu. O cofrinho é encerrado.`,
      [
        { text: 'Manter o cofrinho', style: 'cancel' },
        { text: 'Desistir', style: 'destructive', onPress: () => desistir(c.id) },
      ],
    );

  return (
    <ScrollView contentContainerStyle={estilos.conteudo}>
      <Stack.Screen options={{ title: c.id }} />
      {novo ? (
        <View style={estilos.sucesso}>
          <Ionicons name="checkmark-circle" size={22} color={cores.sucesso} />
          <Texto cor={cores.sucesso} style={{ flex: 1 }}>
            Cofrinho aberto! O preço está garantido até {formatarData(c.garantidoAte)}.
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
        <PixPendente key={d.id} deposito={d} cofrinho={c.id} aoConfirmar={() => confirmarPix(c.id, d.id)} />
      ))}

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
          O saldo é deste cofrinho: não paga outras compras e não ganha nem usa cashback. Aberto em {formatarDataHora(c.abertoEm)}, com os termos de{' '}
          {c.aceite.versao.split('-').reverse().join('/')}.
        </Texto>
        <Botao titulo="Termos e condições" variante="texto" onPress={() => router.push('/cofrinho/termos')} />
        {podeDesistir ? <Botao titulo="Desistir e receber de volta" variante="texto" onPress={confirmarDesistencia} /> : null}
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

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 18, paddingBottom: 140 },
  sucesso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.sucessoFundo, alignItems: 'center' },
  produto: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 72, height: 72, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  saldo: { gap: 6, padding: 16, borderRadius: raio.l, backgroundColor: cores.creme },
  pix: { gap: 8, padding: 14, borderRadius: raio.l, backgroundColor: cores.avisoFundo },
  codigo: { padding: 10, borderRadius: raio.s, backgroundColor: cores.superficie },
  linha: { flexDirection: 'row', gap: 8, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: cores.borda },
  regras: { gap: 4, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
});
