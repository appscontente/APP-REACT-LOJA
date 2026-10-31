// Busca em tela cheia, a mesma do site (sinônimos e correção): sugestões enquanto digita, buscas recentes e o leitor
// do QR da etiqueta ou do código de barras. Aceita /busca?q= vindo de um link do site e /busca?foco= (toque na busca do
// início: limpa e abre o teclado; o número muda a cada toque porque a aba fica montada).

import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aviso, Carregando, Erro } from '@/componentes/estado-tela';
import { GradeProdutos } from '@/componentes/grade-produtos';
import { Imagem } from '@/componentes/imagem';
import { FichasOrdenacao } from '@/componentes/tela-lista';
import { Texto } from '@/componentes/texto';
import { useConversas } from '@/estado/conversas';
import { api, ErroApi, SITE_URL } from '@/lib/api';
import { gravar, ler } from '@/lib/armazenamento';
import { formatarPreco } from '@/lib/formatar';
import { rotaInterna } from '@/lib/rotas';
import { cores, fontes, raio } from '@/lib/tema';
import type { ResultadoBusca } from '@/lib/tipos';

type Sugestoes = Awaited<ReturnType<typeof api.sugestoes>>;
/** Uma busca feita: o resultado ou o erro, com o termo, a ordenação e a vez que o pediram. */
type Buscado = { termo: string; ordenacao: string; vez: number; resultado?: ResultadoBusca; erro?: string };
const CHAVE_RECENTES = 'busca:recentes';

