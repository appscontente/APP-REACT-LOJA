import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Platform } from 'react-native';

import { cores } from '@/lib/tema';
import { Botao } from './botao';
import { Texto } from './texto';

/**
 * Botão que copia um texto (o código Pix, por exemplo) para a área de transferência. Por 2 segundos vira "Copiado!",
 * avisa o leitor de tela e dá um toque leve de vibração onde o aparelho tem.
 */
export function Copiar({
  texto,
  rotulo = 'Copiar código',
  copiado = 'Código copiado',
}: {
  texto: string;
  /** Título do botão. */
  rotulo?: string;
  /** O que o leitor de tela anuncia depois de copiar. */
  copiado?: string;
}) {
  const [feito, setFeito] = useState(false);
  const [falhou, setFalhou] = useState(false);

  useEffect(() => {
    if (!feito) return;
    const timer = setTimeout(() => setFeito(false), 2000);
    return () => clearTimeout(timer);
  }, [feito]);
  useEffect(() => {
    if (!falhou) return;
    const timer = setTimeout(() => setFalhou(false), 4000);
    return () => clearTimeout(timer);
  }, [falhou]);

  const copiar = async () => {
    try {
      const ok = await Clipboard.setStringAsync(texto);
      if (!ok) throw new Error('não copiou');
    } catch {
      // A falha aparece na tela também (não só para o leitor de tela): quem não viu "Copiado!" não cola um código vazio.
      setFalhou(true);
      AccessibilityInfo.announceForAccessibility('Não deu para copiar. Toque e segure o código para selecionar.');
      return;
    }
    setFalhou(false);
    setFeito(true);
    AccessibilityInfo.announceForAccessibility(copiado);
    if (Platform.OS !== 'web') {
      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {
        // Sem vibração neste aparelho: o botão já mostrou "Copiado!".
      }
    }
  };

  return (
    <>
      <Botao
        titulo={falhou ? 'Não deu para copiar' : feito ? 'Copiado!' : rotulo}
        variante="contorno"
        icone={
          <Ionicons
            name={falhou ? 'alert-circle-outline' : feito ? 'checkmark' : 'copy-outline'}
            size={20}
            color={falhou ? cores.marca : feito ? cores.sucesso : cores.texto}
          />
        }
        onPress={copiar}
        accessibilityLabel={feito ? copiado : rotulo}
      />
      {falhou ? (
        <Texto variante="pequeno" cor={cores.marca} style={{ textAlign: 'center' }}>
          Toque e segure o código para selecionar e copiar.
        </Texto>
      ) : null}
    </>
  );
}
