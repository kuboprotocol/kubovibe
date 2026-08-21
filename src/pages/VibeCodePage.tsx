import { VibeCodeAgentChat } from "@/components/vibe-code/VibeCodeAgentChat";
import { VibeConnectorPanel } from "@/components/vibe-code/VibeConnectorPanel";

export default function VibeCodePage() {
  return (
    <main className="min-h-screen bg-background px-4 py-6 md:px-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Vibe Code Agent</h1>
        <p className="text-sm text-muted-foreground">
          Turn a prompt into a real commit — every reasoning, read and edit step is visible in real time.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
        <div className="h-[calc(100vh-13rem)] min-h-[520px]">
          <VibeCodeAgentChat />
        </div>
        <VibeConnectorPanel />
      </div>
    </main>
  );
}
