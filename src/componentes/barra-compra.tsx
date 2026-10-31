import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useEffectEvent, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cores, raio } from '@/lib/tema';
import { Botao } from './botao';
import { Texto } from './texto';

/** Barra fixa embaixo da página do produto: conversar com a loja e o botão de compra. `aviso` aparece em cima dela. */
export function BarraCompra({ aoConversar, aviso, children }: { aoConversar: () => void; aviso?: ReactNode; children: ReactNode }) {
  const baixo = useSafeAreaInsets().bottom;
  return (
    <View style={[estilos.barra, { paddingBottom: baixo + 10 }]}>
      {aviso}
      <View style={estilos.linha}>
        <Pressable onPress={aoConversar} style={estilos.conversa} accessibilityRole="button" accessibilityLabel="Conversar com a loja">
          <Ionicons name="chatbubble-ellipses-outline" size={24} color={cores.marca} />
        </Pressable>
        <View style={{ flex: 1 }}>{children}</View>
      </View>
    </View>
  );
}

// Quantos avisos de carrinho estão abertos: o botão da loja (BotaoFigital, fora da tela) some enquanto há algum, para
// não cobrir o "Ver carrinho". Contador e não booleano porque a página antiga e a nova podem se cruzar na troca.
let avisosAbertos = 0;
const ouvintes = new Set<() => void>();
function avisarOuvintes() {
  ouvintes.forEach((ouvinte) => ouvinte());
}
// Fora do componente, para serem estáveis e o useSyncExternalStore não reassinar a cada render.
function assinarAvisos(ouvinte: () => void) {
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
  };
}
function lerAvisos() {
  return avisosAbertos > 0;
}

/** true enquanto o aviso "Adicionado ao carrinho" está na tela. */
export function useAvisoCarrinhoAberto() {
  return useSyncExternalStore(assinarAvisos, lerAvisos, lerAvisos);
}

/**
 * Aviso curto depois de adicionar ao carrinho: o cliente fica na página e escolhe "Ver carrinho" ou "Continuar
 * comprando". Some sozinho depois de alguns segundos (use `key` para reiniciar a contagem a cada toque).
 */
export function AvisoCarrinho({
  texto,
  limite,
  aoVerCarrinho,
  aoFechar,
}: {
  texto: string;
  /** true quando não deu para somar (o carrinho já tem tudo o que está disponível). */
  limite?: boolean;
  aoVerCarrinho: () => void;
  aoFechar: () => void;
}) {
  const fechar = useEffectEvent(aoFechar);
  useEffect(() => {
    const espera = setTimeout(() => fechar(), 8000);
    return () => clearTimeout(espera);
  }, []);
  // Só conta com a página do produto em foco: com outra tela por cima (outro produto do "Combina com", por exemplo), o
  // aviso escondido não tira o botão da loja de lá.
  const focado = useIsFocused();
  useEffect(() => {
    if (!focado) return;
    avisosAbertos += 1;
    avisarOuvintes();
    return () => {
      avisosAbertos -= 1;
      avisarOuvintes();
    };
  }, [focado]);
  return (
    <View style={[estilos.aviso, { backgroundColor: limite ? cores.avisoFundo : cores.sucessoFundo }]}>
      <View style={estilos.linha}>
        <Ionicons name={limite ? 'information-circle' : 'checkmark-circle'} size={22} color={limite ? cores.aviso : cores.sucesso} />
        <Texto variante="forte" style={{ flex: 1 }}>
          {texto}
        </Texto>
      </View>
      <View style={estilos.linha}>
        <Botao titulo="Continuar comprando" variante="contorno" onPress={aoFechar} style={estilos.botaoAviso} />
        <Botao titulo="Ver carrinho" variante="secundario" onPress={aoVerCarrinho} style={estilos.botaoAviso} />
      </View>
    </View>
  );
}

export const ALTURA_BARRA_COMPRA = 76;

const estilos = StyleSheet.create({
  barra: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: cores.superficie,
    borderTopWidth: 1,
    borderTopColor: cores.borda,
  },
  linha: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  conversa: {
    width: 52,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: cores.borda,
    alignItems: 'center',
    justifyContent: 'center',
  },
  aviso: { gap: 10, padding: 12, borderRadius: raio.l },
  botaoAviso: { flex: 1, paddingHorizontal: 8 },
});
