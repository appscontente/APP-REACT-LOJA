// Boas-vindas na loja (ver lib/perto-da-loja.ts): liga e desliga pela Conta, acompanha a posição com o app aberto e
// mostra o cartão de boas-vindas, que já deixa o app no modo daquela loja.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { ComoFuncionaAutoatendimento } from '@/componentes/como-funciona-autoatendimento';
import { Sorriso } from '@/componentes/logo';
import { Texto } from '@/componentes/texto';
import { gravar, ler } from '@/lib/armazenamento';
import {
  PERMANENCIA_MS,
  RAIO_M,
  desligarSegundoPlano,
  distancia,
  jaSaudou,
  ligarSegundoPlano,
  lojasNoMapa,
  marcarSaudada,
  temSegundoPlano,
  type LojaNoMapa,
  type Ponto,
} from '@/lib/perto-da-loja';
import { rotaLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import { useFigital } from './figital';

const CHAVE = 'boas-vindas-ligado:v1';
/** Na primeira chegada a uma loja, as boas-vindas apresentam o autoatendimento; depois, só o cartão curto. */
const CHAVE_APRESENTADO = 'autoatendimento-apresentado:v1';
/** Sem andar, o celular não manda posição nova; a conta dos 2 minutos roda nesse intervalo. */
const CONFERIR_MS = 15 * 1000;

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: false, shouldSetBadge: false }),
});

type Contexto = {
  ligado: boolean;
  /** true quando o aviso com o app fechado também está ligado (no Expo Go, só com o app aberto). */
  comAppFechado: boolean;
  ligar: () => Promise<boolean>;
  desligar: () => void;
};

const ContextoBoasVindas = createContext<Contexto | null>(null);

