// Trocar o produto de um Cofrinho Contente (regulamento v4, 8): por qualquer produto da seleção, inclusive mais barato,
// pelo preço à vista do dia, com o frete e a montagem do novo produto para o mesmo endereço. O que sobrar, o cliente
// escolhe o destino na tela seguinte (outro cofrinho, devolução ou crédito). `?motivo=falha` quando o produto faltou.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Aviso, Carregando } from '@/componentes/estado-tela';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { ativo, contas, useCofrinho } from '@/estado/cofrinho';
import { api, ErroApi } from '@/lib/api';
import { arredondar, formatarPreco, nomeLegivel, precoPix } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';
import type { CardProduto, SimulacaoCofrinho } from '@/lib/tipos';
import { useDados } from '@/lib/use-dados';

export default function TrocarProduto() {
  const { id, motivo } = useLocalSearchParams<{ id: string; motivo?: string }>();
  const { buscar, trocar } = useCofrinho();
  const c = buscar(id);
  const [termo, setTermo] = useState('');
  const [busca, setBusca] = useState('');
  const [escolhido, setEscolhido] = useState<SimulacaoCofrinho>();
  const [conferindo, setConferindo] = useState<string>();
  const [erro, setErro] = useState<string>();
  const { dados: resultado, carregando } = useDados(() => (busca.length >= 2 ? api.busca(busca) : Promise.resolve(undefined)), [busca]);

  if (!c || !ativo(c)) return <Aviso titulo="Cofrinho fechado" texto="Só cofrinhos ativos trocam de produto." acao="Ver meus cofrinhos" aoTocar={() => router.replace('/cofrinho')} />;
  const falha = motivo === 'falha' || c.situacao === 'em_falta';
  const { saldo } = contas(c);

  const escolher = async (p: CardProduto) => {
    if (p.codprod === c.item.codprod) return;
    setConferindo(p.codprod);
    setErro(undefined);
    try {
      const sim = await api.simularCofrinho({ slug: p.slug, cep: c.pedido.cep });
      if (!sim.elegivel.pode) return setErro(sim.elegivel.motivo);
      setEscolhido(sim);
    } catch (e) {
      setErro(e instanceof ErroApi ? e.message : 'Não deu para conferir agora. Tente de novo.');
    } finally {
      setConferindo(undefined);
    }
  };

  const novoAlvo = escolhido?.pedido ? arredondar(escolhido.precoGarantido + escolhido.pedido.frete.valor + escolhido.pedido.montagem.valor) : 0;
  const sobra = arredondar(saldo - novoAlvo);

  const confirmar = () => {
    if (!escolhido?.pedido) return;
    trocar(c.id, {
      item: { codprod: escolhido.produto.codprod, slug: escolhido.produto.slug, nome: escolhido.produto.nome, imagem: escolhido.produto.imagem },
      preco: escolhido.precoGarantido,
      pedido: {
        cep: c.pedido.cep,
        endereco: c.pedido.endereco,
        frete: escolhido.pedido.frete.valor,
        montagem: escolhido.pedido.montagem,
        prazoEntrega: escolhido.pedido.prazoEntrega,
        ...(escolhido.volumeM3 && { volumeM3: escolhido.volumeM3 }),
      },
      motivo: falha ? 'falha_fornecimento' : 'preferencia',
    });
    if (sobra > 0) router.replace({ pathname: '/cofrinho/[id]/sobra', params: { id: c.id } });
    else router.back();
  };

  const lista = (resultado?.produtos ?? []).filter((p) => p.tipo !== 'conjunto');
  return (
    <ScrollView contentContainerStyle={estilos.conteudo} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={[estilos.caixa, falha && { backgroundColor: cores.avisoFundo }]}>
        <Texto variante="pequeno" cor={falha ? cores.aviso : cores.texto}>
          {falha
            ? 'O produto do seu cofrinho faltou. Escolha um equivalente: ele entra pelo preço à vista de hoje e o que você guardou vai junto.'
            : 'Troque por qualquer produto da seleção, até por um mais barato. Ele entra pelo preço à vista de hoje, com o frete para o mesmo endereço. O que você guardou vai junto.'}
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
      {erro ? (
        <Texto variante="pequeno" cor={cores.aviso}>
          {erro}
        </Texto>
      ) : null}

      {escolhido?.pedido ? (
        <View style={estilos.resumo}>
          <Texto variante="forte">{nomeLegivel(escolhido.produto.nome)}</Texto>
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Preço {formatarPreco(escolhido.precoGarantido)} · frete {escolhido.pedido.frete.valor > 0 ? formatarPreco(escolhido.pedido.frete.valor) : 'grátis'} · {escolhido.pedido.montagem.texto}
          </Texto>
          <Texto variante="pequeno" cor={sobra > 0 ? cores.sucesso : cores.textoSuave}>
            {sobra > 0
              ? `Você já guardou ${formatarPreco(saldo)}: sobram ${formatarPreco(sobra)}. Na próxima tela, você escolhe o destino da sobra.`
              : sobra < 0
                ? `Faltam ${formatarPreco(-sobra)}: é só continuar guardando.`
                : 'O que você guardou cobre exatamente o produto novo.'}
          </Texto>
          <Botao titulo="Confirmar a troca" onPress={confirmar} />
          <Botao titulo="Escolher outro" variante="texto" onPress={() => setEscolhido(undefined)} />
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
  resumo: { gap: 6, padding: 14, borderRadius: raio.l, borderWidth: 1.5, borderColor: cores.marca, backgroundColor: cores.superficie },
  busca: { borderWidth: 1.5, borderColor: cores.borda, borderRadius: raio.pilula, minHeight: 48, paddingHorizontal: 18, fontSize: 16, backgroundColor: cores.superficie, color: cores.texto },
  item: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: raio.m, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  foto: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: cores.fundoAlt },
});
