// O que fazer com um código lido pela câmera ou digitado: link do site vira tela do app, código de barras vira busca
// e o código da etiqueta (CODPROD), dentro de uma loja, abre o produto nela.

import { SITE_URL } from './api';
import { rotaBusca, rotaInterna } from './rotas';

/** Para onde vai o que a câmera leu (ou o cliente digitou). */
export function destinoDoCodigo(lido: string, lojaAtual?: string): string | undefined {
  const texto = lido.trim();
  const interna = /^https?:\/\//.test(texto) ? rotaInterna(texto, SITE_URL) : undefined;
  if (interna) return interna;
  if (/^\d{8,14}$/.test(texto)) return rotaBusca(texto);
  // Código da etiqueta digitado (CODPROD): dentro de uma loja, abre o produto nela.
  if (/^[\w-]{1,12}$/.test(texto) && lojaAtual) return `/loja/${lojaAtual}/codigo/${encodeURIComponent(texto.toUpperCase())}`;
  return texto ? rotaBusca(texto) : undefined;
}
