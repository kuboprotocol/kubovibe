import { Download, Monitor, Laptop, Tablet, Smartphone, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

export function VibeTopBar() {
  const handleDownload = () => {
    toast.info("Preparing KUBO Vibe Desktop (Tauri Wrapper)...", {
      description: "Available for macOS (Universal), Windows, and Linux.",
    });
  };

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border/40 bg-background/60 px-4 backdrop-blur-xl md:px-6">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 text-sm font-medium">
          <span className="text-muted-foreground">Projects</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-foreground">kubovibe</span>
          <Badge variant="outline" className="ml-2 border-primary/20 bg-primary/5 text-primary">
            v0.1.0-alpha
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        <div className="hidden items-center gap-1 rounded-full border border-border/60 bg-background/40 p-1 md:flex">
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground">
            <Monitor className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground">
            <Laptop className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground">
            <Tablet className="h-3.5 w-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-muted-foreground">
            <Smartphone className="h-3.5 w-3.5" />
          </Button>
        </div>

        <Button 
          variant="outline" 
          size="sm" 
          className="h-8 gap-2 border-primary/20 hover:bg-primary/5"
          onClick={handleDownload}
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Download Desktop App</span>
          <span className="sm:hidden text-[10px]">App</span>
        </Button>

        <Button size="sm" className="h-8 gap-2 bg-primary text-primary-foreground shadow-[0_0_15px_rgba(201,148,26,0.2)]">
          <ExternalLink className="h-3.5 w-3.5" />
          Visit Live
        </Button>
      </div>
    </header>
  );
}
