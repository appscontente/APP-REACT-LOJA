import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { useConta } from '@/estado/conta';
import { cotarFrete, type CotacaoFrete } from '@/lib/api';
import { formatarCep, formatarPreco } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import { GavetaCep } from './cabecalho';
import { Texto } from './texto';

/** Frete e prazo do produto para o CEP guardado no app. */
export function FreteCep({ valor }: { valor: number }) {
  const { cep } = useConta();
  const [cotado, setCotado] = useState<{ chave: string; cotacao?: CotacaoFrete }>();
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!cep) return;
    let ativo = true;
    cotarFrete(cep, valor)
      .then((cotacao) => ativo && setCotado({ chave: `${cep}:${valor}`, cotacao }))
      .catch(() => ativo && setCotado({ chave: `${cep}:${valor}` }));
    return () => {
      ativo = false;
    };
  }, [cep, valor]);
  const atual = cotado?.chave === `${cep}:${valor}` ? cotado : undefined;
  const cotacao = atual?.cotacao;
  const erro = Boolean(atual && !cotacao);

  return (
    <View style={estilos.caixa}>
      <Ionicons name="car-outline" size={22} color={cores.marca} />
      <View style={{ flex: 1, gap: 2 }}>
        {!cep ? (
          <Texto variante="forte">Calcule o frete e o prazo</Texto>
        ) : erro ? (
          <Texto>Não conseguimos calcular o frete agora.</Texto>
        ) : !cotacao ? (
          <Texto cor={cores.textoSuave}>Calculando o frete…</Texto>
        ) : cotacao.atendido ? (
          <>
            <Texto variante="forte" cor={cotacao.cotacao.valor === 0 ? cores.sucesso : cores.texto}>
              {cotacao.cotacao.valor === 0 ? 'Frete grátis' : `Frete ${formatarPreco(cotacao.cotacao.valor)}`}, {cotacao.cotacao.prazo}
            </Texto>
            {cotacao.endereco?.cidade ? (
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Para {cotacao.endereco.cidade}/{cotacao.endereco.uf}
              </Texto>
            ) : null}
          </>
        ) : (
          <Texto>Ainda não entregamos nesse CEP. Você pode retirar numa das nossas lojas.</Texto>
        )}
        <Pressable onPress={() => setEditando(true)} hitSlop={6}>
          <Texto variante="rotulo" cor={cores.marca}>
            {cep ? `CEP ${formatarCep(cep)} · trocar` : 'Informar CEP'}
          </Texto>
        </Pressable>
      </View>
      <GavetaCep aberta={editando} fechar={() => setEditando(false)} />
    </View>
  );
}

const estilos = StyleSheet.create({
  caixa: { flexDirection: 'row', gap: 12, padding: 14, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
});
