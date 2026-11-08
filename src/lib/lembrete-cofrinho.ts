// Aviso no celular do pagamento semanal do Cofrinho Contente: toda semana, no dia escolhido, às 9h. Tocar abre o
// cofrinho, onde o Pix da semana já está gerado. Com o backend, o aviso também sai do servidor (contrato 39.2); este é
// o local, que funciona sem internet. No navegador (Expo web) não há aviso agendado.

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { formatarPreco } from './formatar';

const idAviso = (cofrinho: string) => `cofrinho-semanal-${cofrinho}`;

export async function agendarLembreteSemanal(cofrinho: string, produto: string, valor: number, diaSemana: number) {
  if (Platform.OS === 'web') return;
  try {
    await cancelarLembreteSemanal(cofrinho);
    const { granted } = await Notifications.requestPermissionsAsync();
    if (!granted) return;
    await Notifications.scheduleNotificationAsync({
      identifier: idAviso(cofrinho),
      content: {
        title: 'Dia do seu Cofrinho Contente',
        body: `O Pix de ${formatarPreco(valor)} para ${produto} está pronto no app.`,
        data: { cofrinho },
      },
      // Notifications conta o domingo como 1.
      trigger: { type: Notifications.SchedulableTriggerInputTypes.WEEKLY, weekday: diaSemana + 1, hour: 9, minute: 0 },
    });
  } catch {
    // Sem aviso o plano continua: o Pix da semana é gerado quando o cliente abre o cofrinho.
  }
}

export async function cancelarLembreteSemanal(cofrinho: string) {
  if (Platform.OS === 'web') return;
  await Notifications.cancelScheduledNotificationAsync(idAviso(cofrinho)).catch(() => undefined);
}
