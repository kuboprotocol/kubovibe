# kubo-agent

KUBO Local Agent (Rust daemon) + KUBO Vibe extension for VS Code / Cursor.

Desktop platforms (Windows, macOS, Linux) run code **locally** — there is no
container to host, so only AI actions are billed, against the exact same credit
ledger (`credit_transactions`) that the cloud sessions and the admin panels use.

## Credit ledger (mirrors `src/lib/anywhereConfig.ts`)

| Action           | Credits |
| ---------------- | ------- |
| Chat message     | 1       |
| Code edit        | 2       |
| Agent run        | 4       |
| Terminal command | 0       |
| Git operation    | 0       |

The daemon never touches the database. It calls the `local-agent-usage` edge
function with the signed-in user's access token, which performs the atomic
deduction — so `/admin/projects` and `/admin/teams` show local usage next to
cloud usage automatically.

## Layout

```text
daemon/      Rust daemon (axum, localhost REST on port 43117)
  src/main.rs      routes: /health, /onboard, /pair, /run, /ai
  src/onboard.rs   detecta VS Code/Cursor/Trae/Antigravity e instala o .vsix sozinho
  src/ledger.rs    credit costs + edge function call
  src/runner.rs    local shell execution (PowerShell on Windows)
  src/state.rs     config in ~/.kubovibe/agent.json (secret local + pairing)
extension/   VS Code / Cursor extension (TypeScript)
scripts/     sign-windows.ps1 (Authenticode, OV .pfx or EV token)
.github/     release workflow: build, sign, package .vsix
```

## Integração automática com o editor ("um clique")

O instalador real (a construir: .msi assinado no Windows) deve, no primeiro
run, copiar `kubo-agent.exe` e `kubo-vibe.vsix` para a mesma pasta e rodar:

```powershell
kubo-agent.exe --onboard
```

Isso detecta VS Code, Cursor, Trae e Antigravity (PATH + diretórios de instalação padrão
de cada SO) e instala a extensão em cada um via `--install-extension`, sem
nenhum passo manual. Nenhum editor encontrado não é erro — o app standalone
continua funcionando normalmente.

Com o daemon já rodando como serviço, a mesma detecção fica disponível via
HTTP para uma UI de instalador mais rica:

```
GET  /onboard          -> lista editores encontrados (sem instalar nada)
POST /onboard          -> detecta + instala em todos de uma vez
     { "vsix_path": "C:\\caminho\\opcional\\kubo-vibe.vsix" }
```

Trae e Antigravity vêm marcados como `best_effort: true` no resultado — o binário de CLI
dele não é tão padronizado quanto o dos outros dois, então a detecção
funciona quando ele expõe um `trae`/`trae.cmd` na instalação, mas isso não
é garantido do mesmo jeito que VS Code/Cursor.

## Build on Windows

```powershell
cd daemon
cargo build --release
pwsh ..\scripts\sign-windows.ps1 -Binary target\release\kubo-agent.exe
.\target\release\kubo-agent.exe        # listens on http://127.0.0.1:43117
```

Extension:

```powershell
cd extension
npm install
npm run compile
npx vsce package        # produces kubo-vibe-0.1.0.vsix
code --install-extension kubo-vibe-0.1.0.vsix
```

Then set `kubo.projectId` in VS Code settings to the KUBO project the credits
should be billed to.

## Code signing

- **OV certificate**: export as `.pfx`, set `KUBO_CERT_PATH` and
  `KUBO_CERT_PASSWORD`, run the script. SmartScreen reputation builds over time.
- **EV certificate**: kept on a hardware token or cloud HSM — leave
  `KUBO_CERT_PATH` empty and the script signs by subject name (`/n "KUBO
  PROTOCOL"`) from the Windows certificate store. SmartScreen trusts it
  immediately.
- CI: store the `.pfx` base64 in the `KUBO_CERT_BASE64` secret and the password
  in `KUBO_CERT_PASSWORD`. EV signing cannot run on hosted runners — use a
  self-hosted runner with the token attached.
- Always timestamp (`/tr`), otherwise the signature expires with the certificate.
