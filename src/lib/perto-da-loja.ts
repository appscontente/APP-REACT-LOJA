// Boas-vindas na loja: quando o cliente fica 2 minutos perto de uma loja física, o app dá as boas-vindas e entra no
// modo daquela loja (Figital). Só liga se o cliente aceitar na Conta, e a localização nunca sai do celular: o app só
// compara a posição com o endereço das lojas.
//
// Dois jeitos, conforme o app:
// - App aberto (funciona até no Expo Go): acompanha a posição e conta os 2 minutos.
// - App fechado (só no app instalado de verdade, não no Expo Go): o celular avisa quando entra no raio da loja; o app
//   agenda um aviso para dali a 2 minutos e cancela se a pessoa sair antes.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { gravar, ler } from './armazenamento';
import { CHAVE_LOJAS, CHAVE_SAUDADAS, TAREFA, idAviso, temSegundoPlano, type LojaNoMapa, type Ponto } from './tarefa-boas-vindas';
import type { LojaFisica } from './tipos';

// A tarefa com o app fechado mora em tarefa-boas-vindas.ts (carregada pelo index.js antes das telas); daqui saem as
// mesmas regras para quem já importava deste arquivo.
export { PERMANENCIA_MS, idAviso, jaSaudou, marcarSaudada, temSegundoPlano, type LojaNoMapa, type Ponto } from './tarefa-boas-vindas';

/** Raio em volta da loja. O iPhone não avisa com precisão abaixo de ~100 m. */
export const RAIO_M = 120;

const CHAVE_COORDENADAS = 'lojas-coordenadas:v1';

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

/** Diz se o aviso com o app fechado está de pé (a cerca virtual continua ligada depois de fechar e abrir o app). */
export async function segundoPlanoLigado() {
  if (!temSegundoPlano) return false;
  return Location.hasStartedGeofencingAsync(TAREFA).catch(() => false);
}

/**
 * Ao desligar as boas-vindas: apaga do celular a hora das visitas a cada loja e a lista da cerca virtual, e cancela os
 * avisos que estavam agendados. Fica fora do desligarSegundoPlano, porque a hora também é gravada com o app aberto.
 */
export async function limparBoasVindas() {
  const lojas = await ler<LojaNoMapa[]>(CHAVE_LOJAS, []);
  const saudadas = await ler<Record<string, number>>(CHAVE_SAUDADAS, {});
  const slugs = new Set([...lojas.map((l) => l.slug), ...Object.keys(saudadas)]);
  if (Platform.OS !== 'web')
    await Promise.all([...slugs].map((slug) => Notifications.cancelScheduledNotificationAsync(idAviso(slug)).catch(() => undefined)));
  await gravar(CHAVE_SAUDADAS, {});
  await gravar(CHAVE_LOJAS, []);
}
