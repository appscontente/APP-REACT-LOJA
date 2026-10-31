// Boas-vindas na loja (ver lib/perto-da-loja.ts): liga e desliga pela Conta, acompanha a posição com o app aberto e
// mostra o cartão de boas-vindas, que já deixa o app no modo daquela loja.

import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

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
  idAviso,
  jaSaudou,
  ligarSegundoPlano,
  limparBoasVindas,
  lojasNoMapa,
  marcarSaudada,
  segundoPlanoLigado,
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

/** Resultado de ligar: 'aproximada' quando o celular só deu a localização aproximada, que não serve para as boas-vindas. */
export type ResultadoLigar = 'ligado' | 'sem-permissao' | 'aproximada';

type Contexto = {
  ligado: boolean;
  /** true quando o aviso com o app fechado também está ligado (no Expo Go, só com o app aberto). */
  comAppFechado: boolean;
  ligar: () => Promise<ResultadoLigar>;
  desligar: () => void;
};

const ContextoBoasVindas = createContext<Contexto | null>(null);

/**
 * Localização aproximada (Android "aproximada", iPhone sem "Localização exata") erra por centenas de metros, mais que o
 * raio da loja: com ela as boas-vindas ficariam ligadas sem nunca aparecer.
 */
function soAproximada(p: Location.LocationPermissionResponse) {
  return p.android?.accuracy === 'coarse' || p.ios?.accuracy === 'reduced';
}

/**
 * Android 11+: o pedido de "o tempo todo" abre direto os Ajustes do celular. Antes disso, o app explica o que o cliente
 * vai ver e o que escolher.
 */
function explicarAjustesAndroid() {
  return new Promise<boolean>((resolve) =>
    Alert.alert(
      'Aviso com o app fechado',
      'O celular vai abrir os ajustes de localização. Escolha “Permitir o tempo todo” para receber as boas-vindas mesmo com o app ' +
        'fechado. A localização não sai do celular.',
      [
        { text: 'Agora não', style: 'cancel', onPress: () => resolve(false) },
        { text: 'Abrir ajustes', onPress: () => resolve(true) },
      ],
      { cancelable: true, onDismiss: () => resolve(false) },
    ),
  );
}

export function ProvedorBoasVindas({ children }: { children: ReactNode }) {
  const { lojas, lojaAtual, entrar } = useFigital();
  const [ligado, setLigado] = useState(false);
  const [comAppFechado, setComAppFechado] = useState(false);
  const [saudacao, setSaudacao] = useState<LojaNoMapa>();
  const [apresentacao, setApresentacao] = useState<{ slug: string; nome?: string }>();
  const chegadas = useRef(new Map<string, number>());

  useEffect(() => {
    (async () => {
      if (!(await ler<boolean>(CHAVE, false))) return;
      // A permissão pode ter sido tirada nos Ajustes com o app fechado, ou trocada para aproximada (com ela a cerca da
      // loja não funciona): aí a chave da Conta volta a ficar desligada.
      const permissao = await Location.getForegroundPermissionsAsync().catch(() => undefined);
      if (permissao && (!permissao.granted || soAproximada(permissao))) {
        gravar(CHAVE, false);
        desligarSegundoPlano();
        return;
      }
      setLigado(true);
      setComAppFechado(await segundoPlanoLigado());
    })();
  }, []);

  const saudar = useEffectEvent(async (loja: { slug: string; nome?: string }, abrirLoja: boolean) => {
    // Já no modo desta loja (entrou pelo QR ou pelo botão): não interrompe a compra com o cartão nem com o tutorial.
    const jaNaLoja = lojaAtual?.slug === loja.slug;
    entrar(loja.slug);
    if (jaNaLoja && !abrirLoja) return;
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
            await Notifications.cancelScheduledNotificationAsync(idAviso(loja.slug)).catch(() => undefined);
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
      if (!permissao.granted || soAproximada(permissao) || !ativo) return;
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
        if (!permissao.granted) return 'sem-permissao';
        if (soAproximada(permissao)) return 'aproximada';
        setLigado(true);
        gravar(CHAVE, true);
        if (temSegundoPlano) {
          if (Platform.OS === 'android') {
            const sempre = await Location.getBackgroundPermissionsAsync().catch(() => undefined);
            if (!sempre?.granted && !(await explicarAjustesAndroid())) return 'ligado';
          }
          const mapa = await lojasNoMapa(lojas);
          setComAppFechado(await ligarSegundoPlano(mapa).catch(() => false));
        }
        return 'ligado';
      },
      desligar: () => {
        setLigado(false);
        setComAppFechado(false);
        gravar(CHAVE, false);
        desligarSegundoPlano();
        // Não deixa no celular a hora das visitas a cada loja nem avisos agendados.
        limparBoasVindas();
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
        // Monta de novo a cada loja, para abrir na tela de boas-vindas (o passo inicial depende do nome da loja).
        key={apresentacao?.slug ?? 'nenhuma'}
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
