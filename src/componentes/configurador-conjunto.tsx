// Monta o conjunto (cozinha modulada, cama box, mesa + cadeiras) no celular: combinações prontas, uma opção e a
// quantidade em cada parte, o preço com o desconto do conjunto e o botão de comprar. As regras são as de
// src/lib/conjuntos.ts (as mesmas do site e do backend, que recalcula tudo no pedido). Com `loja`, é a Figital: o
// estoque e a saída de cada peça vêm da loja e o conjunto vai para o carrinho da loja. Conjunto não entra no desconto
// do autoatendimento (o Happy responde motivo "conjunto"): nada disso aparece aqui.
//
// A página decide onde cada parte fica (a montagem no meio da rolagem; o botão e o aviso na barra fixa embaixo): por
// isso o componente entrega as partes para a função `children`, em vez de desenhar a página inteira.

import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { AccessibilityInfo, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useCarrinho } from '@/estado/carrinho';
import { calcularConjunto, escolhasDoPreset, itemCarrinhoDoConjunto, presetDasEscolhas, resumoPecas } from '@/lib/conjuntos';
import { arredondar, DESCONTO_PIX, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { rotaCarrinhoLoja } from '@/lib/rotas';
import { cores, raio } from '@/lib/tema';
import type { ConjuntoCompleto, EscolhaConjunto, LojaFisica, OrigemSaida, Pagamento, SlotConjunto } from '@/lib/tipos';
import { AvisoCarrinho } from './barra-compra';
import { Botao } from './botao';
import { Imagem } from './imagem';
import { Preco } from './preco';
import { Texto } from './texto';

/** Na loja, de onde sai cada peça (o cliente nunca vê quantidades). */
const TEXTO_SAIDA: Record<OrigemSaida, string> = {
  cd: 'Sai do centro de distribuição',
  loja: 'Sai da loja',
  'outra-loja': 'Sai de outra loja',
};
const AVISO_MOSTRUARIO = 'Peça de mostruário desta loja: confira com um atendente';

/** O que o configurador entrega para a página montar. */
export type PartesConfigurador = {
  /** Combinações prontas, as partes do conjunto e o bloco de preço. */
  montagem: ReactNode;
  /** Total dos conjuntos escolhidos (preço × quantidade), para o frete. Zero enquanto a montagem não serve. */
  total: number;
  /** Botão de comprar, para a barra fixa. */
  botao: ReactNode;
  /** Aviso "adicionado ao carrinho", para a barra fixa (nulo quando não há aviso). */
  aviso: ReactNode;
};

export function ConfiguradorConjunto({
  conjunto,
  pagamento,
  taxaPix,
  loja,
  entregavel = true,
  children,
}: {
  conjunto: ConjuntoCompleto;
  pagamento: Pagamento;
  /** Fração do desconto no Pix do conjunto (regra do admin); sem ela, a padrão. */
  taxaPix?: number;
  /** Figital: a loja onde o cliente está. O conjunto vai para o carrinho dela. */
  loja?: LojaFisica;
  /** Figital: false quando alguma peça não tem medidas de embalagem e o conjunto só pode ser finalizado no caixa. */
  entregavel?: boolean;
  children: (partes: PartesConfigurador) => ReactNode;
}) {
  const { adicionar, itens } = useCarrinho();
  const [escolhas, setEscolhas] = useState<EscolhaConjunto[]>(() => escolhasDoPreset(conjunto));
  const [quantidade, setQuantidade] = useState(1);
  const [aviso, setAviso] = useState<{ id: number; texto: string; limite?: boolean }>();
  const calculo = calcularConjunto(conjunto, escolhas);
  const preset = presetDasEscolhas(conjunto, escolhas);
  const semEstoque = !calculo.erros.length && calculo.estoque < 1;
  const soNoCaixa = Boolean(loja) && entregavel === false;
  const destino = loja?.slug ?? 'site';
  // Linha pronta para o carrinho; undefined quando a montagem não serve ou está sem estoque.
  const item = itemCarrinhoDoConjunto(
    conjunto,
    escolhas.filter((e) => e.quantidade > 0),
  );
  const total = item ? arredondar(calculo.total * quantidade) : 0;

  const recomecar = () => {
    setQuantidade(1);
    setAviso(undefined);
  };
  const escolherPreset = (id: string) => {
    const novas = escolhasDoPreset(conjunto, id);
    setEscolhas(novas);
    recomecar();
    const nome = conjunto.presets.find((p) => p.id === id)?.nome ?? 'Combinação';
    AccessibilityInfo.announceForAccessibility(`${nome}: ${formatarPreco(calcularConjunto(conjunto, novas).total)}`);
  };
  const mudar = (slot: SlotConjunto, mudanca: Partial<EscolhaConjunto>) => {
    recomecar();
    const base = escolhas.find((e) => e.slot === slot.id) ?? { slot: slot.id, codprod: slot.opcoes[0], quantidade: 0 };
    const novas = [...escolhas.filter((e) => e.slot !== slot.id), { ...base, ...mudanca }];
    setEscolhas(novas);
    // No iPhone a live region não existe: o leitor de tela ouve a conta nova, ou o que impede a combinação.
    const conta = calcularConjunto(conjunto, novas);
    AccessibilityInfo.announceForAccessibility(
      conta.erros[0] ?? (conta.estoque < 1 ? 'Esta combinação está indisponível no momento.' : formatarPreco(conta.total)),
    );
  };

  const avisar = (texto: string, limite?: boolean) => {
    setAviso({ id: Date.now(), texto, limite });
    AccessibilityInfo.announceForAccessibility(texto);
  };
  const comprar = () => {
    if (!item) return;
    // Nunca dizer o número: só que o carrinho já tem tudo o que está disponível desta combinação.
    const noCarrinho = itens(destino).find((i) => i.codprod === item.codprod && !i.indisponivel)?.quantidade ?? 0;
    if (noCarrinho >= item.estoque) return avisar('Você já tem no carrinho todas as unidades disponíveis desta combinação.', true);
    // A fração do Pix do conjunto vai na linha (sem ela os totais locais usariam a padrão). Na loja, vai também o
    // `entregavel`: o conjunto que só sai pelo caixa entra no carrinho da loja e fica fora do "Pagar pelo app", como o
    // produto avulso.
    adicionar({ ...item, descontoPix: taxaPix, ...(loja && { entregavel }) }, destino, quantidade);
    if (noCarrinho + quantidade > item.estoque) return avisar('Adicionamos só o que está disponível desta combinação.', true);
    avisar(loja ? 'Conjunto adicionado ao carrinho da loja' : 'Conjunto adicionado ao carrinho');
  };

  const montagem = (
    <View style={estilos.montagem}>
      {conjunto.presets.length > 0 ? (
        <View style={{ gap: 8 }}>
          <Texto variante="subtitulo" accessibilityRole="header">
            Combinações prontas
          </Texto>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={estilos.chips}>
            {conjunto.presets.map((p) => {
              const ativo = preset?.id === p.id;
              return (
                <Pressable
                  key={p.id}
                  onPress={() => escolherPreset(p.id)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: ativo }}
                  // No web o react-native-web ignora accessibilityState: aria-checked expõe a marcação também lá.
                  aria-checked={ativo}
                  style={[estilos.chip, ativo && estilos.chipAtivo]}>
                  <Texto variante="rotulo" cor={ativo ? cores.marca : cores.texto}>
                    {p.nome}
                  </Texto>
                </Pressable>
              );
            })}
          </ScrollView>
          {!preset ? (
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Você está montando do seu jeito.
            </Texto>
          ) : null}
        </View>
      ) : null}

      {conjunto.slots.map((slot) => (
        <Parte
          key={slot.id}
          slot={slot}
          conjunto={conjunto}
          escolha={escolhas.find((e) => e.slot === slot.id)}
          naLoja={Boolean(loja)}
          aoMudar={(mudanca) => mudar(slot, mudanca)}
        />
      ))}

      <View style={estilos.resumo}>
        {calculo.linhas.length ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Você leva: {resumoPecas(calculo.linhas.map((l) => ({ nome: nomeLegivel(l.nome), quantidade: l.quantidade })))}
          </Texto>
        ) : null}
        <Preco
          preco={calculo.total}
          precoDe={calculo.economia > 0 ? calculo.cheio : undefined}
          descontoPix={taxaPix}
          pagamento={pagamento}
          tamanho="pagina"
        />
        {loja && item ? (
          // Na loja o conjunto fica fora do desconto do autoatendimento (motivo "conjunto" do Happy); o Pix do site vale
          // pagando pelo app, e no caixa sai pelo preço do conjunto.
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Na loja, o conjunto não entra no desconto do autoatendimento: no caixa sai por {formatarPreco(calculo.total)}
            {(taxaPix ?? DESCONTO_PIX) > 0 ? '; o desconto do Pix vale pagando pelo app' : ''}.
          </Texto>
        ) : null}
        {calculo.economia > 0 ? (
          <Texto variante="rotulo" cor={cores.sucesso}>
            Você economiza {formatarPreco(calculo.economia)} com o desconto do conjunto ({Math.round(conjunto.desconto * 100)}%)
          </Texto>
        ) : null}
        {calculo.erros.map((erro) => (
          <Texto key={erro} variante="pequeno" cor={cores.marca} accessibilityLiveRegion="polite">
            {erro}
          </Texto>
        ))}
        {semEstoque ? (
          <Texto variante="forte" cor={cores.marca} accessibilityLiveRegion="polite">
            Esta combinação está indisponível no momento.
          </Texto>
        ) : null}
        {item && calculo.estoque > 1 ? (
          <View style={estilos.linhaPasso}>
            <Texto variante="rotulo">Quantos conjuntos?</Texto>
            <Passo valor={quantidade} min={1} max={calculo.estoque} rotulo="conjuntos" aoMudar={setQuantidade} />
            {quantidade >= calculo.estoque ? (
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Quantidade máxima disponível
              </Texto>
            ) : null}
          </View>
        ) : null}
        {item && quantidade > 1 ? (
          <Texto variante="forte">
            {quantidade} conjuntos: {formatarPreco(total)}
          </Texto>
        ) : null}
        {soNoCaixa ? (
          <Texto variante="pequeno" cor={cores.aviso}>
            Este conjunto só é finalizado no caixa da loja: entra no carrinho da loja, mas fica fora do “Pagar pelo app”.
          </Texto>
        ) : null}
      </View>
    </View>
  );

  const botao = <Botao titulo={loja ? 'Pôr no carrinho da loja' : 'Adicionar ao carrinho'} onPress={comprar} disabled={!item} />;

  const avisoNaBarra = aviso ? (
    <AvisoCarrinho
      key={aviso.id}
      texto={aviso.texto}
      limite={aviso.limite}
      aoVerCarrinho={() => {
        setAviso(undefined);
        // No site, volta às abas que já existem (push criaria outra cópia delas por cima da página).
        if (loja) router.push(rotaCarrinhoLoja(loja.slug) as never);
        else router.dismissTo('/carrinho');
      }}
      aoFechar={() => setAviso(undefined)}
    />
  ) : null;

  return children({ montagem, total, botao, aviso: avisoNaBarra });
}

