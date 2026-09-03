import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Apple,
  ArrowLeft,
  Check,
  Cloud,
  Coins,
  Cpu,
  Download,
  Laptop,
  Monitor,
  ShieldCheck,
  Smartphone,
  Terminal,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  BILLING_MODELS,
  CLOUD_CREDIT_COSTS,
  LOCAL_CREDIT_COSTS,
  PLATFORMS,
  type PlatformId,
  type PlatformSpec,
  billingFor,
  platformsByFamily,
} from "@/lib/anywhereConfig";
import { cn } from "@/lib/utils";

const PLATFORM_ICONS: Record<PlatformId, typeof Monitor> = {
  windows: Monitor,
  macos: Laptop,
  linux: Terminal,
  ios: Apple,
  android: Smartphone,
};

const STATUS_STYLES: Record<PlatformSpec["status"], string> = {
  available: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  beta: "border-primary/30 bg-primary/10 text-primary",
  planned: "border-border bg-muted text-muted-foreground",
};

function detectPlatform(): PlatformId {
  if (typeof navigator === "undefined") return "windows";
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  if (/Mac/i.test(ua)) return "macos";
  if (/Linux/i.test(ua)) return "linux";
  return "windows";
}

const ONBOARDING_STEPS = [
  {
    title: "Install the daemon",
    body: "A single signed installer drops a lightweight Rust service that runs in the background and keeps a persistent link with KUBO Core AI.",
  },
  {
    title: "Grant a workspace folder",
    body: "Access is scoped per project. The daemon never watches your whole filesystem — you pick the folders it may read and write.",
  },
  {
    title: "Connect your editor",
    body: "Onboarding detects VS Code and Cursor on the machine and installs the bridge extension with one click. Both share the same daemon.",
  },
  {
    title: "Keep working where you already are",
    body: "Chat with Vibe Code inside the editor, run real commands in your own shell, and push to GitMoom with the local git binary.",
  },
] as const;

