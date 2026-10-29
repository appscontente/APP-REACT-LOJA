# App de vendas Casa Contente

App da loja Casa Contente (Android e iPhone) em React Native com Expo. O site e o backend ficam no repositório
appscontente/loja-casacontente (especificação completa no CLAUDE.md de lá). Como rodar e o que é demonstração: README.md.
Regras de código: AGENTS.md.

## Regras
- O app só lê o site (`/api/app/*`, contrato na seção 38 do `docs/CONTRATO-API.md` do site); nunca chama o Sankhya, o
  backend ou a adquirente direto. Rotas do app iguais às do site, para os links do site abrirem no app.
- Experiência inspirada no app da Drogasil, sem copiar código, imagens, textos ou marca dela.
- Marca: vermelho #d71921, amarelo #fdb917, Fredoka nos títulos e botões, sorriso da logo como grafismo.
- Botão fixo "Na loja" leva à Figital (loja física); conversa com a loja dentro do app, no lugar do WhatsApp.
- Nunca gravar número de cartão nem CVV, nem em log. Segredos só no EAS ou em variáveis de ambiente.
- Textos de interface, commits e documentação em português do Brasil.
