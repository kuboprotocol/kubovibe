import { 
  Bot, 
  Files, 
  Globe, 
  Rocket, 
  Plug, 
  Settings,
  ChevronRight
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SidebarItemProps {
  icon: any;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

function SidebarItem({ icon: Icon, label, active, onClick }: SidebarItemProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-full items-center justify-center rounded-lg transition-all duration-200",
        active 
          ? "bg-primary/10 text-primary shadow-[0_0_15px_rgba(201,148,26,0.15)]" 
          : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
      )}
    >
      <Icon className={cn("h-5 w-5 transition-transform group-hover:scale-110", active && "animate-pulse")} />
      
      {/* Tooltip-like label for rail */}
      <div className="absolute left-14 z-50 hidden rounded-md border border-border bg-popover px-2 py-1 text-xs font-medium text-popover-foreground shadow-md group-hover:block whitespace-nowrap">
        {label}
      </div>

      {active && (
        <div className="absolute left-0 h-5 w-1 rounded-r-full bg-primary" />
      )}
    </button>
  );
}

export function VibeSidebar({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) {
  return (
    <aside className="fixed left-0 top-0 z-40 flex h-full w-16 flex-col items-center border-r border-border/40 bg-card/30 backdrop-blur-xl py-4 transition-all hover:w-16 md:flex hidden">
      <div className="mb-8 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 p-2 shadow-[0_0_20px_rgba(201,148,26,0.2)]">
        <div className="h-full w-full rounded-lg bg-primary" />
      </div>

      <nav className="flex w-full flex-1 flex-col items-center gap-4 px-3">
        <SidebarItem 
          icon={Bot} 
          label="Agent" 
          active={activeTab === 'agent'} 
          onClick={() => onTabChange('agent')}
        />
        <SidebarItem 
          icon={Files} 
          label="Files" 
          active={activeTab === 'files'} 
          onClick={() => onTabChange('files')}
        />
        <SidebarItem 
          icon={Globe} 
          label="Domains" 
          active={activeTab === 'domains'} 
          onClick={() => onTabChange('domains')}
        />
        <SidebarItem 
          icon={Rocket} 
          label="Deploys" 
          active={activeTab === 'deploys'} 
          onClick={() => onTabChange('deploys')}
        />
        <SidebarItem 
          icon={Plug} 
          label="Integrations" 
          active={activeTab === 'integrations'} 
          onClick={() => onTabChange('integrations')}
        />
      </nav>

      <div className="mt-auto flex w-full flex-col items-center gap-4 px-3">
        <SidebarItem 
          icon={Settings} 
          label="Settings" 
          active={activeTab === 'settings'} 
          onClick={() => onTabChange('settings')}
        />
      </div>
    </aside>
  );
}