function PlatformCard({ platform, highlighted }: { platform: PlatformSpec; highlighted: boolean }) {
  const Icon = PLATFORM_ICONS[platform.id];
  const billing = billingFor(platform);

  return (
    <Card
      className={cn(
        "flex h-full flex-col gap-4 border-border/50 bg-card/60 p-6 backdrop-blur transition-colors",
        highlighted && "border-primary/50 shadow-[0_0_40px_-20px_hsl(var(--primary))]",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="rounded-xl border border-border/60 bg-background/60 p-2.5">
            <Icon className="h-5 w-5 text-primary" />
          </span>
          <div>
            <h3 className="font-orbitron text-base font-bold">{platform.name}</h3>
            <p className="text-xs text-muted-foreground">{platform.client}</p>
          </div>
        </div>
        <Badge variant="outline" className={cn("text-[10px] uppercase", STATUS_STYLES[platform.status])}>
          {platform.status}
        </Badge>
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1 text-[10px] uppercase">
          {platform.execution === "cloud" ? <Cloud className="h-3 w-3" /> : <Cpu className="h-3 w-3" />}
          {platform.execution === "cloud" ? "Remote execution" : "Local execution"}
        </Badge>
        <Badge variant="outline" className="gap-1 text-[10px] uppercase">
          <Coins className="h-3 w-3" /> {billing.label}
        </Badge>
      </div>

      <ul className="space-y-2">
        {platform.capabilities.map((cap) => (
          <li key={cap} className="flex gap-2 text-xs text-muted-foreground">
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            <span>{cap}</span>
          </li>
        ))}
        {platform.limitations.map((limit) => (
          <li key={limit} className="flex gap-2 text-xs text-muted-foreground/80">
            <X className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span>{limit}</span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-2">
        {platform.download ? (
          <Button asChild className="w-full">
            <a href={platform.download.href} download>
              <Download className="mr-2 h-4 w-4" /> {platform.download.label}
            </a>
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link to="/m">Open the mobile client</Link>
          </Button>
        )}
      </div>
    </Card>
  );
}

export default function AnywherePage() {
  const [detected] = useState<PlatformId>(() => detectPlatform());
  const desktop = useMemo(() => platformsByFamily("desktop"), []);
  const mobile = useMemo(() => platformsByFamily("mobile"), []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/50 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
          <Button asChild variant="ghost" size="sm">
            <Link to="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" /> Dashboard
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link to="/docs">Architecture docs</Link>
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <motion.section
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-3xl text-center"
        >
          <Badge variant="outline" className="mb-4 border-primary/30 bg-primary/10 text-primary">
            KUBO Anywhere
          </Badge>
          <h1 className="font-orbitron text-3xl font-bold tracking-tight sm:text-4xl">
            One workspace. Every device.
          </h1>
          <p className="mt-4 text-sm text-muted-foreground sm:text-base">
            On desktop the KUBO Local Agent runs everything on your own hardware. On phone and tablet the client
            drives an ephemeral container in the KUBO Cloud — the device never executes code. Same project, same
            chat, same Git history, one credit ledger.
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Detected platform: <span className="font-semibold text-foreground">{detected}</span>
          </p>
        </motion.section>

        <section className="mt-14">
          <div className="mb-5 flex items-center gap-2">
            <Cpu className="h-4 w-4 text-primary" />
            <h2 className="font-orbitron text-lg font-bold">Desktop — KUBO Local Agent</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {desktop.map((p) => (
              <PlatformCard key={p.id} platform={p} highlighted={p.id === detected} />
            ))}
          </div>

          <Card className="mt-6 border-border/50 bg-card/60 p-6 backdrop-blur">
            <h3 className="font-orbitron text-sm font-bold">How the install goes</h3>
            <ol className="mt-4 grid gap-4 md:grid-cols-4">
              {ONBOARDING_STEPS.map((step, i) => (
                <li key={step.title} className="space-y-1.5">
                  <span className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xs font-bold text-primary">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold">{step.title}</p>
                  <p className="text-xs text-muted-foreground">{step.body}</p>
                </li>
              ))}
            </ol>
            <p className="mt-5 flex items-start gap-2 rounded-lg border border-border/50 bg-background/50 p-3 text-xs text-muted-foreground">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              Installers are code-signed (Authenticode on Windows, Apple notarization on macOS) and the daemon only
              ever touches folders you explicitly approve.
            </p>
          </Card>
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-center gap-2">
            <Cloud className="h-4 w-4 text-primary" />
            <h2 className="font-orbitron text-lg font-bold">Mobile — KUBO Mobile Agent</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {mobile.map((p) => (
              <PlatformCard key={p.id} platform={p} highlighted={p.id === detected} />
            ))}
          </div>
        </section>

        <section className="mt-14">
          <div className="mb-5 flex items-center gap-2">
            <Coins className="h-4 w-4 text-primary" />
            <h2 className="font-orbitron text-lg font-bold">How credits are charged</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <Card className="space-y-3 border-border/50 bg-card/60 p-6 backdrop-blur">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Cloud className="h-4 w-4 text-primary" /> {BILLING_MODELS.cloud.label}
              </h3>
              <p className="text-xs text-muted-foreground">{BILLING_MODELS.cloud.description}</p>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Active container minute</dt>
                  <dd className="font-semibold">{CLOUD_CREDIT_COSTS.perMinute} credit</dd>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Build run</dt>
                  <dd className="font-semibold">{CLOUD_CREDIT_COSTS.build} credits</dd>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Deploy run</dt>
                  <dd className="font-semibold">{CLOUD_CREDIT_COSTS.deploy} credits</dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground">Applies to iOS, iPadOS and Android.</p>
            </Card>

            <Card className="space-y-3 border-border/50 bg-card/60 p-6 backdrop-blur">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Cpu className="h-4 w-4 text-primary" /> {BILLING_MODELS.local.label}
              </h3>
              <p className="text-xs text-muted-foreground">{BILLING_MODELS.local.description}</p>
              <dl className="space-y-2 text-xs">
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Chat message</dt>
                  <dd className="font-semibold">{LOCAL_CREDIT_COSTS.chatMessage} credit</dd>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Applied code edit</dt>
                  <dd className="font-semibold">{LOCAL_CREDIT_COSTS.codeEdit} credits</dd>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Agent run</dt>
                  <dd className="font-semibold">{LOCAL_CREDIT_COSTS.agentRun} credits</dd>
                </div>
                <div className="flex justify-between border-t border-border/40 pt-2">
                  <dt className="text-muted-foreground">Terminal command / git op</dt>
                  <dd className="font-semibold">Free</dd>
                </div>
              </dl>
              <p className="text-[11px] text-muted-foreground">Applies to Windows, macOS and Linux.</p>
            </Card>
          </div>
        </section>

        <section className="mt-14 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-border/60 text-[10px] uppercase text-muted-foreground">
                <th className="py-3 pr-4">Platform</th>
                <th className="py-3 pr-4">Execution</th>
                <th className="py-3 pr-4">Billing</th>
                <th className="py-3">Client</th>
              </tr>
            </thead>
            <tbody>
              {PLATFORMS.map((p) => (
                <tr key={p.id} className="border-b border-border/30">
                  <td className="py-3 pr-4 font-semibold">{p.name}</td>
                  <td className="py-3 pr-4 text-muted-foreground">
                    {p.execution === "cloud" ? "Remote container (KUBO Cloud)" : "User hardware"}
                  </td>
                  <td className="py-3 pr-4 text-muted-foreground">{billingFor(p).label}</td>
                  <td className="py-3 text-muted-foreground">{p.client}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  );
}
