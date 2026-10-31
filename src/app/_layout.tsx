import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { DefaultTheme, router, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BotaoFigital } from '@/componentes/botao-figital';
import { Aviso } from '@/componentes/estado-tela';
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

/**
 * Erro inesperado (dado diferente do esperado, por exemplo) não fecha o app: mostra a tela de erro. Vale para cada tela
 * (prop da Stack abaixo, o cabeçalho com voltar e o botão da loja continuam) e para erro no próprio layout.
 */
export function ErrorBoundary({ retry }: ErrorBoundaryProps) {
  return (
    <View style={{ flex: 1, backgroundColor: cores.fundo }}>
      {/* "Ir para o início" fica no meio, junto do "Tentar de novo", longe do botão da loja no canto de baixo. Se a tela
          quebrar de novo, o cliente não fica preso: volta para o Início (que já está por baixo, pela âncora). */}
      <Aviso
        titulo="Algo não carregou"
        texto="Algo deu errado nesta tela. Tente de novo."
        acao="Tentar de novo"
        aoTocar={retry}
        secundaria={{
          titulo: 'Ir para o início',
          aoTocar: () => {
            router.dismissTo('/');
            // Erro no próprio layout: limpa a tela de erro para a navegação aparecer de novo.
            retry();
          },
        }}
        triste
      />
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
                      {/* Cada tela tem a própria barreira de erro: um erro numa tela não troca o app inteiro. */}
                      <Stack
                        unstable_screenErrorBoundary={ErrorBoundary}
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
