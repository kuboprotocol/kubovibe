# KUBO Mobile Agent — iOS / iPadOS, do Mac ao alerta no iPhone

O app nativo é um wrapper Capacitor do cliente `/m`. Sessões, builds e deploys rodam
remotamente (KUBO Cloud) — o binário é apenas um cliente rico, e todo consumo é
debitado no mesmo ledger de créditos (`credit_transactions`).

Pré-requisitos no Mac: macOS 14+, Xcode 15+ (com Command Line Tools),
Node 20+, CocoaPods (`sudo gem install cocoapods`), conta Apple Developer.

---

## 1. Clonar e preparar o projeto

```bash
git clone <seu-repo-exportado> kubovibe && cd kubovibe
npm install
npm install @capacitor/push-notifications
npm run build
npx cap add ios
npx cap sync ios
npx cap open ios
```

`npx cap add ios` só é necessário na primeira vez. Depois de qualquer alteração de
código web: `npm run build && npx cap sync ios`.

## 2. Xcode — assinatura e capacidades

1. Abra `ios/App/App.xcworkspace` (não o `.xcodeproj`).
2. Target **App** → *Signing & Capabilities*:
   - marque *Automatically manage signing* e escolha seu **Team**;
   - Bundle Identifier: `dev.kubovibe.app`;
   - **+ Capability** → *Push Notifications*;
   - **+ Capability** → *Background Modes* → marque *Remote notifications*.
3. Conecte o iPhone via USB, confie no Mac, selecione o device como destino e **Run** (⌘R).
4. No iPhone: Ajustes → Geral → VPN e Gerenciamento de Dispositivo → confie no perfil.

Conta gratuita instala por 7 dias; conta paga/TestFlight para instalação duradoura.

## 3. Chave APNs (.p8)

No [Apple Developer portal](https://developer.apple.com/account/resources/authkeys/list):

1. **Keys → +** → nome `KUBO APNs` → marque *Apple Push Notifications service (APNs)* → Continue → Register.
2. Baixe o arquivo `AuthKey_XXXXXXXXXX.p8` (**download único**) e anote:
   - **Key ID** (10 caracteres, no nome do arquivo);
   - **Team ID** (canto superior direito da conta);
   - **Bundle ID**: `dev.kubovibe.app`.

Cadastre os quatro valores como secrets do backend — nunca cole no chat:
`APNS_KEY_P8` (conteúdo completo do `.p8`, incluindo as linhas `BEGIN/END PRIVATE KEY`),
`APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`.

## 4. Registro do token no device

Na primeira abertura o app pede permissão de notificação, recebe o token APNs e
envia para a function `devices-register`, que grava em `mobile_devices`
(`user_id`, `apns_token`, `platform='ios'`, `app_version`). Isso já está implementado em
`src/hooks/useDeviceRegistration.ts` — em web ele fica inerte.

Confira o registro no painel `/admin/anywhere` (lista de devices).

> Build instalada pelo Xcode usa o ambiente **sandbox**
> (`api.sandbox.push.apple.com`). TestFlight/App Store usam produção
> (`api.push.apple.com`). O envio escolhe o host pelo campo `environment` do device.

## 5. Disparar o build e ouvir o alerta

1. No Mac (ou em qualquer browser), abra `/admin/cloud`, clique no ID de uma sessão
   e use **Build**; ou abra o app no iPhone, aba *Preview*, escolha a arquitetura
   (ex.: `iOS arm64 (device)` — custo ×2,5) e toque em **Run build**.
2. O `cloud-sessions` cobra os créditos **antes** de executar, grava a linha em
   `session_builds` (com `arch`, `platform`, `logs`, `duration_ms`, `credits_spent`)
   e, ao finalizar, envia o push para os tokens do dono da sessão.
3. Bloqueie o iPhone: o alerta "Build finished · iOS arm64" toca com som mesmo
   com o app em background (Remote notifications).
4. Toque na notificação → o app abre em `/m` na aba *Preview* com os logs da build.

## 6. Conferir custo e tempo de compilação

- `/admin/builds` — logs completos, tempo de compilação e **custo por arquitetura**
  (multiplicador, créditos, tempo médio, falhas), com atualização em tempo real.
- `/admin/projects` → aba **By day** — créditos diários por categoria e projeção mensal.

## 7. Deep links e continuidade no desktop

```
kubovibe://m?project=<uuid>&repo=<owner/repo>&branch=main&file=src/App.tsx
```

O botão **Vibe Code** no header abre o mesmo projeto, branch e arquivo em
`/vibe-code`, mantendo o workspace compartilhado com o agente local
(`kubo-agent/`, Rust + extensão VS Code/Cursor).

## Troubleshooting

| Sintoma | Causa provável |
| --- | --- |
| `No profiles for 'dev.kubovibe.app' were found` | Team não selecionado ou bundle ID diferente do registrado |
| Push não chega | Device registrado em sandbox mas envio em produção (ou vice-versa) |
| `BadDeviceToken` | Token antigo — reinstale o app para reemitir e reenviar a `devices-register` |
| Build cobra mas não roda | Sessão terminada (`session_terminated`) — abra uma nova em *Session* |
| `insufficient_credits` | Saldo insuficiente para o custo × multiplicador da arquitetura |

---

## APNs push — end-to-end test (production, kubovibe.dev)

The backend now signs its own APNs provider JWT (ES256) from four secrets:
`APNS_KEY_P8`, `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID`. Add them through the
secure secrets form in the app — never paste them in chat.

1. **Apple Developer → Keys → +** — enable *Apple Push Notifications service (APNs)*,
   download the `.p8` **once**. Note the **Key ID** and, in Membership, the **Team ID**.
2. Save the secrets: `APNS_KEY_P8` = the whole file including the
   `-----BEGIN PRIVATE KEY-----` / `-----END PRIVATE KEY-----` lines,
   `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_BUNDLE_ID` = `dev.kubovibe.app`.
3. Build and install the app on the iPhone (steps above). On first launch accept the
   notification prompt — the app registers its token via `devices-register`.
4. Open `/admin/ios-build` in the panel. The badge must read **APNs ready · N device(s)**.
5. Press **Test push** — the alert must ring on the iPhone within a couple of seconds,
   and the row appears under **Push deliveries** with status `delivered`.
6. Start a session, pick **iOS arm64 (device)** and press **Build**. When the build
   finishes the backend pushes `build succeeded / failed` with the target, credits and
   duration, deep-linking to `kubovibe://m?session=<id>&build=<id>`.

Failure reasons come straight from Apple and are shown in the Push deliveries tab:

| Reason | Meaning |
| --- | --- |
| `BadDeviceToken` | Token is from the other environment — the backend auto-retries sandbox, then drops the token. |
| `Unregistered` | App removed from the device; the token is deleted automatically. |
| `TopicDisallowed` | `APNS_BUNDLE_ID` does not match the app's bundle identifier. |
| `InvalidProviderToken` | Wrong `.p8`, Key ID or Team ID. |
