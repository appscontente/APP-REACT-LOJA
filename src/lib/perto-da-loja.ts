// Boas-vindas na loja: quando o cliente fica 2 minutos perto de uma loja física, o app dá as boas-vindas e entra no
// modo daquela loja (Figital). Só liga se o cliente aceitar na Conta, e a localização nunca sai do celular: o app só
// compara a posição com o endereço das lojas.
//
// Dois jeitos, conforme o app:
// - App aberto (funciona até no Expo Go): acompanha a posição e conta os 2 minutos.
// - App fechado (só no app instalado de verdade, não no Expo Go): o celular avisa quando entra no raio da loja; o app
//   agenda um aviso para dali a 2 minutos e cancela se a pessoa sair antes.

import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { gravar, ler } from './armazenamento';
import type { LojaFisica } from './tipos';

/** Raio em volta da loja. O iPhone não avisa com precisão abaixo de ~100 m. */
export const RAIO_M = 120;
/** Quanto tempo perto da loja até as boas-vindas. */
export const PERMANENCIA_MS = 2 * 60 * 1000;
/** Depois das boas-vindas, a mesma loja só cumprimenta de novo depois disso (mesma validade do modo loja). */
const INTERVALO_MS = 4 * 60 * 60 * 1000;

const TAREFA = 'boas-vindas-na-loja';
const CHAVE_COORDENADAS = 'lojas-coordenadas:v1';
const CHAVE_SAUDADAS = 'boas-vindas:v1';
const CHAVE_LOJAS = 'boas-vindas-lojas:v1';

export type Ponto = { latitude: number; longitude: number };
export type LojaNoMapa = { slug: string; nome: string } & Ponto;

/** No Expo Go (e na prévia do navegador) o celular não deixa o app ouvir a localização com ele fechado. */
export const temSegundoPlano = Platform.OS !== 'web' && Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

/** Distância em metros entre dois pontos (fórmula de haversine). */
export function distancia(a: Ponto, b: Ponto) {
  const rad = Math.PI / 180;
  const dLat = (b.latitude - a.latitude) * rad;
  const dLon = (b.longitude - a.longitude) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.latitude * rad) * Math.cos(b.latitude * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371000 * Math.asin(Math.sqrt(h));
}

/**
 * Ponto de cada loja. Usa a latitude e a longitude que o site mandar; sem elas, o próprio celular acha o endereço
 * (uma vez por loja, guardado no aparelho).
 */
export async function lojasNoMapa(lojas: LojaFisica[]): Promise<LojaNoMapa[]> {
  const guardadas = await ler<Record<string, Ponto & { endereco: string }>>(CHAVE_COORDENADAS, {});
  const resultado: LojaNoMapa[] = [];
  for (const l of lojas) {
    const doSite = l as LojaFisica & Partial<Ponto>;
    let ponto: Ponto | undefined =
      typeof doSite.latitude === 'number' && typeof doSite.longitude === 'number'
        ? { latitude: doSite.latitude, longitude: doSite.longitude }
        : guardadas[l.slug]?.endereco === l.endereco
          ? guardadas[l.slug]
          : undefined;
    if (!ponto) {
      const achado = await Location.geocodeAsync(l.endereco).catch(() => []);
      if (achado[0]) {
        ponto = { latitude: achado[0].latitude, longitude: achado[0].longitude };
        guardadas[l.slug] = { ...ponto, endereco: l.endereco };
      }
    }
    if (ponto) resultado.push({ slug: l.slug, nome: l.nome, ...ponto });
  }
  await gravar(CHAVE_COORDENADAS, guardadas);
  return resultado;
}

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

const idAviso = (slug: string) => `boas-vindas-${slug}`;

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
            body: 'Toque para ver o estoque desta loja e comprar pelo celular.',
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

/** Liga o aviso com o app fechado. Precisa da permissão de localização "sempre" e da de avisos. */
export async function ligarSegundoPlano(lojas: LojaNoMapa[]) {
  if (!temSegundoPlano || !lojas.length) return false;
  const sempre = await Location.requestBackgroundPermissionsAsync();
  const avisos = await Notifications.requestPermissionsAsync();
  if (sempre.status !== 'granted' || !avisos.granted) return false;
  await gravar(CHAVE_LOJAS, lojas);
  await Location.startGeofencingAsync(
    TAREFA,
    lojas.map((l) => ({ identifier: l.slug, latitude: l.latitude, longitude: l.longitude, radius: RAIO_M, notifyOnEnter: true, notifyOnExit: true })),
  );
  return true;
}

export async function desligarSegundoPlano() {
  if (!temSegundoPlano) return;
  if (await Location.hasStartedGeofencingAsync(TAREFA).catch(() => false)) await Location.stopGeofencingAsync(TAREFA);
}
