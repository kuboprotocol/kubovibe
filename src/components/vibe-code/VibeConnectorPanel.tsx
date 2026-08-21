import { useEffect, useState } from "react";
import { Github, Database, CreditCard, Globe, Plug, CheckCircle2, Circle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import type { VibeConnectorState } from "@/lib/vibeCodeAgentTypes";

const ICONS = {
  github: Github,
  supabase: Database,
  stripe: CreditCard,
  ionos: Globe,
  mcp: Plug,
} as const;

const BASE: VibeConnectorState[] = [
  { slug: "github", label: "GitHub", description: "Commits every agent edit into your repository.", connected: false },
  { slug: "supabase", label: "Cloud", description: "Database, auth and edge functions.", connected: true },
  { slug: "stripe", label: "Stripe", description: "Billing and credit top-ups.", connected: false },
  { slug: "ionos", label: "IONOS", description: "Domains and DNS automation.", connected: false },
  { slug: "mcp", label: "MCP", description: "External tool servers for the agent.", connected: false },
];

export function VibeConnectorPanel() {
  const [connectors, setConnectors] = useState<VibeConnectorState[]>(BASE);

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!active || !data?.user) return;
      const { data: rows } = await supabase
        .from("connector_credentials")
        .select("provider")
        .eq("user_id", data.user.id);
      const providers = new Set((rows ?? []).map((r: { provider: string }) => r.provider));
      setConnectors((prev) =>
        prev.map((c) =>
          c.slug === "supabase" ? c : { ...c, connected: providers.has(c.slug) || c.connected },
        ),
      );
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <Card className="p-4 space-y-3 bg-card/60 backdrop-blur border-border/60">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold tracking-wide uppercase text-muted-foreground">
          Connectors
        </h3>
        <Badge variant="outline" className="text-[10px]">
          {connectors.filter((c) => c.connected).length}/{connectors.length}
        </Badge>
      </div>

      <div className="space-y-2">
        {connectors.map((c) => {
          const Icon = ICONS[c.slug];
          return (
            <div
              key={c.slug}
              className="flex items-start gap-3 rounded-lg border border-border/50 bg-background/40 p-3"
            >
              <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  {c.connected ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-snug">{c.description}</p>
              </div>
              {!c.connected && (
                <Button asChild size="sm" variant="ghost" className="h-7 text-xs">
                  <a href={`/connectors/${c.slug}`}>Connect</a>
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}

export default VibeConnectorPanel;
