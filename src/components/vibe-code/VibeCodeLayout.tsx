import { useState, useEffect } from "react";
import { 
  Bot, 
  Globe, 
  Rocket, 
  Settings, 
  Files,
  ArrowRight,
  Code,
  Laptop,
  Monitor,
  Tablet,
  Smartphone
} from "lucide-react";
import { VibeSidebar } from "./VibeSidebar";
import { VibeTopBar } from "./VibeTopBar";
import { VibeCodeAgentChat } from "./VibeCodeAgentChat";
import { VibeConnectorPanel } from "./VibeConnectorPanel";
import { VibeDomainsPanel } from "./VibeDomainsPanel";
import { VibeCloudSessionPanel } from "./VibeCloudSessionPanel";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function VibeCodeLayout() {
  const [activeTab, setActiveTab] = useState("agent");
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  return (
    <div className="flex min-h-screen bg-[#030303] text-foreground font-sans selection:bg-primary/30 selection:text-primary-foreground">
      {/* Rail Sidebar (Desktop) */}
      {!isMobile && <VibeSidebar activeTab={activeTab} onTabChange={setActiveTab} />}

      <div className={cn("flex flex-1 flex-col transition-all duration-300", !isMobile && "ml-16")}>
        <VibeTopBar />
        
        <main className="flex-1 overflow-auto p-4 pb-20 md:p-6 md:pb-6">
          <div className="mx-auto max-w-7xl">
            {isMobile ? (
              <MobileView activeTab={activeTab} />
            ) : (
              <DesktopView activeTab={activeTab} setActiveTab={setActiveTab} />
            )}
          </div>
        </main>

        {/* Bottom Tab Bar (Mobile) */}
        {isMobile && (
          <div className="fixed bottom-0 left-0 z-50 flex h-16 w-full items-center justify-around border-t border-border/40 bg-card/60 backdrop-blur-xl px-2">
            <MobileNavItem 
              icon={Bot} 
              label="Agente" 
              active={activeTab === 'agent'} 
              onClick={() => setActiveTab('agent')} 
            />
            <MobileNavItem 
              icon={Code} 
              label="Preview" 
              active={activeTab === 'files'} 
              onClick={() => setActiveTab('files')} 
            />
            <MobileNavItem 
              icon={Globe} 
              label="Domínios" 
              active={activeTab === 'domains'} 
              onClick={() => setActiveTab('domains')} 
            />
            <MobileNavItem 
              icon={Rocket} 
              label="Deploys" 
              active={activeTab === 'deploys'} 
              onClick={() => setActiveTab('deploys')} 
            />
          </div>
        )}
      </div>
    </div>
  );
}

function DesktopView({ activeTab, setActiveTab }: { activeTab: string; setActiveTab: (t: string) => void }) {
  if (activeTab === 'agent' || activeTab === 'files') {
    return (
      <div className="grid h-[calc(100vh-8rem)] gap-6 lg:grid-cols-[400px_1fr]">
        <VibeCodeAgentChat />
        <div className="flex flex-col gap-6">
          <Tabs defaultValue="preview" className="flex-1">
            <TabsList className="bg-white/5 border border-white/10">
              <TabsTrigger value="preview">Live Preview</TabsTrigger>
              <TabsTrigger value="console">Console</TabsTrigger>
              <TabsTrigger value="network">Network</TabsTrigger>
            </TabsList>
            <TabsContent value="preview" className="mt-4 flex-1 rounded-2xl border border-border/40 bg-card/20 backdrop-blur-sm relative overflow-hidden group">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#8080800a_1px,transparent_1px),linear-gradient(to_bottom,#8080800a_1px,transparent_1px)] bg-[size:24px_24px]" />
              <div className="flex h-full items-center justify-center">
                 <div className="text-center">
                   <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                     <Rocket className="h-6 w-6" />
                   </div>
                   <h3 className="text-sm font-medium text-foreground">Pronto para Preview</h3>
                   <p className="text-xs text-muted-foreground mt-1">Interaja com o agente para gerar código.</p>
                 </div>
              </div>
            </TabsContent>
          </Tabs>
          <VibeConnectorPanel />
        </div>
      </div>
    );
  }

  if (activeTab === 'domains') {
    return <VibeDomainsPanel />;
  }

  if (activeTab === 'deploys') {
    return <VibeCloudSessionPanel />;
  }

  return (
    <div className="flex h-[calc(100vh-10rem)] items-center justify-center rounded-2xl border border-dashed border-border/60">
      <div className="text-center">
        <h3 className="text-lg font-medium text-muted-foreground">Módulo em construção</h3>
        <p className="text-sm text-muted-foreground/60">A seção de {activeTab} estará disponível em breve.</p>
      </div>
    </div>
  );
}

function MobileView({ activeTab }: { activeTab: string }) {
  switch (activeTab) {
    case 'agent':
      return <VibeCodeAgentChat />;
    case 'domains':
      return <VibeDomainsPanel />;
    case 'deploys':
      return <VibeCloudSessionPanel />;
    case 'files':
      return (
        <div className="flex h-[calc(100vh-12rem)] items-center justify-center rounded-2xl border border-border/40 bg-card/20">
          <p className="text-sm text-muted-foreground">Modo Preview Mobile</p>
        </div>
      );
    default:
      return (
        <div className="py-20 text-center">
          <p className="text-muted-foreground">Módulo mobile disponível em breve.</p>
        </div>
      );
  }
}

function MobileNavItem({ icon: Icon, label, active, onClick }: { icon: any; label: string; active: boolean; onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 transition-colors",
        active ? "text-primary" : "text-muted-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5", active && "animate-pulse")} />
      <span className="text-[10px] font-medium uppercase tracking-tighter">{label}</span>
    </button>
  );
}
