# KUBO Local Agent — compile, sign and install on Windows (OV certificate)

Run everything from **PowerShell as Administrator**, in the repo root.

## 1. Prerequisites

```powershell
winget install Rustlang.Rustup
winget install OpenJS.NodeJS.LTS
winget install Microsoft.WindowsSDK   # provides signtool.exe
rustup default stable
```

## 2. Build the daemon

```powershell
cd kubo-agent\daemon
cargo build --release
# output: kubo-agent\daemon\target\release\kubo-agent.exe
```

## 3. Sign with your OV certificate

An OV certificate is a `.pfx` file (EV would use the token flow with `/n`).

```powershell
$env:KUBO_CERT_PATH     = "C:\certs\kubo-ov.pfx"
$env:KUBO_CERT_PASSWORD = "<pfx password>"   # never commit this
cd ..\..
powershell -ExecutionPolicy Bypass -File kubo-agent\scripts\sign-windows.ps1 `
  -Path kubo-agent\daemon\target\release\kubo-agent.exe
signtool verify /pa /v kubo-agent\daemon\target\release\kubo-agent.exe
```

## 4. Package and install the VS Code / Cursor extension

```powershell
cd kubo-agent\extension
npm install
npm run compile
npx vsce package        # produces kubo-<version>.vsix
code --install-extension .\kubo-0.1.0.vsix        # VS Code
cursor --install-extension .\kubo-0.1.0.vsix      # Cursor
```

## 5. Run the daemon and verify real credits

```powershell
$env:KUBO_API_BASE = "https://kubovibe.dev/api"
.\kubo-agent\daemon\target\release\kubo-agent.exe
```

1. In VS Code, set `kubo.projectId` to a real project UUID (Settings → Extensions → KUBO).
2. Run **KUBO: Status** — the status bar must show the daemon online.
3. Run **KUBO: Chat** (1 credit) and **KUBO: Edit** (2 credits).
4. Open `/admin/agent` in the app: the ping shows `online`, and each command appears
   in the **Logs** tab with the credits actually deducted from the ledger
   (`credit_transactions`, category `local_agent`) — no simulation.

Costs: chat 1 · edit 2 · agent run 4 · terminal 0 · git 0.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `/admin/agent` shows offline | The daemon binds to `127.0.0.1` only — open the panel on the same PC, or check the port in `kubo.agentPort`. |
| `401 unauthorized` on commands | The daemon needs a signed-in access token; re-run **KUBO: Status** after signing in on kubovibe.dev. |
| `signtool not found` | Add `C:\Program Files (x86)\Windows Kits\10\bin\<ver>\x64` to `PATH`. |
| Credits not moving | Confirm `KUBO_API_BASE` points at `https://kubovibe.dev/api` and the project UUID is valid. |
