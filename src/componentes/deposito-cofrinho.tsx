// Formulário de depósito do Cofrinho Contente: valor, forma (Pix, débito ou crédito à vista) e os dados do cartão. O
// cartão vai do formulário direto para o serviço de pagamento (contrato 3.12 e 39.2); o app nunca guarda número nem
// CVV. Nesta demonstração nada é cobrado. Usado na abertura (primeiro depósito) e na tela "Depositar".

import { Ionicons } from '@expo/vector-icons';
import * as ScreenCapture from 'expo-screen-capture';
import { useEffect, useState } from 'react';
import { AppState, Platform, Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import { conferirDeposito, lerReais } from '@/lib/cofrinho';
import { formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { FormaDeposito, RegrasCofrinho } from '@/lib/tipos';

const VALIDADE = /^(0[1-9]|1[0-2])\/\d{2}$/;
const ICONES: Record<FormaDeposito, React.ComponentProps<typeof Ionicons>['name']> = {
  pix: 'qr-code-outline',
  debito: 'card-outline',
  credito: 'card',
};

export function DepositoCofrinho({
  regras,
  preco,
  falta,
  primeiro,
  valorInicial,
  sugestoes = [],
  titulo,
  bloqueado,
  aoDepositar,
}: {
  regras: RegrasCofrinho['regras'];
  /** Preço do cofrinho (para a entrada mínima). */
  preco: number;
  /** Quanto falta para completar. */
  falta: number;
  primeiro: boolean;
  valorInicial?: number;
  /** Valores prontos para tocar (sugestões do site). */
  sugestoes?: number[];
  /** Texto do botão; o valor entra no fim. */
  titulo: string;
  /** Algo fora do formulário ainda falta (ex.: o aceite dos termos): o botão fica apagado com esta frase. */
  bloqueado?: string;
  aoDepositar: (deposito: { forma: FormaDeposito; valor: number }) => void | Promise<void>;
}) {
  const [texto, setTexto] = useState(valorInicial ? valorInicial.toFixed(2).replace('.', ',') : '');
  const [forma, setForma] = useState<FormaDeposito>('pix');
  const [cartao, setCartao] = useState({ numero: '', nome: '', validade: '', cvv: '' });
  const [tocouValor, setTocouValor] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [emPrimeiroPlano, setEmPrimeiroPlano] = useState(AppState.currentState === 'active');
  const comCartao = forma !== 'pix';

  // Como no checkout: no Android a tela com o cartão não sai em print nem na miniatura dos apps recentes; no iPhone a
  // capa cobre os campos fora do primeiro plano.
  useEffect(() => {
    if (Platform.OS !== 'android' || !comCartao) return;
    ScreenCapture.preventScreenCaptureAsync('cofrinho').catch(() => undefined);
    return () => {
      ScreenCapture.allowScreenCaptureAsync('cofrinho').catch(() => undefined);
    };
  }, [comCartao]);
  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (e) => setEmPrimeiroPlano(e === 'active'));
    return () => assinatura.remove();
  }, []);

  const conferido = conferirDeposito(lerReais(texto), falta, primeiro, preco, regras);
  const valor = 'valor' in conferido ? conferido.valor : undefined;
  const faltaNoCartao = comCartao
    ? [
        cartao.numero.replace(/\D/g, '').length < 13 && 'número do cartão',
        cartao.nome.trim().length <= 2 && 'nome impresso',
        !VALIDADE.test(cartao.validade) && 'validade (MM/AA)',
        !/^\d{3,4}$/.test(cartao.cvv) && 'CVV',
      ].filter(Boolean)
    : [];
  const pronto = valor !== undefined && faltaNoCartao.length === 0 && !bloqueado;

  const enviar = async () => {
    if (!pronto || valor === undefined) return;
    setEnviando(true);
    try {
      await aoDepositar({ forma, valor });
      // O cartão sai da memória da tela assim que o depósito vai.
      setCartao({ numero: '', nome: '', validade: '', cvv: '' });
    } finally {
      setEnviando(false);
    }
  };

  const opcoesValor = [...new Set([...sugestoes, falta].map((v) => Math.round(v * 100) / 100))].filter((v) => v > 0 && v <= falta).slice(0, 3);

  return (
    <View style={{ gap: 12 }}>
      <Campo
        rotulo="Quanto você quer depositar (R$)"
        value={texto}
        onChangeText={(t) => setTexto(t.replace(/[^\d,.]/g, ''))}
        onBlur={() => setTocouValor(true)}
        keyboardType="decimal-pad"
        placeholder="0,00"
        erro={tocouValor && conferido.erro ? conferido.erro : undefined}
      />
      {opcoesValor.length ? (
        <View style={estilos.chips}>
          {opcoesValor.map((v) => (
            <Pressable
              key={v}
              onPress={() => {
                setTexto(v.toFixed(2).replace('.', ','));
                setTocouValor(true);
              }}
              style={estilos.chip}
              accessibilityRole="button"
              accessibilityLabel={`Depositar ${formatarPreco(v)}`}>
              <Texto variante="rotulo">{v === falta ? `Tudo: ${formatarPreco(v)}` : formatarPreco(v)}</Texto>
            </Pressable>
          ))}
        </View>
      ) : null}

      <Texto variante="rotulo">Como você quer pagar</Texto>
      <View style={{ gap: 8 }} accessibilityRole="radiogroup">
        {regras.formas.map((f) => {
          const marcado = forma === f;
          return (
            <Pressable
              key={f}
              onPress={() => setForma(f)}
              style={[estilos.forma, marcado && estilos.formaMarcada]}
              accessibilityRole="radio"
              accessibilityState={{ checked: marcado }}>
              <Ionicons name={ICONES[f]} size={22} color={marcado ? cores.marca : cores.textoSuave} />
              <Texto variante="forte" style={{ flex: 1 }}>
                {regras.nomesFormas[f]}
              </Texto>
              <Ionicons name={marcado ? 'radio-button-on' : 'radio-button-off'} size={20} color={marcado ? cores.marca : cores.textoSuave} />
            </Pressable>
          );
        })}
      </View>

      {comCartao ? (
        <View style={{ gap: 10 }}>
          {emPrimeiroPlano ? (
            <>
              <Campo
                rotulo="Número do cartão"
                value={cartao.numero}
                onChangeText={(t) => setCartao((c) => ({ ...c, numero: t.replace(/\D/g, '').slice(0, 19) }))}
                keyboardType="number-pad"
                autoComplete="cc-number"
              />
              <Campo rotulo="Nome impresso" value={cartao.nome} onChangeText={(t) => setCartao((c) => ({ ...c, nome: t }))} autoCapitalize="characters" autoComplete="cc-name" />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Campo
                  rotulo="Validade (MM/AA)"
                  value={cartao.validade}
                  onChangeText={(t) => {
                    const d = t.replace(/\D/g, '').slice(0, 4);
                    setCartao((c) => ({ ...c, validade: d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d }));
                  }}
                  keyboardType="number-pad"
                  autoComplete="cc-exp"
                />
                <Campo
                  rotulo="CVV"
                  value={cartao.cvv}
                  onChangeText={(t) => setCartao((c) => ({ ...c, cvv: t.replace(/\D/g, '').slice(0, 4) }))}
                  keyboardType="number-pad"
                  secureTextEntry
                  autoComplete="cc-csc"
                />
              </View>
            </>
          ) : (
            <View style={[estilos.aviso, { minHeight: 200 }]} />
          )}
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {forma === 'debito'
              ? 'No débito, o banco pede a sua confirmação (3DS) e o valor sai na hora.'
              : 'Crédito só à vista, sem parcelamento. O depósito entra no saldo depois da análise antifraude.'}{' '}
            O app não guarda os dados do cartão.
          </Texto>
        </View>
      ) : (
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Geramos um código Pix copia e cola. O depósito entra no saldo assim que o banco confirmar.
        </Texto>
      )}

      {bloqueado || (faltaNoCartao.length && valor !== undefined) ? (
        <Texto variante="pequeno" cor={cores.aviso}>
          {bloqueado ?? `Falta preencher: ${faltaNoCartao.join(', ')}.`}
        </Texto>
      ) : null}
      <Botao titulo={valor !== undefined ? `${titulo} ${formatarPreco(valor)}` : titulo} disabled={!pronto} carregando={enviando} onPress={enviar} />
      <View style={estilos.aviso}>
        <Ionicons name="information-circle" size={18} color={cores.aviso} />
        <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
          Demonstração: nada é cobrado. Com o sistema da loja ligado, o depósito vai para a Rede.
        </Texto>
      </View>
    </View>
  );
}

const estilos = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { paddingHorizontal: 14, minHeight: 40, justifyContent: 'center', borderRadius: raio.pilula, borderWidth: 1.5, borderColor: cores.borda, backgroundColor: cores.superficie },
  forma: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingHorizontal: 14, borderRadius: raio.m, borderWidth: 1.5, borderColor: cores.borda, backgroundColor: cores.superficie },
  formaMarcada: { borderColor: cores.marca, backgroundColor: cores.creme },
  aviso: { flexDirection: 'row', gap: 8, padding: 12, borderRadius: raio.m, backgroundColor: cores.avisoFundo },
});
