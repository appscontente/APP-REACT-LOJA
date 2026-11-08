// Porquinho dourado do Cofrinho Contente (o mesmo desenho da página /cofrinho do site): corpo amarelo com o sorriso
// vermelho da logo, moeda com o sorriso entrando pela fenda e brilhos. Decorativo.

import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

export function Porquinho({ largura = 160, brilhos = true }: { largura?: number; brilhos?: boolean }) {
  return (
    <Svg width={largura} height={(largura * 220) / 260} viewBox="0 0 260 220" accessibilityElementsHidden aria-hidden>
      <Ellipse cx="128" cy="207" rx="84" ry="7" fill="#000" opacity="0.18" />
      <Rect x="66" y="150" width="26" height="52" rx="11" fill="#e39a00" />
      <Rect x="152" y="150" width="26" height="52" rx="11" fill="#e39a00" />
      <Path d="M42 116 C26 110 18 128 30 132 C40 135 42 122 34 122" fill="none" stroke="#e39a00" strokeWidth="6" strokeLinecap="round" />
      <Path d="M138 66 Q140 34 164 40 Q164 62 150 74 Z" fill="#e39a00" />
      <Ellipse cx="126" cy="122" rx="86" ry="66" fill="#fdb917" />
      <Path d="M48 140 Q126 196 204 140 Q190 186 126 188 Q62 186 48 140 Z" fill="#f1a600" opacity="0.6" />
      <Ellipse cx="92" cy="86" rx="30" ry="12" fill="#fff" opacity="0.35" transform="rotate(-18 92 86)" />
      <Rect x="86" y="160" width="26" height="46" rx="11" fill="#fdb917" />
      <Rect x="172" y="160" width="26" height="46" rx="11" fill="#fdb917" />
      <Rect x="86" y="194" width="26" height="12" rx="6" fill="#e39a00" />
      <Rect x="172" y="194" width="26" height="12" rx="6" fill="#e39a00" />
      <Path d="M160 70 Q166 34 194 46 Q190 70 172 82 Z" fill="#fdb917" />
      <Path d="M166 70 Q171 46 188 52 Q185 66 173 75 Z" fill="#f29a8c" />
      <Ellipse cx="214" cy="124" rx="21" ry="25" fill="#ffd15c" stroke="#e39a00" strokeWidth="3" />
      <Ellipse cx="207" cy="123" rx="3.5" ry="6.5" fill="#b8650a" />
      <Ellipse cx="221" cy="123" rx="3.5" ry="6.5" fill="#b8650a" />
      <Circle cx="178" cy="98" r="7.5" fill="#3c3c3a" />
      <Circle cx="180.6" cy="95.4" r="2.4" fill="#fff" />
      <Ellipse cx="178" cy="128" rx="10" ry="6" fill="#d71921" opacity="0.28" />
      <Path d="M176 148 Q185 156 195 150" fill="none" stroke="#3c3c3a" strokeWidth="3" strokeLinecap="round" />
      <Path d="M82 128 Q118 164 154 128" fill="none" stroke="#d71921" strokeWidth="10" strokeLinecap="round" />
      <Rect x="100" y="57" width="50" height="10" rx="5" fill="#a85a06" />
      <G transform="rotate(-14 125 30)">
        <Ellipse cx="125" cy="30" rx="19" ry="19" fill="#fff6dc" stroke="#e39a00" strokeWidth="3" />
        <Circle cx="125" cy="30" r="12.5" fill="none" stroke="#e39a00" strokeWidth="2" opacity="0.6" />
        <Path d="M118 29 Q125 37 132 29" fill="none" stroke="#d71921" strokeWidth="3.5" strokeLinecap="round" />
      </G>
      {brilhos ? (
        <>
          <Path d="M96 22 L88 18 M98 34 L89 35 M154 20 L162 15 M156 33 L165 33" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity={0.8} />
          <Path d="M40 60 l3 -9 l3 9 l9 3 l-9 3 l-3 9 l-3 -9 l-9 -3 z" fill="#fff" opacity={0.85} />
          <Path d="M224 66 l2 -6 l2 6 l6 2 l-6 2 l-2 6 l-2 -6 l-6 -2 z" fill="#fff" opacity={0.7} />
        </>
      ) : null}
    </Svg>
  );
}
