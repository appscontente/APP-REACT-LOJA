// Conversas com a loja: substitui os botões de WhatsApp. O cliente escolhe com quem falar (atendimento do site ou uma
// loja física) e acompanha todas as conversas aqui.

import { Ionicons } from '@expo/vector-icons';
import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Botao } from '@/componentes/botao';
import { Aviso } from '@/componentes/estado-tela';
import { Texto } from '@/componentes/texto';
import { formatarQuando, useConversas, type Conversa } from '@/estado/conversas';
import { useFigital } from '@/estado/figital';
import { cores, raio } from '@/lib/tema';

const ultimaEm = (c: Conversa) => c.mensagens.at(-1)?.em ?? '';

export default function Conversas() {
  const { conversas } = useConversas();
  const [nova, setNova] = useState(false);
  const baixo = useSafeAreaInsets().bottom;
  // Conversa aberta e deixada sem nenhuma mensagem não entra na lista; a que recebeu mensagem por último fica no topo.
  const lista = conversas.filter((c) => c.mensagens.length).sort((a, b) => ultimaEm(b).localeCompare(ultimaEm(a)));
  return (
    <>
      <Stack.Screen options={{ title: 'Conversas' }} />
      <ScrollView contentContainerStyle={[estilos.conteudo, { paddingBottom: 120 + baixo }]}>
        {!lista.length ? (
          <Aviso
            titulo="Fale com a gente por aqui"
            texto="Tire dúvidas sobre medidas, entrega e garantia com um vendedor, sem sair do app."
          />
        ) : (
          lista.map((c) => {
            const ultima = c.mensagens.at(-1);
            const nova = ultima?.de === 'loja' && (!c.lidaEm || ultima.em > c.lidaEm);
            return (
              <Pressable key={c.id} style={estilos.conversa} onPress={() => router.push(`/conversas/${c.id}`)}>
                <View style={estilos.avatar}>
                  <Ionicons name={c.loja ? 'storefront' : 'chatbubbles'} size={20} color="#fff" />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Texto variante="forte">{c.loja ? `Loja ${c.nomeLoja}` : c.nomeLoja}</Texto>
                    {ultima ? (
                      <Texto variante="pequeno" cor={cores.textoSuave}>
                        {formatarQuando(ultima.em)}
                      </Texto>
                    ) : null}
                  </View>
                  <Texto variante="pequeno" cor={cores.textoSuave} numberOfLines={1}>
                    {c.assunto}
                  </Texto>
                  <Texto variante={nova ? 'forte' : 'pequeno'} numberOfLines={1}>
                    {ultima?.texto ?? (ultima?.produto ? `Produto: ${ultima.produto.nome}` : 'Escreva sua mensagem')}
                  </Texto>
                </View>
                {nova ? <View style={estilos.ponto} /> : null}
              </Pressable>
            );
          })
        )}
        <Botao titulo="Nova conversa" icone={<Ionicons name="add" size={20} color="#fff" />} onPress={() => setNova(true)} />
      </ScrollView>
      <GavetaNovaConversa aberta={nova} fechar={() => setNova(false)} />
    </>
  );
}

function GavetaNovaConversa({ aberta, fechar }: { aberta: boolean; fechar: () => void }) {
  const { iniciar } = useConversas();
  const { lojas, lojaAtual } = useFigital();
  const baixo = useSafeAreaInsets().bottom;
  const abrir = (loja?: string, nomeLoja = 'Casa Contente') => {
    const id = iniciar({ loja, nomeLoja, assunto: loja ? 'Dúvida na loja' : 'Atendimento do site e do app' });
    fechar();
    router.push(`/conversas/${id}`);
  };
  const ordem = lojaAtual ? [lojaAtual, ...lojas.filter((l) => l.slug !== lojaAtual.slug)] : lojas;
  return (
    <Modal visible={aberta} transparent animationType="slide" onRequestClose={fechar}>
      <Pressable style={estilos.fundo} onPress={fechar} />
      <View style={[estilos.gaveta, { paddingBottom: baixo + 24 }]}>
        <Texto variante="subtitulo">Com quem você quer falar?</Texto>
        <Pressable style={estilos.destino} onPress={() => abrir()}>
          <Ionicons name="chatbubbles-outline" size={22} color={cores.marca} />
          <View style={{ flex: 1 }}>
            <Texto variante="forte">Atendimento do site e do app</Texto>
            <Texto variante="pequeno" cor={cores.textoSuave}>
              Pedidos, entrega, troca e pagamento
            </Texto>
          </View>
        </Pressable>
        {ordem.map((l) => (
          <Pressable key={l.slug} style={estilos.destino} onPress={() => abrir(l.slug, l.nome)}>
            <Ionicons name="storefront-outline" size={22} color={cores.marca} />
            <View style={{ flex: 1 }}>
              <Texto variante="forte">Vendedores da loja {l.nome}</Texto>
              <Texto variante="pequeno" cor={cores.textoSuave} numberOfLines={1}>
                {l.horario ?? l.endereco}
              </Texto>
            </View>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

const estilos = StyleSheet.create({
  conteudo: { padding: 16, gap: 10 },
  conversa: { flexDirection: 'row', gap: 12, alignItems: 'center', padding: 14, borderRadius: raio.l, backgroundColor: cores.superficie, borderWidth: 1, borderColor: cores.borda },
  avatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: cores.marca, alignItems: 'center', justifyContent: 'center' },
  ponto: { width: 10, height: 10, borderRadius: 5, backgroundColor: cores.marca },
  fundo: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)' },
  gaveta: { backgroundColor: cores.superficie, padding: 24, gap: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  destino: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: raio.l, borderWidth: 1, borderColor: cores.borda },
});
