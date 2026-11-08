// Porquinho dourado do Cofrinho Contente (arte enviada pelo dono em 08/11/2026; a mesma da página /cofrinho do site).
// Decorativo.

import { Image } from 'expo-image';

const ARTE = require('../../assets/images/porquinho.png');
/** Proporção da arte (720 x 649). */
const PROPORCAO = 649 / 720;

export function Porquinho({ largura = 160 }: { largura?: number }) {
  return <Image source={ARTE} style={{ width: largura, height: largura * PROPORCAO }} contentFit="contain" accessible={false} />;
}
