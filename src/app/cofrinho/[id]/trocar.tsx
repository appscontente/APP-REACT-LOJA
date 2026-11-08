// Trocar o produto de um Cofrinho Contente. Sem devolução em dinheiro: quem desiste do produto troca por outro, e o
// saldo inteiro vai junto. Por escolha, o produto novo entra pelo preço à vista do dia, garantido até o fim do prazo
// que o cofrinho já tinha; quando o produto esgotou, a garantia recomeça (termos, item 9). Se o novo custar menos que o
// saldo, o cliente escolhe mais produtos para completar.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Aviso, Carregando } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { contas, useCofrinho, type ItemCofrinho } from '@/estado/cofrinho';
import { api, ErroApi } from '@/lib/api';
import { garantiaDaTroca } from '@/lib/cofrinho';
import { arredondar, formatarPreco, nomeLegivel, precoPix } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { CardProduto } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function TrocarProduto() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { buscar, trocar } = useCofrinho();
  const c = buscar(id);
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [escolhidos, setEscolhidos] = useState<ItemCofrinho[]>([]);
  const [conferindo, setConferindo] = useState<string>();
  const { dados: regras } = useDados(() => api.regrasCofrinho(), []);
  // O produto atual ainda está à venda? Se esgotou, a troca é "porque esgotou" e a garantia recomeça.
  const { dados: atuais } = useDados(() => (c ? Promise.all(c.itens.map((i) => api.simularCofrinho({ slug: i.slug }).catch(() => undefined))) : Promise.resolve([])), [c?.id]);
  const { dados: resultado, carregando } = useDados(() => (busca.length >= 2 ? api.busca(busca) : Promise.resolve(undefined)), [busca]);

  if (!c || c.situacao !== 'aberto') return <Aviso titulo="Cofrinho fechado" texto="Só cofrinhos abertos trocam de produto." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} />;
  if (!regras || !atuais) return <Carregando />;
  const esgotou = atuais.some((s) => !s || !s.elegivel.pode);
  const motivo = esgotou ? 'esgotado' : 'escolha';
  const { saldo } = contas(c);
  const totalEscolhido = arredondar(escolhidos.reduce((s, i) => s + i.precoGarantido, 0));
  const sobra = arredondar(saldo - totalEscolhido);

  const escolher = async (p: CardProduto) => {
    if (escolhidos.some((e) => e.codprod === p.codprod) || c.itens.some((i) => i.codprod === p.codprod)) return;
    setConferindo(p.codprod);
    try {
      const sim = await api.simularCofrinho({ slug: p.slug });
      if (!sim.elegivel.pode) return Alert.alert('Este produto não entra no cofrinho', sim.elegivel.motivo);
      setEscolhidos((lista) => [...lista, { codprod: p.codprod, slug: p.slug, nome: p.nome, imagem: p.imagem, precoGarantido: sim.precoGarantido }]);
    } catch (e) {
      Alert.alert('Não deu para conferir agora', e instanceof ErroApi ? e.message : 'Tente de novo.');
    } finally {
      setConferindo(undefined);
    }
  };

  const confirmar = () => {
    const garantia = garantiaDaTroca(motivo, c.garantidoAte, regras.regras);
    Alert.alert(
      'Confirmar a troca?',
      `${escolhidos.map((e) => nomeLegivel(e.nome)).join(', ')} por ${formatarPreco(totalEscolhido)} à vista. ${
        motivo === 'esgotado' ? 'Como o produto esgotou, o preço novo fica garantido por mais 90 dias.' : 'O preço fica garantido até o fim do prazo que o cofrinho já tinha.'
      } O saldo de ${formatarPreco(saldo)} vai junto.`,
      [
        { text: 'Voltar', style: 'cancel' },
        {
          text: 'Trocar',
          onPress: () => {
            trocar(c.id, escolhidos, motivo, garantia);
            router.back();
          },
        },
      ],
    );
  };

  const lista = (resultado?.produtos ?? []).filter((p) => p.tipo !== 'conjunto');
  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={[estilos.caixa, esgotou && { backgroundColor: cores.avisoFundo }]}>
        <Texto variante="pequeno" cor={esgotou ? cores.aviso : cores.texto}>
          {esgotou
            ? 'O produto do seu cofrinho esgotou. Você pode esperar a reposição (o preço garantido continua) ou trocar: o produto novo ganha 90 dias de preço garantido.'
            : 'Troque por qualquer produto que entre no cofrinho. Ele entra pelo preço à vista de hoje, garantido até o fim do prazo atual. O saldo vai junto; não há devolução em dinheiro.'}
        </Texto>
      </View>

      <TextInput
        value={termo}
        onChangeText={setTermo}
        onSubmitEditing={() => setBusca(termo.trim())}
        returnKeyType="search"
        placeholder="Buscar o produto novo"
        style={estilos.busca}
        accessibilityLabel="Buscar o produto novo"
      />

      {escolhidos.length ? (
        <View style={{ gap: 8 }}>
          <Texto variante="subtitulo">Escolhidos</Texto>
          {escolhidos.map((e) => (
            <View key={e.codprod} style={estilos.item}>
              <Texto style={{ flex: 1 }}>{nomeLegivel(e.nome)}</Texto>
              <Texto variante="forte">{formatarPreco(e.precoGarantido)}</Texto>
              <Pressable onPress={() => setEscolhidos((l) => l.filter((x) => x.codprod !== e.codprod))} hitSlop={10} accessibilityLabel={`Tirar ${nomeLegivel(e.nome)}`}>
                <Ionicons name="close-circle" size={22} color={cores.textoSuave} />
              </Pressable>
            </View>
          ))}
          <Texto variante="pequeno" cor={sobra > 0 ? cores.aviso : cores.textoSuave}>
            {sobra > 0
              ? `Seu saldo é ${formatarPreco(saldo)}: sobram ${formatarPreco(sobra)}. Escolha mais um produto para usar tudo.`
              : sobra < 0
                ? `Faltam ${formatarPreco(-sobra)}: é só continuar depositando.`
                : 'O saldo cobre exatamente a troca.'}
          </Texto>
          <Botao titulo="Trocar" disabled={sobra > 0} onPress={confirmar} />
        </View>
      ) : null}

      {carregando && busca ? <Carregando /> : null}
      {lista.map((p) => (
        <Pressable key={p.codprod} onPress={() => escolher(p)} style={estilos.item} accessibilityRole="button" accessibilityLabel={`Escolher ${nomeLegivel(p.nome)}`}>
          <Imagem uri={p.imagem} style={estilos.foto} contentFit="contain" />
          <View style={{ flex: 1 }}>
            <Texto numberOfLines={2}>{nomeLegivel(p.nome)}</Texto>
            <Texto variante="forte">{formatarPreco(precoPix(p.preco, p.descontoPix))} à vista</Texto>
          </View>
          {conferindo === p.codprod ? <Texto variante="pequeno">conferindo…</Texto> : <Ionicons name="add-circle-outline" size={24} color={cores.marca} />}
        </Pressable>
      ))}
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 14, paddingBottom: 140 },
  caixa: { padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt },
  busca: { borderWidth: 1.5, borderColor: cores.borda, borderRadius: raio.pilula, minHeight: 48, paddingHorizontal: 18, fontSize: 16, backgroundColor: cores.superficie, color: cores.texto },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  foto: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: cores.fundoAlt },
});
