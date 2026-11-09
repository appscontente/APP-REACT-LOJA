// Formulário de pagamento do Cofrinho Contente: o cliente escolhe a forma (Pix ou caixa de uma loja) e, no Pix, digita
// quanto quer guardar agora. O Pix só nasce aqui, com o valor que o cliente escolheu (o cofrinho incentiva, não cobra;
// regulamento v4, 4). Sem cartão no cofrinho. Nesta demonstração nada é cobrado. Usado na abertura (primeiro
// pagamento) e na tela "Guardar".

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import type { NovoPagamento } from '@/estado/cofrinho';
import { conferirDeposito, entradaMinima, lerReais } from '@/lib/cofrinho';
import { formatarDataHora, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { FormaDeposito, RegrasCofrinho } from '@/lib/tipos';

const ICONES: Record<FormaDeposito, React.ComponentProps<typeof Ionicons>['name']> = {
  pix: 'qr-code-outline',
  loja: 'storefront-outline',
};

export function DepositoCofrinho({
  regras,
  preco,
  falta,
  primeiro,
  valorInicial,
  primeiroAte,
  titulo,
  bloqueado,
  aoPagar,
}: {
  regras: RegrasCofrinho['regras'];
  /** Preço do cofrinho (para a entrada mínima). */
  preco: number;
  /** Quanto falta para completar. */
  falta: number;
  primeiro: boolean;
  valorInicial?: number;
  /** Prazo do primeiro pagamento: o Pix dele vence nessa hora. */
  primeiroAte?: string;
  /** Texto do botão; o valor entra no fim. */
  titulo: string;
  /** Algo fora do formulário ainda falta (ex.: as declarações): o botão fica apagado com esta frase. */
  bloqueado?: string;
  aoPagar: (pagamento: NovoPagamento) => void | Promise<void>;
}) {
  const reais = (v: number) => v.toFixed(2).replace('.', ',');
  const [texto, setTexto] = useState(valorInicial ? reais(valorInicial) : '');
  const [forma, setForma] = useState<FormaDeposito>('pix');
  const [tocouValor, setTocouValor] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const conferido = conferirDeposito(lerReais(texto), falta, primeiro, preco, regras);
  const valor = 'valor' in conferido ? conferido.valor : undefined;
  const noCaixa = forma === 'loja';
  const pronto = (noCaixa || valor !== undefined) && !bloqueado;

  const enviar = async () => {
    if (!pronto) return;
    setEnviando(true);
    try {
      await aoPagar(noCaixa ? { forma: 'loja' } : { forma: 'pix', valor: valor! });
    } finally {
      setEnviando(false);
    }
  };

  return (
    <View style={{ gap: 12 }}>
      <Texto variante="rotulo">Como você quer guardar</Texto>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {regras.formas.map((f) => {
          const marcado = forma === f;
          return (
            <Pressable key={f} onPress={() => setForma(f)} style={[estilos.forma, marcado && estilos.formaMarcada]} accessibilityRole="radio" accessibilityState={{ checked: marcado }}>
              <Ionicons name={ICONES[f]} size={22} color={marcado ? cores.marca : cores.textoSuave} />
              <Texto variante="forte" style={{ flex: 1 }}>
                {regras.nomesFormas[f]}
              </Texto>
              <Ionicons name={marcado ? 'radio-button-on' : 'radio-button-off'} size={20} color={marcado ? cores.marca : cores.textoSuave} />
            </Pressable>
          );
        })}
      </View>
      {forma === 'pix' ? (
        <>
          <Campo
            rotulo="Quanto você quer guardar agora (R$)"
            value={texto}
            onChangeText={(t) => setTexto(t.replace(/[^\d,.]/g, ''))}
            onBlur={() => setTocouValor(true)}
            keyboardType="decimal-pad"
            placeholder="0,00"
            erro={tocouValor && conferido.erro ? conferido.erro : undefined}
          />
          {falta > 0 ? (
            <View style={estilos.chips}>
              <Pressable
                onPress={() => {
                  setTexto(reais(falta));
                  setTocouValor(true);
                }}
                style={estilos.chip}
                accessibilityRole="button"
                accessibilityLabel={`Guardar tudo o que falta: ${formatarPreco(falta)}`}>
                <Texto variante="rotulo">Tudo o que falta: {formatarPreco(falta)}</Texto>
              </Pressable>
            </View>
          ) : null}
        </>
      ) : null}

      <Texto variante="pequeno" cor={cores.textoSuave}>
        {forma === 'pix'
          ? `Geramos um código Pix copia e cola${primeiroAte ? `, que vale até ${formatarDataHora(primeiroAte)}` : ''}. O valor entra no saldo assim que o banco confirmar. Pix não pago só perde a validade, sem custo nenhum.`
          : primeiro
            ? `Leve o código do cofrinho ao caixa de qualquer loja Casa Contente${primeiroAte ? ` até ${formatarDataHora(primeiroAte)}` : ''}. Lá você diz quanto quer guardar (o primeiro pagamento é de pelo menos ${formatarPreco(entradaMinima(preco, regras))}) e paga como a loja aceitar.`
            : 'Leve o código do cofrinho ao caixa de qualquer loja Casa Contente. Lá você diz quanto quer guardar e paga como a loja aceitar. O valor entra no saldo na hora.'}
      </Texto>

      {bloqueado ? (
        <Texto variante="pequeno" cor={cores.aviso}>
          {bloqueado}
        </Texto>
      ) : null}
      <Botao
        titulo={noCaixa ? (primeiro ? 'Abrir cofrinho e pagar no caixa' : 'Ver o código para o caixa') : valor !== undefined ? `${titulo} ${formatarPreco(valor)}` : titulo}
        disabled={!pronto}
        carregando={enviando}
        onPress={enviar}
      />
      <View style={estilos.aviso}>
        <Ionicons name="information-circle" size={18} color={cores.aviso} />
        <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
          Demonstração: nada é cobrado. Com o sistema da loja ligado, o Pix vai pela Rede e o caixa confirma pelo Happy.
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    minHeight: 40,
    justifyContent: 'center',
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  forma: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 14,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  formaMarcada: { borderColor: cores.marca, backgroundColor: cores.creme },
  aviso: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
    borderRadius: raio.m,
    backgroundColor: cores.avisoFundo,
  },
});
