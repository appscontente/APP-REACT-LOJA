# App de vendas da Casa Contente

App da loja para Android e iPhone, em React Native com Expo (SDK 58) e expo-router. A referência de experiência é o
app da Drogasil (só o UX; nada de código, imagem, texto ou marca dela). Levantamento e decisões:
https://claude.ai/artifact/TZcGfazWgjSihmFhrgTaGM

## Como o app conversa com o resto

```
Sankhya → sync → Postgres → backend (FastAPI) → site (Next.js, rotas /api/app/*) → app
```

- O app não fala com o Sankhya nem com o backend direto: lê as rotas JSON do site (repositório
  [loja-casacontente](https://github.com/appscontente/loja-casacontente), pasta `loja/src/app/api/app/*`; contrato no
  `docs/CONTRATO-API.md` de lá, seção 38), que usam as mesmas funções das páginas. Por isso os banners
  automáticos do dia, preço, desconto no Pix, parcelamento e estoque saem iguais no site e no app.
- Toda chamada leva o cabeçalho `X-Canal: app`, para o backend separar as vendas do app.
- As rotas do app são as mesmas do site (`/{slug}/p`, `/{departamento}/{categoria}`, `/busca?q=`,
  `/qr/{CODEMP}/{CODPROD}`, `/loja/{loja}/p/{slug}`, `/orcamento/{token}`, `/pagar/{codigo}`). Um link do site
  compartilhado no WhatsApp abre direto na tela certa do app (App Links no Android e Universal Links no iPhone); páginas
  que o app não tem (institucional, ajuda, admin) abrem no navegador dentro do app.

## O que já funciona e o que é demonstração

| Parte | Situação |
| --- | --- |
| Início (banners com arte + banners automáticos do dia), categorias, busca com sugestões, produto, ofertas, frete por CEP | Dados reais do site |
| Botão fixo "Na loja" (Figital): escolher a loja ou ler o QR, estoque CD x loja, carrinho por loja, comprovante com QR para o caixa | Dados reais do site; o comprovante ainda não cria o pedido no Sankhya |
| Boas-vindas na loja: 2 minutos perto de uma loja, o app dá as boas-vindas e entra no modo dela (liga na Conta) | Com o app aberto funciona até no Expo Go; com o app fechado (aviso no celular) só no app instalado pelo EAS |
| Leitor de QR e código de barras (câmera) | Funciona; etiqueta `/qr/{CODEMP}/{CODPROD}` abre o produto na loja |
| Conversa com a loja (no lugar do WhatsApp) | Demonstração no celular, com resposta automática; falta a rota no backend |
| Carrinho, checkout (Pix ou cartão), pedidos, favoritos, entrar com código no e-mail | Demonstração: fica só no celular, nada é cobrado e o cartão nunca é guardado |

Com as rotas do backend prontas (lista na seção 38 do contrato), só a camada `src/lib/api.ts` e os arquivos de
`src/estado/` mudam; as telas continuam iguais.

## Rodar no computador

```bash
npm install
cp .env.example .env          # ajuste EXPO_PUBLIC_SITE_URL se quiser apontar para a loja local
npx expo start                # abre o QR para o Expo Go no celular; tecla w abre no navegador
```

Pacotes novos: `npx expo install <pacote>` (escolhe a versão certa para o SDK). Antes de enviar:

```bash
npx tsc --noEmit
npx expo lint
```

## Links do WhatsApp abrindo no app

- Android: o site responde `/.well-known/assetlinks.json` com `APP_ID` (padrão `br.com.casacontente.app`) e
  `APP_ANDROID_SHA256` (impressão digital do certificado de assinatura, do `eas credentials` ou do Play Console).
- iPhone: o site responde `/.well-known/apple-app-site-association` com `APP_APPLE_TEAM_ID` (Team ID da conta Apple).
- Domínios cadastrados no `app.json`: casacontente.com.br, www.casacontente.com.br e loja-casacontente.onrender.com.
  No domínio principal só passa a valer quando ele deixar a VTEX; até lá, testar com o endereço do Render.

## Publicar nas lojas

Precisa das contas de desenvolvedor da empresa: Apple (US$ 99 por ano, pede o D-U-N-S da empresa) e Google Play
(US$ 25 uma vez). Com elas, o build sai pelo EAS (`npx eas build`), e as chaves ficam no EAS, nunca no repositório.

## Organização

- `src/app/`: telas (cada arquivo é uma rota, igual ao site).
- `src/componentes/`: peças de tela (cabeçalho, card de produto, banner automático, botão da Figital…).
- `src/estado/`: carrinho (site e um por loja), conta, conversas e loja atual da Figital.
- `src/lib/`: tema da marca (vermelho, amarelo, Fredoka e Manrope), chamadas ao site, formatação de preço.
