// Apresentação do autoatendimento: aparece na primeira vez que o cliente chega perto de uma loja (boas-vindas) e
// fica no botão "Como funciona" da tela da loja.

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { cores, raio } from '@/lib/tema';
import { Botao } from './botao';
import { Sorriso } from './logo';
import { Texto } from './texto';

const PASSOS: { icone: React.ComponentProps<typeof Ionicons>['name']; titulo: string; texto: string }[] = [
  {
    icone: 'qr-code-outline',
    titulo: 'Leia a etiqueta',
    texto: 'Toque em "Ler etiqueta" e aponte a câmera para o QR do produto. Aparecem o preço, as fotos e os detalhes.',
  },
  {
    icone: 'cart-outline',
    titulo: 'Monte o seu carrinho',
    texto: 'Ponha no carrinho da loja o que quiser levar. O desconto do autoatendimento aparece no carrinho, conforme a forma de pagamento.',
  },
  {
    icone: 'card-outline',
    titulo: 'Pague do seu jeito',
    texto: 'Gere o comprovante e pague no caixa, ou conclua pelo app para receber em casa ou retirar depois.',
  },
  {
    icone: 'chatbubbles-outline',
    titulo: 'Precisa de ajuda?',
    texto: 'Fale com a loja pela conversa do app ou chame alguém da equipe. Estamos aqui para ajudar.',
  },
];

type Props = {
  visivel: boolean;
  /** Nome da loja, para o título de boas-vindas. Sem ele, abre direto no primeiro passo. */
  nomeLoja?: string;
  aoFechar: () => void;
  /** Botão final ("Começar"). */
  aoComecar: () => void;
};

export function ComoFuncionaAutoatendimento({ visivel, nomeLoja, aoFechar, aoComecar }: Props) {
  // -1 é a tela de boas-vindas, antes do primeiro passo.
  const inicio = nomeLoja ? -1 : 0;
  const [passo, setPasso] = useState(inicio);
  const fechar = (depois: () => void) => {
    setPasso(inicio);
    depois();
  };
  const atual = PASSOS[passo];
  const ultimo = passo === PASSOS.length - 1;

  return (
    <Modal visible={visivel} transparent animationType="fade" onRequestClose={() => fechar(aoFechar)}>
      <Pressable style={estilos.fundo} onPress={() => fechar(aoFechar)} accessibilityLabel="Fechar" />
      <View style={estilos.cartao}>
        {passo < 0 ? (
          <>
            <Sorriso largura={72} />
            <Texto variante="subtitulo" style={{ textAlign: 'center' }}>
              Bem-vindo à Casa Contente {nomeLoja}!
            </Texto>
            <Texto cor={cores.textoSuave} style={{ textAlign: 'center' }}>
              Aqui você pode comprar sozinho pelo app, no autoatendimento, com mega descontos. Vamos ver como funciona?
            </Texto>
            <Botao titulo="Ver como funciona" onPress={() => setPasso(0)} />
            <Botao titulo="Agora não" variante="texto" onPress={() => fechar(aoFechar)} />
          </>
        ) : (
          <>
            <View style={estilos.icone}>
              <Ionicons name={atual.icone} size={34} color={cores.marca} />
            </View>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Passo {passo + 1} de {PASSOS.length}
            </Texto>
            <Texto variante="subtitulo" style={{ textAlign: 'center' }}>
              {atual.titulo}
            </Texto>
            <Texto cor={cores.textoSuave} style={{ textAlign: 'center' }}>
              {atual.texto}
            </Texto>
            <View style={estilos.pontos} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              {PASSOS.map((p, i) => (
                <View key={p.titulo} style={[estilos.ponto, i === passo && estilos.pontoAtual]} />
              ))}
            </View>
            <Botao titulo={ultimo ? 'Começar' : 'Próximo'} onPress={() => (ultimo ? fechar(aoComecar) : setPasso(passo + 1))} />
            <Botao titulo={passo > 0 ? 'Voltar' : 'Pular'} variante="texto" onPress={() => (passo > 0 ? setPasso(passo - 1) : fechar(aoComecar))} />
          </>
        )}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  fundo: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.45)' },
  cartao: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: '22%',
    backgroundColor: cores.superficie,
    borderRadius: raio.xl,
    padding: 24,
    gap: 12,
    alignItems: 'center',
  },
  icone: { width: 72, height: 72, borderRadius: 36, backgroundColor: cores.creme, alignItems: 'center', justifyContent: 'center' },
  pontos: { flexDirection: 'row', gap: 6, marginVertical: 4 },
  ponto: { width: 6, height: 6, borderRadius: 3, backgroundColor: cores.borda },
  pontoAtual: { width: 18, backgroundColor: cores.marca },
});
