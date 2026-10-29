import { Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';
import { Manrope_400Regular, Manrope_600SemiBold, Manrope_700Bold } from '@expo-google-fonts/manrope';
import { useFonts } from 'expo-font';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { BotaoFigital } from '@/componentes/botao-figital';
import { ProvedorCarrinho } from '@/estado/carrinho';
import { ProvedorConta } from '@/estado/conta';
import { ProvedorConversas } from '@/estado/conversas';
import { ProvedorFigital } from '@/estado/figital';
import { cores, fontes } from '@/lib/tema';

SplashScreen.preventAutoHideAsync();

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
          <ProvedorFigital>
            <ProvedorCarrinho>
              <ProvedorConversas>
                <View style={{ flex: 1 }}>
                  <StatusBar style="light" />
                  <Stack
                    screenOptions={{
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
                  </Stack>
                  <BotaoFigital />
                </View>
              </ProvedorConversas>
            </ProvedorCarrinho>
          </ProvedorFigital>
        </ProvedorConta>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
