import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BotaoFigital } from '@/componentes/botao-figital';
import { Erro } from '@/componentes/estado-tela';
import { ProvedorBoasVindas } from '@/estado/boas-vindas';
import { ProvedorCarrinho } from '@/estado/carrinho';
import { ProvedorConta } from '@/estado/conta';
import { ProvedorConversas } from '@/estado/conversas';
import { ProvedorFigital } from '@/estado/figital';
import { ProvedorPagamento } from '@/estado/pagamento';
import { cores, fontes } from '@/lib/tema';

// Link do WhatsApp, QR ou aviso que abre o app fechado direto numa tela: o Início (abas) fica por baixo, com voltar.
export const unstable_settings = { anchor: '(abas)' };

SplashScreen.preventAutoHideAsync();

/** Erro inesperado numa tela (dado diferente do esperado, por exemplo) não fecha o app: mostra a tela de erro. */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      <Erro mensagem="Algo deu errado nesta tela. Tente de novo." tentar={retry} />
    </View>
  );
}

const tema = {
  ...DefaultTheme,
  colors: { ...DefaultTheme.colors, primary: cores.marca, background: cores.fundo, card: cores.superficie, text: cores.texto, border: cores.borda },
};

export default function Raiz() {
  const [fontesProntas] = useFonts({ Fredoka_500Medium, Fredoka_600SemiBold, Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold });
  useEffect(() => {
    if (fontesProntas) SplashScreen.hideAsync();
  }, [fontesProntas]);
  if (!fontesProntas) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={tema}>
        <ProvedorConta>
          <ProvedorPagamento>
            <ProvedorFigital>
              <ProvedorBoasVindas>
                <ProvedorCarrinho>
                  <ProvedorConversas>
                    <View style={{ flex: 1 }}>
                      {/* Texto escuro na barra de status; o Início (topo vermelho), o leitor e o pedido recebido trocam para claro. */}
                      <StatusBar style="dark" />
                      <Stack
                        screenOptions={{
                          title: '',
                          headerTintColor: cores.texto,
                          headerTitleStyle: { fontFamily: fontes.titulo, fontSize: 18 },
                          headerBackButtonDisplayMode: 'minimal',
                          headerShadowVisible: false,
                          headerStyle: { backgroundColor: cores.fundo },
                          contentStyle: { backgroundColor: cores.fundo },
                        }}>
                        <Stack.Screen name="(abas)" options={{ headerShown: false }} />
                        <Stack.Screen name="leitor" options={{ presentation: 'fullScreenModal', headerShown: false }} />
                        <Stack.Screen name="checkout" options={{ title: 'Finalizar compra' }} />
                        <Stack.Screen name="pedido-recebido" options={{ headerShown: false, gestureEnabled: false }} />
                        <Stack.Screen name="[segmento]/p" options={{ title: '' }} />
                      </Stack>
                      <BotaoFigital />
                    </View>
                  </ProvedorConversas>
                </ProvedorCarrinho>
              </ProvedorBoasVindas>
            </ProvedorFigital>
          </ProvedorPagamento>
        </ProvedorConta>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
