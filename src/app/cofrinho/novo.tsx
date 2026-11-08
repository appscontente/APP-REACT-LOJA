// Abrir um Cofrinho Contente para um produto (?slug=): o preço à vista garantido, até quando, sugestões de depósito,
// o aceite dos termos (obrigatório em todo cofrinho novo) e o primeiro depósito. O preço vem do site; com o backend,
// o servidor calcula de novo na abertura e grava o aceite (versão, data e hora, CPF e aparelho).

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { DepositoCofrinho } from '@/componentes/deposito-cofrinho';
import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { useCofrinho } from '@/estado/cofrinho';
import { useConta } from '@/estado/conta';
import { api } from '@/lib/api';
import { formatarData } from '@/lib/cofrinho';
import { formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import { useDados } from '@/lib/use-dados';

export default function NovoCofrinho() {
  const { slug } = useLocalSearchParams<{ slug?: string }>();
  const { logado } = useConta();
  const { abertos, abrir } = useCofrinho();
  const [aceito, setAceito] = useState(false);
  const { dados, erro, carregando, recarregar } = useDados(
    () => Promise.all([api.regrasCofrinho(), api.simularCofrinho({ slug: slug ?? '' })]),
    [slug],
  );

  if (!slug) return <Aviso titulo="Escolha um produto" texto="Abra o produto que você quer e toque em Guardar no Cofrinho Contente." acao="Buscar produtos" aoTocar={() => router.replace('/busca')} />;
  if (!dados && carregando) return <Carregando />;
  if (!dados) return <Erro mensagem={erro ?? ''} tentar={recarregar} />;
  const [{ regras, termos }, sim] = dados;
  const nome = nomeLegivel(sim.produto.nome);

  if (!sim.elegivel.pode)
    return <Aviso titulo="Este produto não entra no cofrinho" texto={sim.elegivel.motivo} acao="Escolher outro produto" aoTocar={() => router.replace('/busca')} triste />;
  if (abertos.length >= regras.maxAbertos)
    return (
      <Aviso
        titulo={`Você já tem ${regras.maxAbertos} cofrinhos abertos`}
        texto="Conclua um deles ou troque o produto de um cofrinho aberto para guardar este."
        acao="Ver meus cofrinhos"
        aoTocar={() => router.replace('/cofrinho')}
      />
    );
  if (!logado)
    return <Aviso titulo="Entre na sua conta" texto="O cofrinho fica na sua conta, com o CPF de quem vai receber a nota." acao="Entrar" aoTocar={() => router.push('/conta')} />;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={estilos.produto}>
        <Imagem uri={sim.produto.imagem} style={estilos.foto} contentFit="contain" />
        <View style={{ flex: 1, gap: 4 }}>
          <Texto variante="forte" numberOfLines={3}>
            {nome}
          </Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Código {sim.produto.codprod}
          </Texto>
        </View>
      </View>

      <View style={estilos.destaque}>
        <Texto variante="rotulo">Preço à vista garantido</Texto>
        <Texto variante="titulo">{formatarPreco(sim.precoGarantido)}</Texto>
        <Texto variante="pequeno">
          até {formatarData(sim.garantidoAte)} ({sim.prazoDias} dias). Se o preço de tabela subir, você ganha um desconto que cobre a diferença.
        </Texto>
      </View>

      <View style={{ gap: 8 }}>
        <Texto variante="subtitulo">Sem parcela fixa</Texto>
        <Texto cor={cores.textoSuave}>
          Abra com pelo menos {formatarPreco(sim.entradaMinima)} ({regras.entradaMinimaPercentual}% do preço). Depois, você decide: deixe um Pix toda semana, no dia que escolher, ou deposite outro valor quando quiser.
        </Texto>
      </View>

      <View style={estilos.regras}>
        <Linha icone="swap-horizontal" texto="Mudou de ideia? Troque por outro produto, sem perder o saldo." />
        <Linha icone="lock-closed-outline" texto="O saldo é deste cofrinho: não volta em dinheiro e não paga outras compras." />
        <Linha icone="cube-outline" texto="O cofrinho não separa a peça: se ela esgotar, você espera a reposição ou troca." />
        <Linha icone="time-outline" texto={`Passou de ${sim.prazoDias} dias sem completar? O preço é recalculado pela tabela do dia, com o desconto à vista.`} />
        <Linha icone="pricetag-outline" texto="Frete e montagem são calculados no fim. Sem cupom e sem cashback." />
      </View>

      <Pressable onPress={() => setAceito((a) => !a)} style={estilos.aceite} accessibilityRole="checkbox" accessibilityState={{ checked: aceito }}>
        <Ionicons name={aceito ? 'checkbox' : 'square-outline'} size={26} color={aceito ? cores.marca : cores.textoSuave} />
        <Texto style={{ flex: 1 }}>Li e aceito os termos e condições do Cofrinho Contente (versão de {termos.atualizadoEm}).</Texto>
      </Pressable>
      <Botao titulo="Ler os termos e condições" variante="texto" onPress={() => router.push('/cofrinho/termos')} />

      <Texto variante="subtitulo">Primeiro depósito</Texto>
      <DepositoCofrinho
        regras={regras}
        preco={sim.precoGarantido}
        falta={sim.precoGarantido}
        primeiro
        valorInicial={sim.entradaMinima}
        garantidoAte={sim.garantidoAte}
        titulo="Abrir cofrinho e depositar"
        bloqueado={aceito ? undefined : 'Marque o aceite dos termos para abrir o cofrinho.'}
        aoDepositar={(deposito) => {
          const id = abrir({
            item: { codprod: sim.produto.codprod, slug: sim.produto.slug, nome: sim.produto.nome, imagem: sim.produto.imagem, precoGarantido: sim.precoGarantido },
            garantidoAte: sim.garantidoAte,
            versaoTermos: termos.versao,
            deposito,
          });
          router.replace({ pathname: '/cofrinho/[id]', params: { id, novo: '1' } });
        }}
      />
    </ScrollView>
  );
}

function Linha({ icone, texto }: { icone: React.ComponentProps<typeof Ionicons>['name']; texto: string }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <Ionicons name={icone} size={18} color={cores.textoSuave} />
      <Texto variante="pequeno" style={{ flex: 1 }}>
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 16, paddingBottom: 140 },
  produto: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  foto: { width: 84, height: 84, borderRadius: raio.m, backgroundColor: cores.fundoAlt },
  destaque: { gap: 2, padding: 16, borderRadius: raio.l, backgroundColor: cores.sorriso },
  sugestao: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  regras: { gap: 10, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
  aceite: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: raio.l, borderWidth: 1.5, borderColor: cores.borda, backgroundColor: cores.superficie },
});
