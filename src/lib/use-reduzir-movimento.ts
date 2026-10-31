// "Reduzir movimento" (iPhone) ou "Remover animações" (Android): com a opção ligada, nada de texto mudando sozinho nem
// animação que repete. Acompanha a troca da opção com o app aberto.

import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function useReduzirMovimento() {
  const [reduzir, setReduzir] = useState(false);
  useEffect(() => {
    let ativo = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((ligado) => {
        if (ativo) setReduzir(ligado);
      })
      .catch(() => {});
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduzir);
    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, []);
  return reduzir;
}
