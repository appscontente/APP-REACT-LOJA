// Formulário de depósito do Cofrinho Contente. Duas opções: "Toda semana" (o cliente digita o valor e escolhe o dia; o
// primeiro Pix sai agora e o app gera os próximos e avisa) ou "Outro valor" (o cliente digita quanto quer depositar
// agora, no Pix ou no caixa de uma loja). Sem cartão no cofrinho (dono, 08/11/2026). Nesta demonstração nada é
// cobrado. Usado na abertura (primeiro depósito) e na tela "Depositar".

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Texto } from '@/componentes/texto';
import type { NovoDeposito, PlanoSemanal } from '@/estado/cofrinho';
import { conferirDeposito, DIAS_SEMANA, entradaMinima, formatarData, lerReais, valorSemanal } from '@/lib/cofrinho';
import { formatarPreco } from '@/lib/formatar';
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
  garantidoAte,
  planoAtual,
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
  /** Fim da garantia do preço: com ela aparece a opção "Toda semana" (a sugestão completa até essa data). */
  garantidoAte?: string;
  /** Pagamento semanal que o cofrinho já tem (a opção abre com ele preenchido, para mudar). */
  planoAtual?: PlanoSemanal;
  /** Texto do botão; o valor entra no fim. */
  titulo: string;
  /** Algo fora do formulário ainda falta (ex.: o aceite dos termos): o botão fica apagado com esta frase. */
  bloqueado?: string;
  aoDepositar: (deposito: NovoDeposito) => void | Promise<void>;
}) {
  const reais = (v: number) => v.toFixed(2).replace('.', ',');
  const [modo, setModo] = useState<'semanal' | 'outro'>(planoAtual ? 'semanal' : 'outro');
  const [texto, setTexto] = useState(valorInicial ? reais(valorInicial) : '');
  const [textoSemanal, setTextoSemanal] = useState(() => {
    const v = planoAtual?.valor ?? (garantidoAte ? valorSemanal(falta, garantidoAte, regras) : 0);
    return v > 0 ? reais(Math.max(v, primeiro ? (valorInicial ?? 0) : 0)) : '';
  });
  const [diaSemana, setDiaSemana] = useState(planoAtual?.diaSemana ?? new Date().getDay());
  const [agora] = useState(() => Date.now());
  const [formaEscolhida, setForma] = useState<FormaDeposito>('pix');
  const semanal = modo === 'semanal' && Boolean(garantidoAte);
  // O pagamento semanal é sempre no Pix: o app gera o código da semana sozinho.
  const forma: FormaDeposito = semanal ? 'pix' : formaEscolhida;
  const [tocouValor, setTocouValor] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const conferido = conferirDeposito(lerReais(semanal ? textoSemanal : texto), falta, primeiro, preco, regras);
  const valor = 'valor' in conferido ? conferido.valor : undefined;
  const noCaixa = forma === 'loja';
  const pronto = (noCaixa || valor !== undefined) && !bloqueado;

  const enviar = async () => {
    if (!pronto) return;
    setEnviando(true);
    try {
      if (noCaixa) await aoDepositar({ forma: 'loja' });
      else if (valor !== undefined) await aoDepositar(semanal ? { forma: 'pix', valor, semanal: { valor, diaSemana } } : { forma: 'pix', valor });
    } finally {
      setEnviando(false);
    }
  };

  // Com o valor digitado, em quantas semanas completa (só informa; o cliente muda quando quiser).
  const semanas = semanal && valor ? Math.ceil(falta / valor) : 0;
  const completaEm = semanas ? new Date(agora + (semanas - 1) * 7 * 86_400_000).toISOString() : undefined;

  return (
    <View style={{ gap: 12 }}>
      {garantidoAte ? (
        <View style={{ gap: 8 }} accessibilityRole="radiogroup">
          <Opcao marcada={semanal} icone="repeat" titulo="Toda semana" texto="Você escolhe o valor e o dia. O app gera o Pix toda semana e avisa você." aoTocar={() => setModo('semanal')} />
          <Opcao marcada={!semanal} icone="create-outline" titulo="Outro valor" texto="Deposite quanto quiser agora, no Pix ou no caixa de uma loja." aoTocar={() => setModo('outro')} />
        </View>
      ) : null}

      {semanal ? (
        <View style={{ gap: 12 }}>
          <Campo
            rotulo="Quanto por semana (R$)"
            value={textoSemanal}
            onChangeText={(t) => setTextoSemanal(t.replace(/[^\d,.]/g, ''))}
            onBlur={() => setTocouValor(true)}
            keyboardType="decimal-pad"
            placeholder="0,00"
            erro={tocouValor && conferido.erro ? conferido.erro : undefined}
          />
          <Texto variante="rotulo">Em que dia da semana</Texto>
          <View style={estilos.chips}>
            {DIAS_SEMANA.map((nome, i) => {
              const marcado = diaSemana === i;
              return (
                <Pressable
                  key={nome}
                  onPress={() => setDiaSemana(i)}
                  style={[estilos.dia, marcado && estilos.formaMarcada]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: marcado }}
                  accessibilityLabel={nome}>
                  <Texto variante="rotulo" cor={marcado ? cores.marca : cores.texto}>
                    {nome.slice(0, 3)}
                  </Texto>
                </Pressable>
              );
            })}
          </View>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            O primeiro Pix sai agora. Depois, toda {DIAS_SEMANA[diaSemana]}, o app gera o Pix de {valor ? formatarPreco(valor) : 'cada semana'} e avisa você. O último é só o que faltar. Dá para mudar
            ou parar quando quiser.
            {completaEm ? ` Nesse ritmo, completa por volta de ${formatarData(completaEm)}.` : ''}
          </Texto>
        </View>
      ) : (
        <>
          <Texto variante="rotulo">Como você quer pagar</Texto>
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
            rotulo="Quanto você quer depositar (R$)"
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
                accessibilityLabel={`Depositar tudo o que falta: ${formatarPreco(falta)}`}>
                <Texto variante="rotulo">Tudo o que falta: {formatarPreco(falta)}</Texto>
              </Pressable>
            </View>
          ) : null}

            </>
          ) : null}
        </>
      )}

      {semanal ? null : (
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {forma === 'pix'
            ? 'Geramos um código Pix copia e cola. O depósito entra no saldo assim que o banco confirmar.'
            : primeiro
              ? `Leve o código do cofrinho ao caixa de qualquer loja Casa Contente. Lá você diz quanto quer depositar (o primeiro depósito é de pelo menos ${formatarPreco(entradaMinima(preco, regras))}) e paga como a loja aceitar. O valor entra no saldo na hora.`
              : 'Leve o código do cofrinho ao caixa de qualquer loja Casa Contente. Lá você diz quanto quer depositar e paga como a loja aceitar. O valor entra no saldo na hora.'}
        </Texto>
      )}

      {bloqueado ? (
        <Texto variante="pequeno" cor={cores.aviso}>
          {bloqueado}
        </Texto>
      ) : null}
      <Botao titulo={noCaixa ? (primeiro ? 'Abrir cofrinho e pagar no caixa' : 'Ver o código para o caixa') : valor !== undefined ? `${titulo} ${formatarPreco(valor)}` : titulo} disabled={!pronto} carregando={enviando} onPress={enviar} />
      <View style={estilos.aviso}>
        <Ionicons name="information-circle" size={18} color={cores.aviso} />
        <Texto variante="pequeno" cor={cores.aviso} style={{ flex: 1 }}>
          Demonstração: nada é cobrado. Com o sistema da loja ligado, o Pix vai pela Rede e o caixa confirma pelo Happy.
        </Texto>
      </View>
    </View>
  );
}

function Opcao({ marcada, icone, titulo, texto, aoTocar }: { marcada: boolean; icone: React.ComponentProps<typeof Ionicons>['name']; titulo: string; texto: string; aoTocar: () => void }) {
  return (
    <Pressable onPress={aoTocar} style={[estilos.opcao, marcada && estilos.formaMarcada]} accessibilityRole="radio" accessibilityState={{ checked: marcada }}>
      <Ionicons name={icone} size={22} color={marcada ? cores.marca : cores.textoSuave} />
      <View style={{ flex: 1, gap: 2 }}>
        <Texto variante="forte">{titulo}</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          {texto}
        </Texto>
      </View>
      <Ionicons name={marcada ? 'radio-button-on' : 'radio-button-off'} size={20} color={marcada ? cores.marca : cores.textoSuave} />
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 14,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  dia: {
    minWidth: 44,
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
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
