// Leitor do QR da etiqueta e do código de barras. O QR leva só a URL (/qr/{CODEMP}/{CODPROD}), nunca o preço: o app
// abre o produto naquela loja e entra no modo loja. Código de barras do produto vira busca.

import { Ionicons } from '@expo/vector-icons';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useRef, useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import { useFigital } from '@/estado/figital';
import { destinoDoCodigo } from '@/lib/codigos';
import { cores, raio } from '@/lib/tema';

export default function Leitor() {
  const insets = useSafeAreaInsets();
  const [permissao, pedirPermissao] = useCameraPermissions();
  const { lojaAtual } = useFigital();
  const [codigo, setCodigo] = useState('');
  const lido = useRef(false);

  const abrir = (valor: string) => {
    const destino = destinoDoCodigo(valor, lojaAtual?.slug);
    if (!destino) {
      lido.current = false;
      return;
    }
    // Busca é aba: volta para as abas em vez de empilhar outra cópia delas (#21).
    if (destino.startsWith('/busca')) router.dismissTo(destino as never);
    else router.replace(destino as never);
  };
  // Negada sem poder perguntar de novo: o celular não mostra mais o pedido, só os Ajustes liberam a câmera.
  const bloqueada = Boolean(permissao && !permissao.granted && !permissao.canAskAgain);

  const aoLer = ({ data }: BarcodeScanningResult) => {
    if (lido.current) return;
    lido.current = true;
    abrir(data);
  };

  return (
    <View style={[estilos.tela, { paddingTop: insets.top }]}>
      <StatusBar style="light" />
      <View style={estilos.topo}>
        <Pressable onPress={() => router.back()} hitSlop={10} accessibilityLabel="Fechar">
          <Ionicons name="close" size={28} color="#fff" />
        </Pressable>
        <Texto variante="subtitulo" cor="#fff">
          Ler QR ou código de barras
        </Texto>
        <View style={{ width: 28 }} />
      </View>
      <View style={estilos.camera}>
        {!permissao ? (
          <ActivityIndicator color={cores.sorriso} size="large" />
        ) : permissao.granted ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['qr', 'ean13', 'ean8', 'upc_a', 'code128'] }}
            onBarcodeScanned={aoLer}
          />
        ) : (
          <View style={estilos.pedido}>
            <Ionicons name="qr-code-outline" size={64} color={cores.sorriso} />
            <Texto cor="#fff" style={{ textAlign: 'center' }}>
              {bloqueada
                ? 'A câmera está bloqueada para o app. Libere em Ajustes > Casa Contente > Câmera, ou digite o código abaixo.'
                : 'Precisamos da câmera para ler o QR das etiquetas da loja. Ela só é usada nesta tela.'}
            </Texto>
            {bloqueada ? (
              <Botao titulo="Abrir ajustes do celular" variante="sorriso" onPress={() => Linking.openSettings()} />
            ) : (
              <Botao titulo="Permitir câmera" variante="sorriso" onPress={pedirPermissao} />
            )}
          </View>
        )}
        {permissao?.granted ? <View style={estilos.mira} pointerEvents="none" /> : null}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={[estilos.manual, { paddingBottom: insets.bottom + 16 }]}>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {lojaAtual ? `Na loja ${lojaAtual.nome}: digite o código da etiqueta.` : 'Ou digite o código da etiqueta ou do produto.'}
          </Texto>
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-end' }}>
            <Campo
              rotulo="Código"
              value={codigo}
              onChangeText={setCodigo}
              autoCapitalize="characters"
              // Na loja o código da etiqueta (CODPROD) é número; fora dela o campo também serve para busca.
              keyboardType={lojaAtual ? 'number-pad' : 'default'}
              onSubmitEditing={() => abrir(codigo)}
            />
            <Botao titulo="Abrir" onPress={() => abrir(codigo)} disabled={!codigo.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: '#111' },
  topo: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
  camera: { flex: 1, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  pedido: { alignItems: 'center', gap: 16, padding: 32 },
  mira: { width: 240, height: 240, borderRadius: raio.xl, borderWidth: 3, borderColor: cores.sorriso },
  manual: { backgroundColor: cores.superficie, padding: 16, gap: 8, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
});
