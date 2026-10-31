// Endereços do app iguais aos do site (loja/src/lib/rotas.ts): um link do site compartilhado no WhatsApp abre a tela
// de mesmo caminho no app, sem tradução.

export const rotaProduto = (p: { slug: string }) => `/${p.slug}/p`;
export const rotaDepartamento = (departamento: string) => `/${departamento}`;
export const rotaCategoria = (departamento: string, categoria: string) => `/${departamento}/${categoria}`;
export const rotaBusca = (termo: string) => `/busca?q=${encodeURIComponent(termo)}`;
export const rotaLoja = (loja: string) => `/loja/${loja}`;
export const rotaFigital = (loja: string, slug: string) => `/loja/${loja}/p/${slug}`;
export const rotaCarrinhoLoja = (loja: string) => `/loja/${loja}/carrinho`;

/** Domínios do site, além do host de EXPO_PUBLIC_SITE_URL: etiquetas e cartazes impressos com o endereço do Render
 * continuam abrindo no app depois da troca para www.casacontente.com.br. */
const NOSSOS = ['casacontente.com.br', 'www.casacontente.com.br', 'loja-casacontente.onrender.com'];

/** Caminho que o expo-router trata como link de fora ("//golpe.com" ou "/\\golpe.com") não é nosso. */
const caminhoSeguro = (caminho: string) => (caminho.startsWith('/') && !/^\/[/\\]/.test(caminho) ? caminho : undefined);

/**
 * Link de banner ou de mensagem: caminho do site vira tela do app; endereço de outro domínio abre fora.
 * Devolve undefined para o que não é do site.
 */
export function rotaInterna(link: string, siteUrl: string): string | undefined {
  if (link.startsWith('/')) return caminhoSeguro(link);
  try {
    const url = new URL(link);
    const site = new URL(siteUrl);
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined;
    return [site.host, ...NOSSOS].includes(url.host) ? caminhoSeguro(`${url.pathname}${url.search}`) : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Caminho com a query que veio no link (ex. ?token= do descadastro de e-mail), sem os parâmetros que são pedaços do
 * próprio caminho. Para abrir no site uma página que o app não tem.
 */
export function caminhoComQuery(caminho: string, params: Record<string, string | string[] | undefined>, tirar: string[] = []) {
  const busca = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (chave === '#' || tirar.includes(chave) || valor === undefined) continue;
    for (const v of Array.isArray(valor) ? valor : [valor]) busca.append(chave, v);
  }
  const query = busca.toString();
  return query ? `${caminho}?${query}` : caminho;
}
