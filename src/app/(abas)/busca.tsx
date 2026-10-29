// Busca em tela cheia, a mesma do site (sinônimos e correção): sugestões enquanto digita, buscas recentes e o leitor
// do QR da etiqueta ou do código de barras. Aceita /busca?q= vindo de um link do site.

import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso, Carregando } from '@/componentes/estado-tela';
import { GradeProdutos } from '@/componentes/grade-produtos';
import { Imagem } from '@/componentes/imagem';
import { Texto } from '@/componentes/texto';
import { api } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import { formatarPreco } from '@/lib/formatar';
import { cores, fontes, raio } from '@/lib/tema';
import type { ResultadoBusca } from '@/lib/tipos';

type Sugestoes = Awaited<ReturnType<typeof api.sugestoes>>;
const CHAVE_RECENTES = 'busca:recentes';

export default function Busca() {
  const topo = useSafeAreaInsets().top;
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [texto, setTexto] = useState(q ?? '');
  const [termo, setTermo] = useState(q ?? '');
  const [sugeridas, setSugeridas] = useState<{ texto: string; sugestoes: Sugestoes }>();
  const [buscado, setBuscado] = useState<{ termo: string; resultado: ResultadoBusca }>();
  const [recentes, setRecentes] = useState<string[]>([]);
  // Link aberto com outro ?q= (ex. banner): troca a busca sem esperar um efeito.
  const [qAnterior, setQAnterior] = useState(q);
  if (q !== qAnterior) {
    setQAnterior(q);
    if (q) {
      setTexto(q);
      setTermo(q);
    }
  }

  useEffect(() => {
    ler<string[]>(CHAVE_RECENTES, []).then(setRecentes);
  }, []);
  // Sugestões enquanto digita (espera o cliente parar um instante).
  useEffect(() => {
    if (texto.trim().length < 2 || texto === termo) return;
    const id = setTimeout(
      () =>
        api
          .sugestoes(texto.trim())
          .then((sugestoes) => setSugeridas({ texto, sugestoes }))
          .catch(() => undefined),
      250,
    );
    return () => clearTimeout(id);
  }, [texto, termo]);

  useEffect(() => {
    if (termo.trim().length < 2) return;
    let ativo = true;
    api
      .busca(termo.trim())
      .then((r) => {
        if (!ativo) return;
        if (r.redirecionar) router.push(r.redirecionar as never);
        setBuscado({ termo, resultado: r });
      })
      .catch(() => ativo && setBuscado({ termo, resultado: { produtos: [] } }));
    return () => {
      ativo = false;
    };
  }, [termo]);

  const buscar = (t: string) => {
    const limpo = t.trim();
    if (limpo.length < 2) return;
    setTexto(limpo);
    setTermo(limpo);
    const novos = [limpo, ...recentes.filter((r) => r.toLowerCase() !== limpo.toLowerCase())].slice(0, 8);
    setRecentes(novos);
    gravar(CHAVE_RECENTES, novos);
  };

  const sugestoes = texto !== termo && sugeridas?.texto === texto ? sugeridas.sugestoes : undefined;
  const termoValido = termo.trim().length >= 2;
  const resultado = termoValido && buscado?.termo === termo ? buscado.resultado : undefined;
  const buscando = termoValido && !resultado;

  return (
    <View style={[estilos.tela, { paddingTop: topo + 8 }]}>
      <View style={estilos.barra}>
        <Ionicons name="search" size={20} color={cores.textoSuave} />
        <TextInput
          value={texto}
          onChangeText={setTexto}
          onSubmitEditing={() => buscar(texto)}
          placeholder="Sofá, geladeira, guarda-roupa..."
          placeholderTextColor={cores.textoSuave}
          returnKeyType="search"
          autoCorrect={false}
          style={estilos.entrada}
          accessibilityLabel="Buscar produtos"
        />
        {texto ? (
          <Pressable onPress={() => (setTexto(''), setTermo(''))} hitSlop={8} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={20} color={cores.textoSuave} />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/leitor')} hitSlop={8} accessibilityLabel="Ler QR ou código de barras">
            <Ionicons name="scan-outline" size={22} color={cores.marca} />
          </Pressable>
        )}
      </View>

      {sugestoes && (sugestoes.produtos.length > 0 || sugestoes.categorias.length > 0) ? (
        <View style={estilos.sugestoes}>
          {sugestoes.categorias.map((c) => (
            <Pressable key={c.href} style={estilos.sugestao} onPress={() => router.push(c.href as never)}>
              <Ionicons name="grid-outline" size={18} color={cores.marca} />
              <Texto>{c.nome}</Texto>
            </Pressable>
          ))}
          {sugestoes.produtos.map((p) => (
            <Pressable key={p.href} style={estilos.sugestao} onPress={() => router.push(p.href as never)}>
              <Imagem uri={p.imagem} style={{ width: 40, height: 40 }} />
              <View style={{ flex: 1 }}>
                <Texto variante="rotulo" numberOfLines={1}>
                  {p.nome}
                </Texto>
                <Texto variante="pequeno" cor={cores.textoSuave}>
                  {formatarPreco(p.preco)}
                </Texto>
              </View>
            </Pressable>
          ))}
          <Pressable style={estilos.sugestao} onPress={() => buscar(texto)}>
            <Ionicons name="search" size={18} color={cores.marca} />
            <Texto variante="forte" cor={cores.marca}>
              Ver todos os resultados para “{texto.trim()}”
            </Texto>
          </Pressable>
        </View>
      ) : buscando ? (
        <Carregando />
      ) : resultado ? (
        <GradeProdutos
          produtos={resultado.produtos}
          cabecalho={
            <Texto cor={cores.textoSuave} style={{ paddingHorizontal: 16, paddingTop: 8 }}>
              {resultado.corrigido
                ? `Mostrando resultados para “${resultado.corrigido}”`
                : `${resultado.produtos.length} ${resultado.produtos.length === 1 ? 'produto' : 'produtos'} para “${termo}”`}
            </Texto>
          }
          vazio={
            <Aviso
              titulo="Não achamos nada com esse nome"
              texto="Tente outra palavra ou fale com a nossa equipe pela conversa do app."
              acao="Conversar com a loja"
              aoTocar={() => router.push('/conversas')}
              triste
            />
          }
        />
      ) : (
        <View style={estilos.recentes}>
          {recentes.length > 0 && (
            <>
              <Texto variante="subtitulo">Buscas recentes</Texto>
              <View style={estilos.fichas}>
                {recentes.map((r) => (
                  <Pressable key={r} style={estilos.ficha} onPress={() => buscar(r)}>
                    <Ionicons name="time-outline" size={14} color={cores.textoSuave} />
                    <Texto variante="pequeno">{r}</Texto>
                  </Pressable>
                ))}
              </View>
            </>
          )}
          <Pressable style={estilos.leitor} onPress={() => router.push('/leitor')}>
            <Ionicons name="qr-code" size={28} color={cores.marca} />
            <View style={{ flex: 1 }}>
              <Texto variante="forte">Está na loja?</Texto>
              <Texto variante="pequeno" cor={cores.textoSuave}>
                Leia o QR da etiqueta ou o código de barras do produto.
              </Texto>
            </View>
            <Ionicons name="chevron-forward" size={18} color={cores.textoSuave} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tela: { flex: 1, backgroundColor: cores.fundo },
  barra: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    paddingHorizontal: 16,
    height: 50,
    borderRadius: raio.pilula,
    backgroundColor: cores.superficie,
    borderWidth: 1.5,
    borderColor: cores.marca,
  },
  entrada: { flex: 1, fontFamily: fontes.textoMedio, fontSize: 16, color: cores.texto, height: '100%' },
  sugestoes: { marginTop: 8, backgroundColor: cores.superficie, borderTopWidth: 1, borderColor: cores.borda },
  sugestao: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: cores.borda,
  },
  recentes: { padding: 16, gap: 12 },
  fichas: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  ficha: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: raio.pilula,
    backgroundColor: cores.superficie,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  leitor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    marginTop: 12,
    borderRadius: raio.l,
    backgroundColor: cores.creme,
  },
});
