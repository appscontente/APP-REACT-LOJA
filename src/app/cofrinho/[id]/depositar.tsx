// Guardar mais num Cofrinho Contente: o cliente digita quanto quer guardar agora (Pix) ou vai ao caixa de uma loja.
// Sem parcela e sem prazo depois do primeiro pagamento (regulamento v4, 4.2 e 4.3).

import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, View } from 'react-native';

import { DepositoCofrinho } from '@/componentes/deposito-cofrinho';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { ativo, contas, temPagamento, useCofrinho } from '@/estado/cofrinho';
import { api } from '@/lib/api';
import { arredondar, formatarPreco } from '@/lib/formatar';
import { cores } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function GuardarNoCofrinho() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { buscar, pagar } = useCofrinho();
  const c = buscar(id);
  const { dados, erro, carregando, recarregar } = useDados(() => api.regrasCofrinho(), []);

  if (!c || !ativo(c)) return <Aviso titulo="Cofrinho fechado" texto="Este cofrinho não recebe mais pagamentos." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} />;
  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const conta = contas(c);
  const primeiro = !temPagamento(c);
  // O Pix gerado e ainda não pago já ocupa o espaço dele: o saldo nunca passa do valor a juntar.
  const falta = arredondar(Math.max(0, conta.falta - conta.pendente));
  if (falta <= 0)
    return (
      <Aviso
        titulo={conta.pendente > 0 ? 'Falta só pagar o Pix' : 'Cofrinho completo!'}
        texto={conta.pendente > 0 ? 'O Pix que você gerou completa o valor. Pague pelo app do banco.' : 'Agora é só concluir.'}
        acao="Voltar ao cofrinho"
        aoTocar={() => router.back()}
      />
    );

  return (
    <ScrollView contentContainerStyle={{ padding: 16, gap: 16, paddingBottom: 140 }} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={{ gap: 4 }}>
        <Texto cor={cores.textoSuave}>
          Guardado {formatarPreco(conta.saldo)} de {formatarPreco(conta.alvo)}. Faltam {formatarPreco(conta.falta)}. Guarde quanto quiser, quando quiser.
        </Texto>
      </View>
      <DepositoCofrinho
        regras={dados.regras}
        preco={c.preco}
        falta={falta}
        primeiro={primeiro}
        primeiroAte={primeiro ? c.primeiroPagamentoAte : undefined}
        titulo="Guardar"
        aoPagar={(p) => {
          pagar(c.id, p, primeiro ? c.primeiroPagamentoAte : undefined);
          // No caixa: volta ao cofrinho com o código aberto, para mostrar na loja.
          if (p.forma === 'loja') router.dismissTo({ pathname: '/cofrinho/[id]', params: { id: c.id, caixa: '1' } });
          else router.back();
        }}
      />
    </ScrollView>
  );
}
