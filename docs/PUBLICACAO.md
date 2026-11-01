# Publicar o app nas lojas (Google Play e App Store)

Guia passo a passo para colocar o app Casa Contente no Google Play (Android) e na App Store (iPhone), com os textos da
ficha, as respostas dos formulários de privacidade e o que precisa estar pronto antes. Escrito para quem nunca publicou
um app; os termos em inglês entre parênteses são os que aparecem nos painéis da Apple e do Google.

Resumo do caminho:

1. Criar as contas de desenvolvedor da empresa (Apple e Google). Leva de alguns dias a duas semanas por causa da
   verificação da empresa.
2. Ligar o projeto à conta do Expo (EAS) com `eas init`. Dá para fazer hoje.
3. Gerar um build de teste do Android (APK) e instalar nos celulares da equipe. Dá para fazer hoje.
4. Com as contas prontas: builds de produção, fichas das lojas, formulários e envio para revisão.
5. Depois da aprovação: publicar; correções só de telas saem pelo EAS Update sem passar pela revisão.

O que ainda bloqueia a publicação de verdade está na seção [Checklist antes de publicar](#checklist-antes-de-publicar).

## 1. Contas de desenvolvedor

As duas contas devem ser da **empresa**, não de uma pessoa, com um e-mail da Casa Contente que mais de uma pessoa
acesse (sugestão: apps@casacontente.com.br). Quem publica com conta pessoal depois não consegue transferir fácil.

### Apple Developer Program (US$ 99 por ano)

- Endereço: https://developer.apple.com/programs/enroll/ → "Enroll as an organization".
- Pede: um Apple ID da empresa com verificação em duas etapas; o **número D-U-N-S** da Casa Contente (gratuito, pela
  Dun & Bradstreet em https://developer.apple.com/enroll/duns-lookup/; se a empresa não tiver, o pedido leva até 2
  semanas); site da empresa; nome e cargo de quem tem autoridade legal para assinar (a Apple liga para confirmar).
- Prazo: 2 dias a 2 semanas. Pagamento no cartão da empresa, renovação anual.
- Quando aprovar: anotar o **Team ID** (Membership details). Ele vai para o site (variável `APP_APPLE_TEAM_ID`).

### Google Play Console (US$ 25, uma vez)

- Endereço: https://play.google.com/console/signup → conta de **organização**.
- Pede: conta Google da empresa, D-U-N-S (mesmo número da Apple), endereço, telefone e site da empresa, e a verificação
  de identidade do responsável (documento com foto). O Google também exige um e-mail e um telefone de contato que
  aparecem na ficha pública do app.
- Prazo: a verificação costuma levar alguns dias.
- Contas novas de organização não têm a exigência do teste fechado com 12 testadores por 14 dias (ela vale para
  contas pessoais).

### Conta do Expo (EAS)

Já existe (a mesma usada no Expo Go, usuário `armandocontente`). O plano gratuito dá um número limitado de builds por
mês na nuvem; se faltar, o plano pago libera mais. As chaves de assinatura dos apps ficam guardadas no EAS, nunca no
repositório.

## 2. Ligar o projeto ao EAS (pode ser feito hoje)

No Mac, na pasta do app (`~/Developer/app-react-loja`), com o repositório atualizado:

```bash
npm install
npx eas-cli@latest login            # a conta do Expo
npx eas-cli@latest init             # cria o projeto no EAS e grava extra.eas.projectId no app.json
git add app.json && git commit -m "Projeto ligado ao EAS"
```

Depois do `eas init`, o `app.json` ganha `"extra": { "eas": { "projectId": "..." } }`. Pode ir para o repositório: é
só um identificador, não é segredo. Para as atualizações sem passar pela loja (EAS Update), rode também
`npx eas-cli@latest update:configure`, que acrescenta `updates.url` no `app.json`.

O arquivo `eas.json` deste repositório já tem três perfis:

| Perfil | Para quê | Resultado |
| --- | --- | --- |
| `development` | app de desenvolvimento com as telas carregadas do computador (substitui o Expo Go para testar a localização com o app fechado) | instalação interna |
| `preview` | testar nos celulares da equipe antes da loja | APK no Android (instala direto); no iPhone, distribuição interna (precisa da conta Apple e dos aparelhos cadastrados) |
| `production` | o que vai para as lojas | AAB para o Google Play e IPA para a App Store; número de versão sobe sozinho a cada build (`autoIncrement`) |

Nos três perfis o app lê o site em `https://loja-casacontente.onrender.com`. Quando o domínio casacontente.com.br sair
da VTEX e passar para o site novo, trocar `EXPO_PUBLIC_SITE_URL` nos três perfis para `https://www.casacontente.com.br`
e gerar um build novo (essa variável entra no aplicativo na hora do build). Os links dos dois endereços já abrem no app.

## 3. Primeiro build de teste: Android (pode ser feito hoje)

```bash
npx eas-cli@latest build --platform android --profile preview
```

Na primeira vez o EAS pergunta se pode gerar a **chave de assinatura (keystore)**: responda sim e deixe no EAS. O build
leva uns 10 a 20 minutos e termina com um link para baixar o APK; abra o link no celular Android e instale (o celular
pede para permitir "instalar de fontes desconhecidas" uma vez). Esse build já tem tudo o que o Expo Go não tem: as
boas-vindas com o app fechado (cerca virtual) e os links do site abrindo no app.

Para o iPhone o build de teste precisa da conta Apple (seção 1) e do cadastro do UDID de cada iPhone de teste
(`npx eas-cli@latest device:create` gera um link que a pessoa abre no iPhone). Até lá, o Expo Go continua servindo.

## 4. Chaves e links do site

Os links do site (WhatsApp, e-mail, QR das etiquetas) abrem direto no app quando o site publica dois arquivos:
`/.well-known/assetlinks.json` (Android) e `/.well-known/apple-app-site-association` (iPhone). O site já faz isso a
partir de três variáveis de ambiente (no Render, "Environment"):

| Variável | Valor | Onde achar |
| --- | --- | --- |
| `APP_ID` | `br.com.casacontente.app` | já é o padrão |
| `APP_ANDROID_SHA256` | impressão digital SHA-256 do certificado que assina o app | Play Console → Release → Setup → App signing: usar a do **App signing key** (o Google reassina o app com a chave dele), e também a do **Upload key** se quiser que os builds de teste (APK) abram os links. Antes de o app estar no Play, `npx eas-cli@latest credentials --platform android` mostra a do keystore do EAS |
| `APP_APPLE_TEAM_ID` | Team ID da conta Apple (10 caracteres) | developer.apple.com → Membership details |

No iPhone a Apple só lê o arquivo do domínio quando o app é instalado pela App Store ou TestFlight; no Android o
Google confere na instalação. Testar com o endereço do Render até o domínio principal mudar.

## 5. Builds de produção e envio

Com as contas prontas e o `eas init` feito:

```bash
# Android: gera o AAB e envia para a trilha interna do Google Play (pede a chave da conta de serviço, abaixo)
npx eas-cli@latest build --platform android --profile production
npx eas-cli@latest submit --platform android --latest

# iPhone: gera o IPA e envia para o App Store Connect / TestFlight (pede login na conta Apple)
npx eas-cli@latest build --platform ios --profile production
npx eas-cli@latest submit --platform ios --latest
```

- **Google Play**: o `eas submit` precisa de uma conta de serviço do Google Cloud com acesso ao Play Console (o EAS
  explica como criar quando roda pela primeira vez; guia: https://github.com/expo/fyi/blob/main/creating-google-service-account.md).
  Salvar o arquivo JSON como `google-play-conta-de-servico.json` na pasta do app. Ele está no `.gitignore` e **nunca**
  vai para o repositório. O primeiro envio de um app novo precisa ser feito à mão no Play Console (subir o AAB na
  trilha de teste interno); a partir do segundo o `eas submit` funciona.
- **App Store**: antes do `eas submit`, criar o app no App Store Connect (seção 8) e preencher em `eas.json` →
  `submit.production.ios` o `ascAppId` (número do app no App Store Connect, em App Information → Apple ID) e o
  `appleTeamId`.

## 6. Ficha das lojas: textos prontos

Os mesmos textos valem para as duas lojas; os limites de caracteres estão entre parênteses.

**Nome do app** (30): Casa Contente

**Subtítulo (App Store, 30)**: Móveis, eletro e decoração

**Descrição curta (Google Play, 80)**: Móveis, eletrodomésticos e decoração da Casa Contente, no app e na loja.

**Descrição completa (4000)**:

> O app da Casa Contente traz a loja inteira para o seu celular: móveis, eletrodomésticos, eletroportáteis, decoração e
> utilidades, com os mesmos preços, promoções e desconto no Pix do site.
>
> • Ofertas da semana e lançamentos no início do app
> • Busca com sugestões, categorias e favoritos
> • Preço de/por, parcelamento e desconto no Pix em cada produto
> • Frete pelo CEP e retirada na loja, com o prazo de cada uma
> • Carrinho com cupons e promoções, pagamento por Pix ou cartão
> • Acompanhe a entrega e os pedidos feitos pelo site e pelo app
>
> Na loja física, o autoatendimento:
> • Leia o QR code das etiquetas e veja preço, estoque e ficha técnica
> • Monte o carrinho da loja e pague no caixa com o comprovante do app, sem esperar um vendedor
> • Ou pague pelo app e receba em casa
> • Converse com a equipe da loja pelo próprio app
>
> Com as boas-vindas na loja ligadas (opcional), o app entra no modo da loja quando você chega. A sua localização fica
> só no celular. O cartão nunca fica guardado no app.
>
> Casa Contente: lojas em Belém e Ananindeua, no Pará. Dúvidas: faleconosco@casacontente.com.br.

**Palavras-chave (App Store, 100)**: móveis,eletrodomésticos,decoração,geladeira,fogão,sofá,cama box,cozinha,belém,pará

**O que há de novo (versão 1.0.0)**: Primeira versão do app da Casa Contente.

**Categoria**: Compras (Shopping). **Classificação**: Livre (o questionário de classificação não tem nada a marcar:
sem violência, sem conteúdo adulto, sem apostas; compras de produtos reais não entram como "compras no app").

**Preço**: gratuito, sem compras no app (os produtos são comprados fora do sistema das lojas, como em qualquer app
de varejo).

**Contato**: e-mail faleconosco@casacontente.com.br; telefone (91) 3222-4751; site https://www.casacontente.com.br.

**Política de privacidade (obrigatória nas duas lojas)**: https://loja-casacontente.onrender.com/politica-de-privacidade
(trocar para https://www.casacontente.com.br/politica-de-privacidade quando o domínio mudar). A política já tem a
seção "App Casa Contente".

**Exclusão de conta (obrigatória no Google Play, pedida pela Apple)**: dentro do app, Conta → Privacidade → "Excluir
minha conta"; pelo site, https://loja-casacontente.onrender.com/minha-conta/dados.

**Imagens**:

| Item | Google Play | App Store |
| --- | --- | --- |
| Ícone | 512 × 512 px (o EAS gera do `assets/images/icon.png`) | 1024 × 1024 px, sem transparência (idem) |
| Capturas de tela | mínimo 2, de 320 a 3840 px, proporção 16:9 ou 9:16 (ex.: 1080 × 2400) | iPhone 6,7" (1290 × 2796) obrigatórias; 6,5" (1284 × 2778 ou 1242 × 2688) recomendadas; iPad não precisa (o app é só para celular) |
| Imagem de destaque | 1024 × 500 px, obrigatória | não tem |

Sugestão de capturas (6 a 8): Início com as ofertas; página do produto; carrinho com cupom; checkout; QR da etiqueta
na loja; carrinho da loja com o comprovante; conversa com a loja; pedido com a linha do tempo. Tirar as capturas do
build de produção, com produtos reais e fotos reais (não com os dados de exemplo).

## 7. Google Play Console, passo a passo

1. **Criar o app**: nome Casa Contente, idioma padrão português (Brasil), tipo App, gratuito. Aceitar as declarações.
2. **Painel → Configurar o app** (Set up your app), cada item:
   - *Política de privacidade*: a URL acima.
   - *Acesso ao app* (App access): "Todo ou parte do app está restrito". Explicar que o login é por código enviado ao
     e-mail e dar ao revisor um acesso de teste (ver [Notas para os revisores](#9-notas-para-os-revisores-apple-e-google)).
   - *Anúncios*: não contém anúncios.
   - *Classificação do conteúdo*: preencher o questionário (categoria "Utilitário, produtividade, comunicação ou
     outro"); resultado Livre.
   - *Público-alvo*: 18 anos ou mais (compras); o app não é voltado a crianças.
   - *App de notícias*: não. *App de rastreamento de contatos ou status da COVID-19*: não. *Apps governamentais*: não.
   - *Recursos financeiros*: não oferece serviços financeiros (vender produtos com pagamento por cartão/Pix não é
     serviço financeiro).
   - *Saúde*: não.
   - *Segurança dos dados* (Data safety): respostas na seção 7.1.
   - *Permissões sensíveis*: a declaração da localização em segundo plano, seção 7.2.
3. **Ficha da loja principal**: textos e imagens da seção 6.
4. **Teste interno** (Release → Testing → Internal testing): subir o primeiro AAB à mão, adicionar os e-mails da equipe,
   instalar pelo link e testar por alguns dias.
5. **Produção**: criar a versão, revisar os avisos, enviar para revisão. A primeira revisão leva de 1 a 7 dias.
   Publicar com lançamento gradual (por exemplo 20% dos usuários no primeiro dia) para poder interromper se aparecer
   erro.

### 7.1 Formulário "Segurança dos dados" (Data safety)

Marcar que o app **coleta** dados, que os dados são **criptografados em trânsito** (HTTPS) e que o usuário **pode pedir
a exclusão** (URL de exclusão de conta acima). Nenhum dado é **compartilhado** com terceiros (a operadora do cartão e a
análise antifraude processam o pagamento em nome da Casa Contente, o que o Google trata como prestador de serviço,
não como compartilhamento). O app **não** segue a política de famílias nem passou por auditoria independente.

| Tipo de dado | Coletado? | Obrigatório ou opcional | Finalidade | Observação |
| --- | --- | --- | --- | --- |
| Localização (precisa e aproximada) | **Não** | — | — | Usada só no celular para saber se a pessoa está numa loja; nunca é enviada. O Google considera "coletado" o que sai do aparelho; ainda assim a permissão de localização em segundo plano exige a declaração da seção 7.2 |
| Nome | Sim | Opcional (só quem compra ou entra) | Funcionalidade do app (pedido, nota fiscal) | |
| E-mail | Sim | Opcional | Funcionalidade do app (login por código, pedido), comunicação (avisos do pedido) | |
| Telefone | Sim | Opcional | Funcionalidade do app (entrega) | |
| Endereço | Sim | Opcional | Funcionalidade do app (entrega e nota) | CEP também é usado para calcular o frete |
| Informações de pagamento (cartão) | Sim | Opcional | Funcionalidade do app (pagar) | Vai direto ao serviço de pagamento; o app e o site nunca guardam número nem CVV. Pix não tem dado do usuário |
| Histórico de compras | Sim | Opcional | Funcionalidade do app (Meus pedidos) | |
| Mensagens no app (conversa com a loja) | Sim | Opcional | Funcionalidade do app | Quando as conversas passarem pelo backend |
| Histórico de pesquisa no app | Sim | Opcional | Análise (termos buscados, sem ligação com a pessoa) | A busca manda o termo digitado ao site; o site guarda os termos para melhorar o catálogo, sem identificar quem buscou |
| Fotos, áudio, arquivos, contatos, agenda, dados de saúde | Não | — | — | A câmera só lê QR e código de barras; nada é gravado |
| Identificadores do aparelho, dados de uso, diagnóstico | Não | — | — | O app não tem analytics nem relatório de falhas |

### 7.2 Declaração da permissão de localização em segundo plano

O Android pede uma declaração (Permissions declaration form) e um **vídeo** para quem usa `ACCESS_BACKGROUND_LOCATION`.
O app usa essa permissão só no Android, para a cerca virtual das boas-vindas na loja (no iPhone a cerca virtual usa a
permissão "Sempre" do próprio sistema e não precisa de formulário).

Texto da declaração (o painel aceita até 500 caracteres; em inglês, porque a revisão é em inglês):

> Casa Contente is a furniture and appliance retailer with physical stores in Brazil. The optional "store welcome"
> feature (off by default, enabled by the user in Account) uses background location only to detect, with a geofence,
> that the user has been inside one of our 4 stores for 2 minutes, then shows a welcome notification and opens the
> in-store self-service mode (QR tags, store cart, checkout at the register). Location is processed on the device and
> never sent to our servers. The user can turn it off anytime in the app.

Versão em português, para a equipe: "O recurso opcional de boas-vindas na loja (desligado por padrão, ligado pelo
cliente na aba Conta) usa a localização em segundo plano só para perceber, por uma cerca virtual, que o cliente está há
2 minutos dentro de uma das nossas 4 lojas, mostrar uma notificação de boas-vindas e abrir o modo de autoatendimento
da loja. A localização é tratada no celular e nunca vai para os nossos servidores. O cliente desliga quando quiser."

**Aviso em destaque dentro do app** (prominent disclosure), que o Google exige antes do pedido de permissão: já existe,
na aba Conta, ao ligar "Boas-vindas na loja" (texto "Quando você passar 2 minutos numa loja Casa Contente, o app dá as
boas-vindas... Para isso ele usa a localização do celular, inclusive com o app fechado ou sem uso..."). Não mudar esse
texto sem conferir a política.

**Roteiro do vídeo** (gravação da tela de um Android com o app instalado pelo build; até 30 segundos; sem som; enviar
como link do YouTube não listado ou do Google Drive):

1. Abrir o app na aba Conta e mostrar a opção "Boas-vindas na loja" desligada (2 s).
2. Tocar no interruptor: aparece o aviso em destaque explicando o uso da localização com o app fechado; parar 3 s para
   dar tempo de ler.
3. Tocar em "Ligar": aparece o pedido de permissão de localização do Android ("Precisa" e "Durante o uso do app");
   escolher "Durante o uso do app".
4. Aparece a explicação do app para a permissão "o tempo todo" e, em seguida, a tela de ajustes do Android: escolher
   "Permitir o tempo todo" e voltar.
5. Mostrar o interruptor ligado e o texto "Ao chegar numa loja, o app entra no modo dela".
6. Mostrar a funcionalidade: com o app fechado, a notificação "Bem-vindo à Casa Contente ..." chegando (gravar na
   loja, ou com a localização simulada pelo Android em modo desenvolvedor na coordenada de uma loja) e, ao tocar nela,
   o app abrindo no modo da loja com "Autoatendimento {loja}" no topo.
7. Voltar à aba Conta e desligar o interruptor, mostrando que o cliente desliga quando quiser.

## 8. App Store Connect, passo a passo

1. **Certificados e app**: em https://appstoreconnect.apple.com → Apps → "+" → New App: plataforma iOS, nome Casa
   Contente, idioma principal Português (Brasil), Bundle ID `br.com.casacontente.app` (criar antes em
   developer.apple.com → Identifiers, com Associated Domains e Push Notifications marcados), SKU `casa-contente-app`.
2. **App Information**: categoria principal Shopping; sem categoria secundária; classificação etária pelo questionário
   (resultado 4+); direitos autorais "Casa Contente".
3. **Pricing and Availability**: gratuito, disponível no Brasil (pode ser em todos os países; não faz diferença).
4. **App Privacy**: respostas na seção 8.1.
5. **Versão 1.0.0**: capturas, descrição, palavras-chave, URL de suporte (a página institucional do site,
   https://www.casacontente.com.br/institucional, ou a de contato), URL de marketing (o site), notas para o revisor (seção 9), informações de contato do
   revisor (nome, telefone e e-mail de alguém da equipe que atenda durante a revisão). Em "Sign-in required", marcar sim
   e dar a conta de teste.
6. **Export compliance**: o `app.json` já declara `usesNonExemptEncryption: false` (o app só usa HTTPS, que é isento),
   então a pergunta de criptografia nem aparece a cada build.
7. **Build**: depois do `eas submit`, o build aparece em TestFlight em alguns minutos; selecionar na versão e enviar
   para revisão (Add for Review → Submit). A primeira revisão leva de 1 a 3 dias; a Apple costuma perguntar sobre a
   permissão de localização "Sempre": a resposta está nas notas para o revisor.
8. **TestFlight** (opcional, recomendado): antes de enviar para revisão, adicionar a equipe como testadores internos e
   usar o app por alguns dias.

### 8.1 Formulário "App Privacy" (Apple)

Responder "Yes, we collect data from this app" e, em cada tipo, marcar **Linked to the user** (ligado à conta) e
**not used for tracking** (o app não tem publicidade nem rastreamento entre apps; "Tracking: No").

| Tipo (nome na Apple) | Coleta? | Ligado ao usuário | Finalidade |
| --- | --- | --- | --- |
| Contact Info → Name, Email Address, Phone Number, Physical Address | Sim | Sim | App Functionality |
| Financial Info → Payment Info | Sim | Sim | App Functionality (vai direto ao serviço de pagamento; nunca guardado) |
| Financial Info → Purchase History | Sim | Sim | App Functionality |
| User Content → Other User Content (mensagens para a loja) | Sim | Sim | App Functionality |
| Search History | Sim | **Não** (os termos buscados não identificam a pessoa) | Analytics |
| Location → Precise Location | **Não** | — | Tratada no celular; nunca enviada. A Apple só conta como coletado o que sai do aparelho |
| Identifiers, Usage Data, Diagnostics, Health, Contacts, Browsing History, Sensitive Info | Não | — | — |

Textos de permissão (já no `app.json`, aparecem nas caixas do iPhone): câmera ("lê o QR code das etiquetas e o código
de barras"), localização durante o uso ("boas-vindas quando você chega numa loja... fica só no celular"), localização
sempre ("com o app fechado, avisar quando você passar 2 minutos numa loja... você desliga na Conta") e localização
exata.

## 9. Notas para os revisores (Apple e Google)

Texto para colar no campo de notas (em inglês, com a versão em português abaixo):

> Casa Contente is a Brazilian furniture and home appliance retailer (4 physical stores in Belém and Ananindeua, PA).
> The app is the retailer's own store: catalog, cart, checkout (Pix / credit card) and order tracking, plus an in-store
> self-service mode.
>
> SIGN-IN: the app has no password; the user types their e-mail and receives a 6-digit code. For review, use the test
> account e-mail **revisor@casacontente.com.br** with the code **[CÓDIGO DE REVISÃO]** (a review-only account with
> sample orders; it cannot place real orders or payments). Browsing, cart and the store mode do not require sign-in.
>
> STORE MODE (no need to be in Brazil): tap the fixed "Na loja" button → "Escolher a loja" → pick "Doca". You can also
> open this link on the device, which is what a shelf QR tag opens: https://loja-casacontente.onrender.com/loja/doca
>
> LOCATION "ALWAYS" (iOS) / BACKGROUND LOCATION (Android): used only by the optional "Boas-vindas na loja" feature
> (Account tab, off by default). A geofence around our 4 stores detects that the user stayed 2 minutes inside a store
> and shows a welcome notification that opens the store mode. Location is processed on the device and never sent to
> our servers; the user can turn it off in the Account tab. The purpose strings explain this to the user before the
> system prompt.
>
> CAMERA: reads QR codes on shelf tags and product barcodes; no photos are stored.
>
> PAYMENTS: physical goods, paid through the retailer's own payment service (Rede acquirer) with anti-fraud analysis;
> card data never touches the app storage. No in-app purchases.

Em português: o app é a loja própria da Casa Contente; login por código no e-mail (conta de teste
revisor@casacontente.com.br com o código de revisão, que o TI define e fica só no campo de notas das lojas); o modo loja abre pelo botão fixo
"Na loja" → "Escolher a loja" → Doca, ou pelo link da loja (o mesmo que o QR da etiqueta abre); a localização "sempre" é só das boas-vindas na
loja, opcional, tratada no celular; a câmera só lê QR e código de barras; pagamento de produtos físicos pelo serviço
de pagamento da empresa, sem compras no app.

**Atenção**: a conta de teste do revisor ainda não existe, e o código dela não fica neste repositório nem em outro
documento compartilhado. Ao colar o texto acima, troque `[CÓDIGO DE REVISÃO]` pelo código que o TI definir (guardado no
cofre da equipe e escrito só no campo de notas das lojas). O backend precisa de uma conta de revisão com estas regras
(lista do TI, seção 10): ligada por uma variável do servidor só durante a revisão e desligada depois; código trocado a
cada ciclo de revisão; o mesmo limite de tentativas dos códigos normais; alguns pedidos de exemplo para o revisor ver
"Meus pedidos"; e nenhuma ação real: checkout, comprovante do caixa e exclusão de conta respondem com dado de exemplo
(ou 403), sem criar pedido nem pagamento.

## 10. Checklist antes de publicar

O app de hoje é uma demonstração em várias partes. **Não enviar para revisão** antes de:

Backend (TI, contrato `docs/CONTRATO-API.md` do site, seção 38.2):

- [ ] Login por código de verdade (hoje qualquer código de 6 números entra) e a conta de revisão com as regras das
      notas para o revisor (código fora do repositório, ligada só durante a revisão, sem pedido nem pagamento real).
- [ ] Pedido do app criado de verdade (hoje fica só no celular): checkout → serviço de pagamento → ClearSale → Sankhya.
- [ ] Pix de verdade (QR, copia e cola e prazo vindos da e.Rede) no pedido recebido e em Meus pedidos.
- [ ] Comprovante do caixa criando o pedido no Sankhya (hoje o número é gerado no celular).
- [ ] Conversas com a loja passando pelo backend (hoje resposta automática no celular) e os avisos de nova mensagem.
- [ ] Desconto do autoatendimento pagando pelo app (coluna "site" do Happy) aplicado no pedido pelo backend.
- [ ] Meus pedidos lendo os pedidos do site e das lojas (GET /clientes/eu/pedidos), e a exclusão de conta pelo app.

Site:

- [ ] Variáveis `APP_ANDROID_SHA256` e `APP_APPLE_TEAM_ID` no Render (seção 4).
- [ ] Política de privacidade publicada no endereço informado nas lojas (já tem a seção do app).
- [ ] Cloudflare na frente do site (revisão de segurança de 27/10) antes de divulgar o app.

App:

- [ ] Tirar os textos "Demonstração" das telas (login, pedido recebido, Pix) quando o backend estiver ligado.
- [ ] `EXPO_PUBLIC_SITE_URL` do `eas.json` apontando para o site definitivo.
- [ ] Testar em aparelhos reais: iPhone (cerca virtual com "Sempre", links do site abrindo no app, zoom das fotos) e
      Android (boas-vindas com o app fechado, links, leitor de QR, copiar Pix, zoom das fotos com pinça e toque duplo).
- [ ] Capturas de tela com produtos e fotos reais; ícone e imagem de destaque conferidos.
- [ ] Testar com o VoiceOver (iPhone) e o TalkBack (Android) nas telas principais.
- [ ] E-mail faleconosco@casacontente.com.br sendo lido: as lojas mandam para ele as perguntas da revisão.

## 11. Depois de publicar: versões e atualizações

- **Mudou só tela ou regra em JavaScript** (textos, layout, cálculo): `npx eas-cli@latest update --channel production
  --message "o que mudou"` publica em minutos para quem já tem o app, sem passar pela loja. Vale enquanto a
  `runtimeVersion` (política `appVersion`, ou seja, o `version` do `app.json`) for a mesma.
- **Mudou pacote nativo, permissão, ícone ou o `version`**: build novo (`eas build --profile production`) e envio às
  lojas (`eas submit`), com revisão de novo. O `autoIncrement` cuida do `versionCode`/`buildNumber`; o `version`
  (1.0.0, 1.1.0...) é alterado à mão no `app.json` quando a mudança for visível ao cliente.
- Conferir no Play Console e no App Store Connect as avaliações e as falhas relatadas pelas lojas (o app não tem
  relatório de falhas próprio; se quiser um, Sentry com `@sentry/react-native` é o mais usado no Expo).
- Guardar neste repositório, em cada versão publicada, o texto "O que há de novo".

## 12. Perguntas frequentes

**Dá para publicar só no Android primeiro?** Sim. As contas são independentes; o Google costuma liberar antes.

**Precisa de Mac para o iPhone?** Não para gerar o build: o EAS gera na nuvem. O Mac ajuda para testar no simulador e
tirar as capturas, mas um iPhone de verdade basta.

**O Expo Go some?** Continua servindo para desenvolver. Para testar a localização com o app fechado e os links do
site, usar o build `development` ou `preview`.

**E se a Apple recusar por causa da localização "Sempre"?** Responder com o texto da seção 9 e, se insistirem, um vídeo
igual ao da seção 7.2. Em último caso, dá para publicar a primeira versão sem a permissão "Sempre" no iPhone (as
boas-vindas funcionariam só com o app aberto): é trocar `isIosBackgroundLocationEnabled`/as frases de "sempre" no
`app.json` e não pedir a permissão de segundo plano no iOS em `src/lib/perto-da-loja.ts`.

**Quanto custa manter?** US$ 99 por ano da Apple, nada do Google depois dos US$ 25, e o plano do EAS se os builds
gratuitos do mês acabarem.
