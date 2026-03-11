

# Plano: Adicionar o botão "+" (PromptAttachMenu) no Builder

## Problema
O componente `PromptAttachMenu` (botão + com funcionalidades de attach, screenshot, referência, etc.) existe mas **não está sendo usado** no `BuilderPage.tsx`. O campo de input do builder só tem o textarea e o botão de enviar.

## Solução
Importar e renderizar o `PromptAttachMenu` ao lado do textarea no painel de chat do builder.

## Alteração em `src/pages/BuilderPage.tsx`

1. Importar `PromptAttachMenu` do componente existente
2. Adicionar o botão "+" à esquerda do textarea na área de input (linha ~208-217)
3. Conectar os handlers (`onAttachFile`, `onScreenshot`, `onAddReference`) com lógica básica que insere contexto no chat

O layout do input passará de:
```text
[ textarea          [send] ]
```
Para:
```text
[+] [ textarea       [send] ]
```

