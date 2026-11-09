// Destino da sobra de uma troca por produto mais barato (regulamento v4, 8.2; ação destinar_excedente do Happy): passar
// para outro cofrinho do cliente, receber de volta ou guardar como crédito na loja, podendo dividir entre os três. Nada
// é transferido sem a escolha do cliente; a tela fica registrada no extrato.

import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Botao } from '@/componentes/botao';
import { Campo } from '@/componentes/campo';
import { Aviso } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { contas, useCofrinho } from '@/estado/cofrinho';
import { lerReais } from '@/lib/cofrinho';
import { arredondar, formatarPreco, nomeLegivel } from '@/lib/formatar';
import { cores, raio } from '@/lib/tema';

const reais = (v: number) => (v > 0 ? v.toFixed(2).replace('.', ',') : '');
const valor = (t: string) => {
  const v = lerReais(t);
  return Number.isFinite(v) && v > 0 ? arredondar(v) : 0;
};

export default function DestinoDaSobra() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { buscar, ativos, destinarExcedente } = useCofrinho();
  const c = buscar(id);
  const outros = ativos.filter((x) => x.id !== id && contas(x).falta > 0);
  const [para, setPara] = useState(outros[0]?.id);
  const [transferir, setTransferir] = useState('');
  const [devolver, setDevolver] = useState('');
  const [guardar, setGuardar] = useState(() => reais(c?.excedente ?? 0));

  if (!c?.excedente) return <Aviso titulo="Nada a distribuir" texto="Este cofrinho não tem sobra esperando a sua escolha." acao="Voltar ao cofrinho" aoTocar={() => router.back()} />;
  const sobra = c.excedente;
  const destino = outros.find((x) => x.id === para);
  const limiteTransferencia = destino ? contas(destino).falta : 0;
  const partes = { transferir: valor(transferir), devolver: valor(devolver), guardar: valor(guardar) };
  const soma = arredondar(partes.transferir + partes.devolver + partes.guardar);
  const erro =
    partes.transferir > limiteTransferencia
      ? destino
        ? `O ${destino.id} precisa só de ${formatarPreco(limiteTransferencia)}.`
        : 'Você não tem outro cofrinho para receber a sobra.'
      : soma !== sobra
        ? `Distribua exatamente ${formatarPreco(sobra)} (agora: ${formatarPreco(soma)}).`
        : undefined;

  return (
    <ScrollView contentContainerStyle={estilos.conteudo} automaticallyAdjustKeyboardInsets keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">
      <View style={estilos.topo}>
        <Texto variante="rotulo">Sobra da troca</Texto>
        <Texto variante="titulo">{formatarPreco(sobra)}</Texto>
        <Texto variante="pequeno">Escolha para onde vai. Pode dividir entre as opções.</Texto>
      </View>

      <View style={estilos.opcao}>
        <Texto variante="forte">Passar para outro cofrinho</Texto>
        {outros.length ? (
          <>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {outros.map((x) => (
                <Pressable
                  key={x.id}
                  onPress={() => setPara(x.id)}
                  style={[estilos.chip, para === x.id && estilos.chipMarcado]}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: para === x.id }}>
                  <Texto variante="rotulo">
                    {x.id} · {nomeLegivel(x.item.nome).slice(0, 24)}
                  </Texto>
                </Pressable>
              ))}
            </View>
            <Campo rotulo="Quanto passar (R$)" value={transferir} onChangeText={(t) => setTransferir(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" />
          </>
        ) : (
          <Texto variante="pequeno" cor={cores.textoSuave}>
            Você não tem outro cofrinho ativo com valor a completar.
          </Texto>
        )}
      </View>
      <View style={estilos.opcao}>
        <Texto variante="forte">Receber de volta</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Pelo mesmo meio de pagamento, em até 5 dias úteis.
        </Texto>
        <Campo rotulo="Quanto receber (R$)" value={devolver} onChangeText={(t) => setDevolver(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" />
      </View>
      <View style={estilos.opcao}>
        <Texto variante="forte">Guardar como crédito na loja</Texto>
        <Texto variante="pequeno" cor={cores.textoSuave}>
          Paga qualquer compra da Casa Contente, e você pode pedir de volta depois.
        </Texto>
        <Campo rotulo="Quanto guardar (R$)" value={guardar} onChangeText={(t) => setGuardar(t.replace(/[^\d,.]/g, ''))} keyboardType="decimal-pad" placeholder="0,00" />
      </View>

      {erro ? (
        <Texto variante="pequeno" cor={cores.aviso}>
          {erro}
        </Texto>
      ) : null}
      <Botao
        titulo="Confirmar o destino"
        disabled={Boolean(erro)}
        onPress={() => {
          destinarExcedente(c.id, {
            ...(partes.transferir > 0 && para && { transferir: { valor: partes.transferir, para } }),
            ...(partes.devolver > 0 && { devolver: partes.devolver }),
            ...(partes.guardar > 0 && { guardar: partes.guardar }),
          });
          if (router.canGoBack()) router.back();
          else router.replace({ pathname: '/cofrinho/[id]', params: { id: c.id } });
        }}
      />
    </ScrollView>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 14, paddingBottom: 140 },
  topo: { gap: 2, padding: 16, borderRadius: raio.l, backgroundColor: cores.sorriso },
  opcao: { gap: 8, padding: 14, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda, backgroundColor: cores.superficie },
  chip: { paddingHorizontal: 12, minHeight: 36, justifyContent: 'center', borderRadius: raio.pilula, borderWidth: 1.5, borderColor: cores.borda },
  chipMarcado: { borderColor: cores.marca, backgroundColor: cores.creme },
});
