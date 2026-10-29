# Instruções para quem mexe no app (pessoas e IA)

App da Casa Contente em Expo (SDK 58) com expo-router. Regras gerais no `CLAUDE.md` deste repositório e no do site (appscontente/loja-casacontente);
visão geral no `README.md` desta pasta.

## Expo muda a cada versão

Antes de usar uma API do Expo, do EAS ou do React Native, confira a documentação da versão instalada
(`https://docs.expo.dev/versions/v58.0.0/`) ou o índice `https://docs.expo.dev/llms.txt`. Não confie na memória.

## Regras

- Textos de tela, commits e documentação em português do Brasil.
- Rotas iguais às do site: um link do site precisa abrir a mesma tela no app.
- O app só lê o site (`/api/app/*`); nunca chama o Sankhya, o backend ou a adquirente direto.
- Nunca gravar número de cartão nem CVV, nem em log. Segredos só no EAS ou em variáveis de ambiente.
- Hooks começam com `use` (o React Compiler está ligado e só reconhece hooks com esse nome).
- Pacote novo com `npx expo install`. Antes de enviar: `npx tsc --noEmit` e `npx expo lint`.
