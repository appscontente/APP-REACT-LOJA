import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';

import { formatarDataHora } from '@/lib/formatar';
import { ROTULO_ETAPA } from '@/lib/pedidos';
import { cores } from '@/lib/tema';
import type { PassoPedido } from '@/lib/tipos';
import { Texto } from './texto';

const BOLINHA = 22;

/**
 * Etapas do pedido em lista vertical, como na área do cliente do site: bolinha preenchida (verde, com o visto) no que
 * já aconteceu, destacada em vermelho na etapa atual e vazia no que falta; a linha entre elas fica verde até onde o
 * pedido chegou. Cada passo é um só elemento para o leitor de tela ("Concluído: Nota emitida em 12/11/2026, 10:30").
 */
export function LinhaDoTempo({ passos }: { passos: PassoPedido[] }) {
  return (
    <View accessibilityRole="list">
      {passos.map((p, i) => {
        const ultimo = i === passos.length - 1;
        const cancelado = p.etapa === 'cancelado';
        const destaque = p.atual || cancelado;
        const rotulo = ROTULO_ETAPA[p.etapa];
        const quando = p.quando ? formatarDataHora(p.quando) : undefined;
        const complemento = [quando, p.detalhe].filter(Boolean).join(' · ');
        const estado = p.atual ? 'Etapa atual' : p.feito ? 'Concluído' : 'Próxima etapa';
        const leitura = `${estado}: ${rotulo}${quando ? ` em ${quando}` : ''}${p.detalhe ? `. ${p.detalhe}` : ''}`;
        return (
          <View key={`${p.etapa}-${i}`} style={estilos.passo} accessible accessibilityLabel={leitura}>
            <View style={estilos.coluna}>
              <View style={[estilos.halo, destaque && estilos.haloAtual]}>
                <View style={[estilos.bolinha, destaque ? estilos.bolinhaAtual : p.feito ? estilos.bolinhaFeita : estilos.bolinhaFutura]}>
                  {p.feito ? <Ionicons name={cancelado ? 'close' : 'checkmark'} size={14} color="#fff" /> : null}
                </View>
              </View>
              {ultimo ? null : <View style={[estilos.linha, passos[i + 1].feito && estilos.linhaFeita]} />}
            </View>
            <View style={[estilos.conteudo, ultimo && { paddingBottom: 0 }]}>
              <Texto variante={p.atual ? 'forte' : 'corpo'} cor={p.feito ? cores.texto : cores.textoSuave}>
                {rotulo}
              </Texto>
              {complemento ? (
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  {complemento}
                </Texto>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const estilos = StyleSheet.create({
  passo: { flexDirection: 'row', gap: 12 },
  coluna: { width: 30, alignItems: 'center' },
  halo: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  haloAtual: { backgroundColor: 'rgba(215, 25, 33, 0.16)' },
  bolinha: { width: BOLINHA, height: BOLINHA, borderRadius: BOLINHA / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  bolinhaFeita: { backgroundColor: cores.sucesso, borderColor: cores.sucesso },
  bolinhaAtual: { backgroundColor: cores.marca, borderColor: cores.marca },
  bolinhaFutura: { backgroundColor: cores.superficie, borderColor: cores.borda },
  linha: { flex: 1, width: 2, backgroundColor: cores.borda, marginVertical: 2 },
  linhaFeita: { backgroundColor: cores.sucesso },
  conteudo: { flex: 1, paddingTop: 4, paddingBottom: 18, gap: 2 },
});
