// Novo depósito num Cofrinho Contente: valor (até o que falta) e forma (Pix, débito ou crédito à vista).

import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { DepositoCofrinho } from '@/componentes/deposito-cofrinho';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { contas, garantiaVencida, useCofrinho } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { arredondar, formatarPreco } from '@/lib/formatar';
import { cores } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function DepositarCofrinho() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { buscar, depositar } = useCofrinho();
  const c = buscar(id);
  const vencida = c ? garantiaVencida(c) : false;
  const { dados, erro, carregando, recarregar } = useDados(
    () =>
      Promise.all([
        api.regrasCofrinho(),
        // Depois do prazo, o alvo é o preço à vista do dia.
        c && vencida ? Promise.all(c.itens.map((i) => api.simularCofrinho({ slug: i.slug }).then((s) => s.precoGarantido))) : Promise.resolve(undefined),
      ]),
    [c?.id, vencida],
  );

  if (!c || c.situacao !== 'aberto') return <Aviso titulo="Cofrinho fechado" texto="Este cofrinho não recebe mais depósitos." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} />;
  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const [{ regras }, precosDoDia] = dados;
  const conta = contas(c);
  const alvo = precosDoDia ? arredondar(precosDoDia.reduce((s, v) => s + v, 0)) : conta.alvo;
  // O Pix gerado e ainda não pago já ocupa o espaço dele: o saldo nunca passa do preço.
  const falta = arredondar(Math.max(0, alvo - conta.saldo - conta.pendente));
  if (falta <= 0)
    return (
      <Aviso
        titulo={conta.pendente > 0 ? 'Falta só pagar o Pix' : 'Cofrinho completo!'}
        texto={conta.pendente > 0 ? 'O Pix que você gerou completa o valor. Pague pelo app do banco.' : 'Agora é só concluir e escolher como receber.'}
        acao="Voltar ao cofrinho"
        aoTocar={() => router.back()}
      />
    );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 140 }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={{ gap: 4 }}>
        <Texto cor={cores.textoSuave}>
          Juntado {formatarPreco(conta.saldo)} de {formatarPreco(alvo)}. Faltam {formatarPreco(falta)}.
        </Texto>
      </View>
      <DepositoCofrinho
        regras={regras}
        preco={alvo}
        falta={falta}
        primeiro={false}
        sugestoes={[Math.min(falta, Math.ceil((falta / 3) * 100) / 100)]}
        titulo="Depositar"
        aoDepositar={(deposito) => {
          depositar(c.id, deposito);
          router.back();
        }}
      />
    </ScrollView>
  );
}
