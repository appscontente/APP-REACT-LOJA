// Tarefa das boas-vindas com o app fechado (ver lib/perto-da-loja.ts). Fica num arquivo só dela, carregado pelo index.js
// da raiz antes das telas: no Android, o celular acorda o app sem tela só para rodar a tarefa, e ela precisa estar
// definida já no carregamento do JS. Por isso aqui não entra tela nem estado do React.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { gravar, ler } from './armazenamento';

export type Ponto = { latitude: number; longitude: number };
export type LojaNoMapa = { slug: string; nome: string } & Ponto;

/** Quanto tempo perto da loja até as boas-vindas. */
export const PERMANENCIA_MS = 2 * 60 * 1000;
/** Depois das boas-vindas, a mesma loja só cumprimenta de novo depois disso (mesma validade do modo loja). */
const INTERVALO_MS = 4 * 60 * 60 * 1000;

export const TAREFA = 'boas-vindas-na-loja';
export const CHAVE_SAUDADAS = 'boas-vindas:v1';
export const CHAVE_LOJAS = 'boas-vindas-lojas:v1';

/** No Expo Go (e na prévia do navegador) o celular não deixa o app ouvir a localização com ele fechado. */
export const temSegundoPlano = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Loja que já recebeu boas-vindas há pouco não cumprimenta de novo. */
export async function jaSaudou(slug: string) {
  const saudadas = await ler<Record<string, number>>(CHAVE_SAUDADAS, {});
  return Date.now() - (saudadas[slug] ?? 0) < INTERVALO_MS;
}

export async function marcarSaudada(slug: string, quando: number | null = Date.now()) {
  const saudadas = await ler<Record<string, number>>(CHAVE_SAUDADAS, {});
  if (quando === null) delete saudadas[slug];
  else saudadas[slug] = quando;
  await gravar(CHAVE_SAUDADAS, saudadas);
}

export const idAviso = (slug: string) => `boas-vindas-${slug}`;

// Aviso do celular com o app fechado. Fica no nível do arquivo porque o celular acorda o app só para rodar a tarefa.
if (temSegundoPlano) {
  TaskManager.defineTask<{ eventType: Location.GeofencingEventType; region: Location.LocationRegion }>(
    TAREFA,
    async ({ data, error }) => {
      if (error || !data?.region.identifier) return;
      const slug = data.region.identifier;
      if (data.eventType === Location.GeofencingEventType.Enter) {
        if (await jaSaudou(slug)) return;
        const lojas = await ler<LojaNoMapa[]>(CHAVE_LOJAS, []);
        const nome = lojas.find((l) => l.slug === slug)?.nome ?? '';
        await Notifications.scheduleNotificationAsync({
          identifier: idAviso(slug),
          content: {
            title: `Bem-vindo à Casa Contente ${nome}!`,
            body: 'Toque para ver os produtos desta loja e comprar pelo celular.',
            data: { loja: slug },
          },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: PERMANENCIA_MS / 1000 },
        });
        // Conta como saudada já agora; se a pessoa sair antes dos 2 minutos, desfaz.
        await marcarSaudada(slug, Date.now() + PERMANENCIA_MS);
      } else if (data.eventType === Location.GeofencingEventType.Exit) {
        const agendado = await ler<Record<string, number>>(CHAVE_SAUDADAS, {});
        if ((agendado[slug] ?? 0) > Date.now()) {
          await Notifications.cancelScheduledNotificationAsync(idAviso(slug));
          await marcarSaudada(slug, null);
        }
      }
    },
  );
}
