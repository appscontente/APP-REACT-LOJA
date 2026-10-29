// Endereços do app iguais aos do site (loja/src/lib/rotas.ts): um link do site compartilhado no WhatsApp abre a tela
// de mesmo caminho no app, sem tradução.

export const rotaProduto = (p: { slug: string }) => `/${p.slug}/p`;
export const rotaDepartamento = (departamento: string) => `/${departamento}`;
export const rotaCategoria = (departamento: string, categoria: string) => `/${departamento}/${categoria}`;
export const rotaBusca = (termo: string) => `/busca?q=${encodeURIComponent(termo)}`;
export const rotaLoja = (loja: string) => `/loja/${loja}`;
export const rotaFigital = (loja: string, slug: string) => `/loja/${loja}/p/${slug}`;
export const rotaCarrinhoLoja = (loja: string) => `/loja/${loja}/carrinho`;

/**
 * Link de banner ou de mensagem: caminho do site vira tela do app; endereço de outro domínio abre fora.
 * Devolve undefined para o que não é do site.
 */
export function rotaInterna(link: string, siteUrl: string): string | undefined {
  if (link.startsWith('/')) return link;
  try {
    const url = new URL(link);
    const site = new URL(siteUrl);
    const nossos = [site.host, 'casacontente.com.br', 'www.casacontente.com.br'];
    return nossos.includes(url.host) ? `${url.pathname}${url.search}` : undefined;
  } catch {
    return undefined;
  }
}
