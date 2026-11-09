// Lembrete opcional do Cofrinho Contente: toda semana, no dia que o cliente escolheu, às 9h, com um valor só sugerido.
// Não gera Pix nem cobrança, e o texto segue o modelo do Happy: nada de parcela, vencimento, atraso, débito ou
// pendência (regulamento v4, 4.3). Tocar abre o cofrinho. Com o backend, o lembrete também sai do servidor (ação
// `lembrete` do Happy); este é o local, que funciona sem internet. No navegador (Expo web) não há aviso agendado.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatarPreco, nomeLegivel } from './formatar';

const idAviso = (cofrinho: string) => `cofrinho-lembrete-${cofrinho}`;

/** Texto do lembrete (também usado nos testes de linguagem). */
export function textoLembrete(produto: string, valorSugerido?: number) {
  return {
    titulo: 'Seu Cofrinho Contente',
    corpo: `Hoje é o dia que você escolheu para guardar um pouco para ${nomeLegivel(produto)}.${
      valorSugerido ? ` Sugestão: ${formatarPreco(valorSugerido)}, ou o valor que couber.` : ' Guarde o valor que couber.'
    } Você muda ou desliga este lembrete no app.`,
  };
}

export async function agendarLembrete(cofrinho: string, produto: string, lembrete: { diaSemana: number; valorSugerido?: number }) {
  if (Platform.OS === 'web') return;
  try {
    await cancelarLembrete(cofrinho);
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return;
    const { titulo, corpo } = textoLembrete(produto, lembrete.valorSugerido);
    await Notifications.scheduleNotificationAsync({
      identifier: idAviso(cofrinho),
      content: { title: titulo, body: corpo, data: { cofrinho } },
      // Notifications conta o domingo como 1.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: lembrete.diaSemana + 1, hour: 9, minute: 0 },
    });
  } catch {
    // Sem permissão de aviso, o cofrinho segue igual: o lembrete é só uma ajuda.
  }
}

export async function cancelarLembrete(cofrinho: string) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(idAviso(cofrinho)).catch(() => undefined);
  // O aviso da versão anterior (Pix semanal) também sai.
  await Notifications.cancelScheduledNotificationAsync(`cofrinho-semanal-${cofrinho}`).catch(() => undefined);
}