/** Uma parte do conjunto (ex.: "Cadeiras"): as opções como cartões e, quando a faixa permite, a quantidade. */
function Parte({
  slot,
  conjunto,
  escolha,
  naLoja,
  aoMudar,
}: {
  slot: SlotConjunto;
  conjunto: ConjuntoCompleto;
  escolha?: EscolhaConjunto;
  naLoja: boolean;
  aoMudar: (mudanca: Partial<EscolhaConjunto>) => void;
}) {
  const qtd = escolha?.quantidade ?? 0;
  const fixa = slot.quantidadeMin === slot.quantidadeMax;
  const marcado = escolha?.codprod ?? slot.opcoes[0];
  const unica = slot.opcoes.length === 1;
  const faixa = fixa
    ? slot.quantidadeMin > 1
      ? `${slot.quantidadeMin} unidades`
      : ''
    : slot.quantidadeMin === 0
      ? `opcional · até ${slot.quantidadeMax}`
      : `de ${slot.quantidadeMin} a ${slot.quantidadeMax}`;
  return (
    <View style={estilos.parte}>
      <View style={estilos.cabecaParte}>
        <Texto variante="subtitulo" style={{ flex: 1 }} accessibilityRole="header">
          {slot.nome}
        </Texto>
        {faixa ? (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            {faixa}
          </Texto>
        ) : null}
      </View>
      <View style={{ gap: 8 }} accessibilityRole={unica ? undefined : 'radiogroup'}>
        {slot.opcoes.map((codprod) => {
          const c = conjunto.componentes[codprod];
          if (!c) return null;
          const esgotado = c.estoque < 1;
          // Parte opcional em "Não levar" (quantidade 0): nenhuma opção marcada; o toque numa opção volta a levar 1.
          const checked = marcado === codprod && qtd > 0;
          const nome = nomeLegivel(c.nome);
          const saida = naLoja && !esgotado && c.origemEstoque ? TEXTO_SAIDA[c.origemEstoque] : undefined;
          const mostruario = naLoja && c.aviso === 'peca-unica' ? AVISO_MOSTRUARIO : undefined;
          const rotulo = [nome, esgotado ? 'esgotado' : formatarPreco(c.preco), saida, mostruario].filter(Boolean).join(', ');
          const conteudo = (
            <>
              <Imagem uri={c.imagem} style={estilos.fotoOpcao} />
              <View style={{ flex: 1, gap: 2 }}>
                <Texto variante="rotulo" numberOfLines={2}>
                  {nome}
                </Texto>
                <Texto variante="pequeno" cor={esgotado ? cores.marca : cores.textoSuave}>
                  {esgotado ? 'Esgotado' : `${formatarPreco(c.preco)} cada`}
                </Texto>
                {saida ? (
                  <Texto variante="pequeno" cor={cores.textoSuave}>
                    {saida}
                  </Texto>
                ) : null}
                {mostruario ? (
                  <Texto variante="pequeno" cor={cores.aviso}>
                    {mostruario}
                  </Texto>
                ) : null}
              </View>
              {unica ? null : (
                <Ionicons name={checked ? 'radio-button-on' : 'radio-button-off'} size={22} color={checked ? cores.marca : cores.borda} />
              )}
            </>
          );
          // Parte com uma opção só: não há o que escolher, o cartão só informa.
          if (unica)
            return (
              <View key={codprod} style={[estilos.opcao, esgotado && estilos.apagada]} accessible accessibilityLabel={rotulo}>
                {conteudo}
              </View>
            );
          return (
            <Pressable
              key={codprod}
              onPress={() => aoMudar({ codprod, quantidade: qtd || Math.max(1, slot.quantidadeMin) })}
              disabled={esgotado}
              accessibilityRole="radio"
              accessibilityState={{ checked, disabled: esgotado }}
              aria-checked={checked}
              accessibilityLabel={rotulo}
              style={[estilos.opcao, checked && estilos.opcaoAtiva, esgotado && estilos.apagada]}>
              {conteudo}
            </Pressable>
          );
        })}
      </View>
      {!fixa ? (
        <View style={estilos.linhaPasso}>
          <Passo
            valor={qtd}
            min={slot.quantidadeMin}
            max={slot.quantidadeMax}
            rotulo={slot.nome.toLowerCase()}
            aoMudar={(quantidade) => aoMudar({ quantidade })}
          />
          {qtd === 0 ? (
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Não levar
            </Texto>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Passo de quantidade (− / +) dentro de uma faixa, com área de toque de 44 pt. */
function Passo({
  valor,
  min,
  max,
  rotulo,
  aoMudar,
}: {
  valor: number;
  min: number;
  max: number;
  rotulo: string;
  aoMudar: (valor: number) => void;
}) {
  const noMinimo = valor <= min;
  const noMaximo = valor >= max;
  const mudar = (novo: number) => {
    if (novo < min || novo > max) return;
    aoMudar(novo);
    AccessibilityInfo.announceForAccessibility(`${rotulo}: ${novo}`);
  };
  return (
    <View style={estilos.passo}>
      <Pressable
        onPress={() => mudar(valor - 1)}
        disabled={noMinimo}
        style={estilos.botaoPasso}
        accessibilityRole="button"
        accessibilityState={{ disabled: noMinimo }}
        accessibilityLabel={`Menos ${rotulo}`}>
        <Ionicons name="remove" size={18} color={noMinimo ? cores.borda : cores.texto} />
      </Pressable>
      <Texto variante="forte" style={{ minWidth: 28, textAlign: 'center' }} accessibilityLabel={`${rotulo}: ${valor}`}>
        {valor}
      </Texto>
      <Pressable
        onPress={() => mudar(valor + 1)}
        disabled={noMaximo}
        style={estilos.botaoPasso}
        accessibilityRole="button"
        accessibilityState={{ disabled: noMaximo }}
        accessibilityLabel={`Mais ${rotulo}`}>
        <Ionicons name="add" size={18} color={noMaximo ? cores.borda : cores.texto} />
      </Pressable>
    </View>
  );
}

const estilos = StyleSheet.create({
  montagem: { gap: 16 },
  chips: { gap: 8, paddingVertical: 2 },
  chip: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: raio.pilula,
    borderWidth: 1.5,
    borderColor: cores.borda,
    backgroundColor: cores.superficie,
  },
  chipAtivo: { borderColor: cores.marca, backgroundColor: cores.creme },
  parte: { gap: 10, padding: 12, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  cabecaParte: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  opcao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 8,
    minHeight: 56,
    borderRadius: raio.m,
    borderWidth: 1.5,
    borderColor: cores.borda,
  },
  opcaoAtiva: { borderColor: cores.marca, backgroundColor: cores.creme },
  apagada: { opacity: 0.55 },
  fotoOpcao: { width: 56, height: 56, borderRadius: raio.s, backgroundColor: '#fff' },
  linhaPasso: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  passo: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: cores.borda,
    borderRadius: raio.pilula,
    backgroundColor: cores.superficie,
  },
  // Área de toque de 44 pt (recomendação do iOS e do Android).
  botaoPasso: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  resumo: { gap: 10, padding: 14, borderRadius: raio.l, backgroundColor: cores.fundoAlt, borderWidth: 1, borderColor: cores.borda },
});