/** Destino que veio do site (atalho do admin ou sugestão): caminho nosso vira tela do app; outro endereço abre fora. */
function abrirDestino(destino: string) {
  const interna = rotaInterna(destino, SITE_URL);
  if (interna) router.push(interna as never);
  else if (/^https?:\/\//.test(destino)) WebBrowser.openBrowserAsync(destino);
}

export default function Busca() {
  const topo = useSafeAreaInsets().top;
  const { iniciar } = useConversas();
  const { q, foco } = useLocalSearchParams<{ q?: string; foco?: string }>();
  const campo = useRef<React.ComponentRef<typeof TextInput>>(null);
  const [texto, setTexto] = useState(q ?? '');
  const [termo, setTermo] = useState(q ?? '');
  const [ordenacao, setOrdenacao] = useState('relevancia');
  // Muda a cada busca e a cada "Tentar de novo": repetir o mesmo termo busca de novo.
  const [vez, setVez] = useState(0);
  const [sugeridas, setSugeridas] = useState<{ texto: string; sugestoes: Sugestoes }>();
  const [buscado, setBuscado] = useState<Buscado>();
  const [recentes, setRecentes] = useState<string[]>([]);
  // Link aberto com outro ?q= (ex. banner): troca a busca sem esperar um efeito.
  const [qAnterior, setQAnterior] = useState(q);
  if (q !== qAnterior) {
    setQAnterior(q);
    if (q) {
      setTexto(q);
      setTermo(q);
      setOrdenacao('relevancia');
    }
  }
  // Toque na busca do início: começa do zero (o foco no campo vem no efeito abaixo).
  const [focoAnterior, setFocoAnterior] = useState(foco);
  if (foco !== focoAnterior) {
    setFocoAnterior(foco);
    if (foco) {
      setTexto('');
      setTermo('');
    }
  }

  useEffect(() => {
    if (foco) campo.current?.focus();
  }, [foco]);

  // Relê ao voltar para a aba: depois de "Sair da conta" as buscas recentes somem também daqui.
  useFocusEffect(
    useCallback(() => {
      ler<string[]>(CHAVE_RECENTES, []).then(setRecentes);
    }, []),
  );
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
      .busca(termo.trim(), ordenacao === 'relevancia' ? undefined : ordenacao)
      .then((r) => {
        if (!ativo) return;
        if (r.redirecionar) {
          // Atalho do admin (ex. "black friday" => /ofertas): abre a página e não guarda resultado vazio.
          abrirDestino(r.redirecionar);
          setTexto('');
          setTermo('');
          setBuscado(undefined);
          return;
        }
        setBuscado({ termo, ordenacao, vez, resultado: r });
      })
      .catch(
        (e) =>
          ativo &&
          setBuscado({ termo, ordenacao, vez, erro: e instanceof ErroApi ? e.message : 'Não conseguimos buscar agora. Tente de novo.' }),
      );
    return () => {
      ativo = false;
    };
  }, [termo, ordenacao, vez]);

  const buscar = (t: string) => {
    const limpo = t.trim();
    if (limpo.length < 2) return;
    setTexto(limpo);
    setTermo(limpo);
    setOrdenacao('relevancia');
    setVez((v) => v + 1);
    const novos = [limpo, ...recentes.filter((r) => r.toLowerCase() !== limpo.toLowerCase())].slice(0, 8);
    setRecentes(novos);
    gravar(CHAVE_RECENTES, novos);
  };
  const limpar = () => {
    setTexto('');
    setTermo('');
    campo.current?.focus();
  };
  const tentarDeNovo = () => setVez((v) => v + 1);
  // Sem resultado: abre a conversa com a loja já com o que o cliente procurou.
  const conversar = () => {
    const id = iniciar({ nomeLoja: 'Casa Contente', assunto: `Produto que não achei: “${termo.trim()}”` });
    router.push(`/conversas/${id}` as never);
  };

  const sugestoes = texto !== termo && sugeridas?.texto === texto ? sugeridas.sugestoes : undefined;
  const termoValido = termo.trim().length >= 2;
  const atual = termoValido && buscado?.termo === termo && buscado.ordenacao === ordenacao && buscado.vez === vez ? buscado : undefined;
  const resultado = atual?.resultado;
  const buscando = termoValido && !atual;

  return (
    <View style={[estilos.tela, { paddingTop: topo + 8 }]}>
      <View style={estilos.barra}>
        <Ionicons name="search" size={20} color={cores.textoSuave} />
        <TextInput
          ref={campo}
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
          <Pressable onPress={limpar} hitSlop={8} accessibilityLabel="Limpar busca">
            <Ionicons name="close-circle" size={20} color={cores.textoSuave} />
          </Pressable>
        ) : (
          <Pressable onPress={() => router.push('/leitor')} hitSlop={8} accessibilityLabel="Ler QR ou código de barras">
            <Ionicons name="scan-outline" size={22} color={cores.marca} />
          </Pressable>
        )}
      </View>

      {sugestoes && (sugestoes.produtos.length > 0 || sugestoes.categorias.length > 0) ? (
        <ScrollView style={estilos.rolagem} contentContainerStyle={estilos.sugestoes} keyboardShouldPersistTaps="handled">
          {sugestoes.categorias.map((c) => (
            <Pressable key={c.href} style={estilos.sugestao} onPress={() => abrirDestino(c.href)}>
              <Ionicons name="grid-outline" size={18} color={cores.marca} />
              <Texto>{c.nome}</Texto>
            </Pressable>
          ))}
          {sugestoes.produtos.map((p) => (
            <Pressable key={p.href} style={estilos.sugestao} onPress={() => abrirDestino(p.href)}>
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
        </ScrollView>
      ) : buscando ? (
        <Carregando />
      ) : atual?.erro ? (
        <Erro mensagem={atual.erro} tentar={tentarDeNovo} />
      ) : resultado ? (
        <GradeProdutos
          produtos={resultado.produtos}
          cabecalho={
            <View style={estilos.cabecalho}>
              <Texto cor={cores.textoSuave} style={{ paddingHorizontal: 16 }}>
                {resultado.corrigido
                  ? `Mostrando resultados para “${resultado.corrigido}”`
                  : `${resultado.produtos.length} ${resultado.produtos.length === 1 ? 'produto' : 'produtos'} para “${termo}”`}
              </Texto>
              {resultado.produtos.length > 1 ? <FichasOrdenacao ativa={ordenacao} aoEscolher={setOrdenacao} /> : null}
            </View>
          }
          vazio={
            <Aviso
              titulo="Não achamos nada com esse nome"
              texto="Tente outra palavra ou fale com a nossa equipe pela conversa do app."
              acao="Conversar com a loja"
              aoTocar={conversar}
              triste
            />
          }
        />
      ) : (
        <ScrollView contentContainerStyle={estilos.recentes} keyboardShouldPersistTaps="handled">
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
        </ScrollView>
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
  rolagem: { flex: 1, marginTop: 8 },
  sugestoes: { backgroundColor: cores.superficie, borderTopWidth: 1, borderColor: cores.borda },
  cabecalho: { gap: 8, paddingTop: 8 },
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