export function ProvedorBoasVindas({ children }: { children: ReactNode }) {
  const { lojas, entrar } = useFigital();
  const [ligado, setLigado] = useState(false);
  const [comAppFechado, setComAppFechado] = useState(false);
  const [saudacao, setSaudacao] = useState<LojaNoMapa>();
  const [apresentacao, setApresentacao] = useState<{ slug: string; nome?: string }>();
  const chegadas = useRef(new Map<string, number>());

  useEffect(() => {
    ler<boolean>(CHAVE, false).then(setLigado);
  }, []);

  const saudar = useEffectEvent(async (loja: { slug: string; nome?: string }, abrirLoja: boolean) => {
    entrar(loja.slug);
    const nome = loja.nome ?? lojas.find((l) => l.slug === loja.slug)?.nome;
    if (!(await ler<boolean>(CHAVE_APRESENTADO, false))) {
      gravar(CHAVE_APRESENTADO, true);
      setApresentacao({ slug: loja.slug, nome });
      return;
    }
    if (abrirLoja) router.push(rotaLoja(loja.slug) as never);
    else if (loja.nome) setSaudacao(loja as LojaNoMapa);
  });

  // Tocar no aviso de boas-vindas abre a loja e entra no modo dela.
  useEffect(() => {
    // Na prévia do navegador não há avisos do celular.
    if (Platform.OS === 'web') return;
    const abrir = (r: Notifications.NotificationResponse | null) => {
      const slug = r?.notification.request.content.data?.loja;
      if (typeof slug !== 'string') return;
      saudar({ slug }, true);
    };
    abrir(Notifications.getLastNotificationResponse());
    const assinatura = Notifications.addNotificationResponseReceivedListener(abrir);
    return () => assinatura.remove();
  }, []);

  // Com o app aberto: acompanha a posição e conta os 2 minutos perto de cada loja.
  useEffect(() => {
    if (!ligado || !lojas.length) return;
    let ativo = true;
    let ultima: Ponto | undefined;
    let mapa: LojaNoMapa[] = [];
    let assinatura: Location.LocationSubscription | undefined;

    const conferir = async () => {
      if (!ultima) return;
      for (const loja of mapa) {
        const d = distancia(ultima, loja);
        const chegou = chegadas.current.get(loja.slug);
        if (d <= RAIO_M) {
          if (!chegou) chegadas.current.set(loja.slug, Date.now());
          else if (Date.now() - chegou >= PERMANENCIA_MS && !(await jaSaudou(loja.slug)) && ativo) {
            await marcarSaudada(loja.slug);
            await Notifications.cancelScheduledNotificationAsync(`boas-vindas-${loja.slug}`).catch(() => undefined);
            saudar(loja, false);
          }
        } else if (d > RAIO_M * 1.5) {
          // Folga na saída, para o GPS oscilando na porta não zerar a conta.
          chegadas.current.delete(loja.slug);
        }
      }
    };

    (async () => {
      const permissao = await Location.getForegroundPermissionsAsync();
      if (!permissao.granted || !ativo) return;
      mapa = await lojasNoMapa(lojas);
      if (!ativo) return;
      assinatura = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.Balanced, distanceInterval: 15, timeInterval: CONFERIR_MS },
        (p) => {
          ultima = p.coords;
          conferir();
        },
      );
    })();
    const relogio = setInterval(conferir, CONFERIR_MS);
    return () => {
      ativo = false;
      clearInterval(relogio);
      assinatura?.remove();
    };
  }, [ligado, lojas]);

  const valor = useMemo<Contexto>(
    () => ({
      ligado,
      comAppFechado,
      ligar: async () => {
        const permissao = await Location.requestForegroundPermissionsAsync();
        if (!permissao.granted) return false;
        setLigado(true);
        gravar(CHAVE, true);
        if (temSegundoPlano) {
          const mapa = await lojasNoMapa(lojas);
          setComAppFechado(await ligarSegundoPlano(mapa).catch(() => false));
        }
        return true;
      },
      desligar: () => {
        setLigado(false);
        setComAppFechado(false);
        gravar(CHAVE, false);
        desligarSegundoPlano();
      },
    }),
    [ligado, comAppFechado, lojas],
  );

  return (
    <ContextoBoasVindas.Provider value={valor}>
      {children}
      <Modal visible={Boolean(saudacao)} transparent animationType="fade" onRequestClose={() => setSaudacao(undefined)}>
        <Pressable style={estilos.fundo} onPress={() => setSaudacao(undefined)} accessibilityLabel="Fechar" />
        <View style={estilos.cartao}>
          <Sorriso largura={72} />
          <Texto variante="subtitulo" style={{ textAlign: 'center' }}>
            Bem-vindo à Casa Contente {saudacao?.nome}!
          </Texto>
          <Texto cor={cores.textoSuave} style={{ textAlign: 'center' }}>
            O app já está no modo desta loja: leia o QR code ou procure pelo produto que deseja ver aqui na loja.
          </Texto>
          <Botao
            titulo="Ver a loja"
            onPress={() => {
              const slug = saudacao?.slug;
              setSaudacao(undefined);
              if (slug) router.push(rotaLoja(slug) as never);
            }}
          />
          <Botao titulo="Agora não" variante="texto" onPress={() => setSaudacao(undefined)} />
        </View>
      </Modal>
      <ComoFuncionaAutoatendimento
        visivel={Boolean(apresentacao)}
        nomeLoja={apresentacao?.nome ?? ''}
        aoFechar={() => setApresentacao(undefined)}
        aoComecar={() => {
          const slug = apresentacao?.slug;
          setApresentacao(undefined);
          if (slug) router.push(rotaLoja(slug) as never);
        }}
      />
    </ContextoBoasVindas.Provider>
  );
}

export function useBoasVindas() {
  const c = useContext(ContextoBoasVindas);
  if (!c) throw new Error('useBoasVindas fora do ProvedorBoasVindas');
  return c;
}

const estilos = StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  cartao: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '28%',
    backgroundColor: cores.superficie,
    borderRadius: raio.xl,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
});
