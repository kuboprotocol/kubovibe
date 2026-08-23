import { useState } from "react";
import { 
  Globe, 
  Search, 
  ArrowRightLeft, 
  Link2, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Plus
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Domain {
  name: string;
  status: 'active' | 'verifying' | 'error';
  type: string;
  expires: string;
}

const DOMAINS: Domain[] = [
  { name: 'kubovibe.dev', status: 'active', type: 'Primary', expires: '2027-05-20' },
  { name: 'app.kubovibe.dev', status: 'active', type: 'Alias', expires: '2027-05-20' },
  { name: 'staging.kubovibe.dev', status: 'verifying', type: 'Preview', expires: '2027-05-20' },
];

export function VibeDomainsPanel() {
  const [search, setSearch] = useState("");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="group relative overflow-hidden border-primary/20 bg-primary/5 p-4 transition-all hover:bg-primary/10">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/20 text-primary">
            <Search className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-foreground">Buy Domain</h3>
          <p className="mt-1 text-xs text-muted-foreground">Find and register a new custom domain for your project.</p>
          <Button variant="ghost" className="mt-4 h-8 w-full justify-between text-xs font-medium">
            Register now <ChevronRight className="h-3 w-3" />
          </Button>
        </Card>

        <Card className="group relative overflow-hidden border-border/60 bg-card/30 p-4 transition-all hover:bg-card/50">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-foreground">
            <ArrowRightLeft className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-foreground">Transfer In</h3>
          <p className="mt-1 text-xs text-muted-foreground">Move an existing domain from another registrar to KUBO.</p>
          <Button variant="ghost" className="mt-4 h-8 w-full justify-between text-xs font-medium">
            Start transfer <ChevronRight className="h-3 w-3" />
          </Button>
        </Card>

        <Card className="group relative overflow-hidden border-border/60 bg-card/30 p-4 transition-all hover:bg-card/50">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-white/5 text-foreground">
            <Link2 className="h-5 w-5" />
          </div>
          <h3 className="font-semibold text-foreground">Connect Domain</h3>
          <p className="mt-1 text-xs text-muted-foreground">Use a domain you already own by updating its DNS records.</p>
          <Button variant="ghost" className="mt-4 h-8 w-full justify-between text-xs font-medium">
            Setup records <ChevronRight className="h-3 w-3" />
          </Button>
        </Card>
      </div>

      <div className="rounded-xl border border-border/40 bg-card/30 p-4 backdrop-blur-sm">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-sm font-bold uppercase tracking-widest text-muted-foreground">Active Domains</h3>
          <Badge variant="outline" className="text-[10px]">{DOMAINS.length} Total</Badge>
        </div>

        <div className="space-y-3">
          {DOMAINS.map((domain) => (
            <div key={domain.name} className="flex items-center justify-between rounded-lg border border-border/40 bg-background/40 p-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  domain.status === 'active' ? "bg-emerald-500/10 text-emerald-500" :
                  domain.status === 'verifying' ? "bg-amber-500/10 text-amber-500" : "bg-rose-500/10 text-rose-500"
                )}>
                  <Globe className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{domain.name}</span>
                    <Badge variant="secondary" className="text-[9px] uppercase tracking-tighter h-4 px-1">{domain.type}</Badge>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    {domain.status === 'active' ? (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-2.5 w-2.5" /> DNS Verified</span>
                    ) : (
                      <span className="flex items-center gap-1 animate-pulse"><Clock className="h-2.5 w-2.5" /> Propagating DNS...</span>
                    )}
                    <span>•</span>
                    <span>Expires {domain.expires}</span>
                  </div>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="h-7 text-[10px]">Edit</Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChevronRight({ className }: { className?: string }) {
  return <ArrowRightLeft className={cn("rotate-[-90deg]", className)} />;
}
import { cn } from "@/lib/utils";
