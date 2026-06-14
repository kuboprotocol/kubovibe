import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Package, Code, Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import {
  createRetroGame, createRpgGame, retro, rpg, VERSION,
  type RetroGameHandle,
} from '@/sdk';

const SNIPPETS = {
  retro: `import { createRetroGame, retro } from '@kubo/sdk';

const game = createRetroGame({
  canvas: document.querySelector('canvas')!,
  width: 160, height: 144, scale: 4, palette: 'kubo',
  update: (r, dt) => {
    r.clear(0);
    r.text('HELLO KUBO', 40, 60, 9);
    r.flush();
  },
});`,
  rpg: `import { createRpgGame, rpg } from '@kubo/sdk';

const game = createRpgGame({ mapWidth: 32, mapHeight: 24 });
const battle = game.startBattleWith(rpg.ENEMY_GOBLIN);

const events = rpg.resolveTurn(battle, { kind: 'attack' });
console.log(events, battle.outcome);`,
  metaverse: `import { createMetaverseRoom } from '@kubo/sdk';

const room = await createMetaverseRoom({
  roomId: 'lobby',
  identity: { id: 'u1', name: 'Alice', color: '#C9941A' },
});
room.onPeers(list => console.log('peers', list));
room.onChat(msg => console.log('chat', msg));
room.sendPose({ x: 0, y: 0, z: 5, ry: 0 });
room.sendChat('hi!');`,
};

function CopyButton({ code }: { code: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      size="sm"
      variant="outline"
      onClick={() => {
        navigator.clipboard.writeText(code);
        setDone(true);
        toast({ title: 'Copied', description: 'Snippet on your clipboard.' });
        setTimeout(() => setDone(false), 1500);
      }}
    >
      {done ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
    </Button>
  );
}

export default function GameSdkPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameRef = useRef<RetroGameHandle | null>(null);
  const [tab, setTab] = useState<'retro' | 'rpg' | 'metaverse'>('retro');

  // ----- Live retro demo wired through the SDK -----
  useEffect(() => {
    if (!canvasRef.current) return;
    let t = 0;
    const stars = Array.from({ length: 40 }, () => ({
      x: Math.random() * 160, y: Math.random() * 144, s: Math.random() * 30 + 10,
    }));
    gameRef.current = createRetroGame({
      canvas: canvasRef.current,
      width: 160, height: 144, scale: 3, palette: 'kubo',
      update: (r, dt) => {
        t += dt;
        r.clear(0);
        for (const s of stars) {
          s.x -= s.s * dt;
          if (s.x < 0) { s.x = 160; s.y = Math.random() * 144; }
          r.pset(Math.floor(s.x), Math.floor(s.y), s.s > 30 ? 10 : 5);
        }
        // Sun
        r.rectFill(60, 50 + Math.sin(t * 2) * 4, 40, 40, 9);
        r.rectFill(64, 54 + Math.sin(t * 2) * 4, 32, 32, 10);
        r.text('@KUBO/SDK', 50, 14, 9);
        r.text(`V ${VERSION}`, 60, 24, 8);
        r.text('LIVE DEMO', 56, 110, 14);
        r.flush();
      },
    });
    return () => gameRef.current?.stop();
  }, []);

  // ----- One-shot RPG demo (battle log) -----
  const [battleLog, setBattleLog] = useState<string[]>([]);
  const runRpgDemo = () => {
    const game = createRpgGame({ mapWidth: 24, mapHeight: 18, seed: 42 });
    const battle = game.startBattleWith(rpg.ENEMY_GOBLIN, 1234);
    const log: string[] = [`Map ${game.map.width}×${game.map.height} · NPCs ${game.npcs.length}`];
    let safety = 0;
    while (battle.outcome === 'ongoing' && safety++ < 30) {
      const events = rpg.resolveTurn(battle, { kind: 'attack' });
      for (const e of events) {
        if (e.type === 'damage') log.push(`hit ${e.target} -${e.amount}${e.crit ? ' (crit)' : ''}`);
        else if (e.type === 'victory') log.push(`victory +${e.xp} xp +${e.gold} gold`);
        else if (e.type === 'defeat') log.push('defeat');
      }
    }
    setBattleLog(log);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/game"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button></Link>
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">@KUBO/<span className="neon-text">SDK</span></h1>
            </div>
            <Badge variant="outline" className="font-mono">v{VERSION}</Badge>
          </div>
          <Badge className="neon-ring">PUBLIC API</Badge>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 space-y-6">
        <Card className="glass-premium p-6">
          <h2 className="text-2xl font-bold font-display mb-2">Build games in one import</h2>
          <p className="text-sm text-muted-foreground max-w-2xl">
            The KUBO SDK exposes three composable namespaces — <span className="font-mono text-primary">retro</span>,{' '}
            <span className="font-mono text-primary">rpg</span>, and{' '}
            <span className="font-mono text-primary">metaverse</span> — plus high-level helpers that boot a working game
            in a single function call. Everything tree-shakes; import only what you ship.
          </p>
        </Card>

        <div className="grid lg:grid-cols-[1fr_1fr] gap-4">
          <Card className="glass-premium p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest text-muted-foreground flex items-center gap-1">
                <Code className="w-3 h-3" /> LIVE RETRO DEMO (via SDK)
              </div>
              <Badge variant="outline" className="font-mono">createRetroGame()</Badge>
            </div>
            <div className="flex justify-center">
              <canvas ref={canvasRef} className="rounded shadow-2xl" style={{ imageRendering: 'pixelated', background: '#000' }} />
            </div>
          </Card>

          <Card className="glass-premium p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="text-xs tracking-widest text-muted-foreground">SIMULATE RPG BATTLE</div>
              <Button size="sm" onClick={runRpgDemo}>Run resolveTurn() loop</Button>
            </div>
            <div className="bg-background/50 rounded p-3 font-mono text-xs h-[280px] overflow-auto border border-border/30">
              {battleLog.length === 0
                ? <span className="text-muted-foreground">Click the button to spawn a goblin and auto-resolve combat through the SDK.</span>
                : battleLog.map((l, i) => <div key={i}>&gt; {l}</div>)}
            </div>
          </Card>
        </div>

        <Card className="glass-premium p-4">
          <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
            <div className="flex items-center justify-between mb-3">
              <TabsList>
                <TabsTrigger value="retro">retro</TabsTrigger>
                <TabsTrigger value="rpg">rpg</TabsTrigger>
                <TabsTrigger value="metaverse">metaverse</TabsTrigger>
              </TabsList>
              <CopyButton code={SNIPPETS[tab]} />
            </div>
            {(['retro', 'rpg', 'metaverse'] as const).map((k) => (
              <TabsContent key={k} value={k}>
                <pre className="bg-background/60 border border-border/30 rounded p-4 text-xs font-mono overflow-auto">
                  <code>{SNIPPETS[k]}</code>
                </pre>
              </TabsContent>
            ))}
          </Tabs>
        </Card>

        <Card className="glass-premium p-6">
          <h3 className="text-lg font-bold mb-3">Surface</h3>
          <div className="grid sm:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-mono text-primary mb-1">retro</div>
              <p className="text-xs text-muted-foreground">RetroRenderer, PALETTES (nes/gameboy/pico8/kubo), spriteFromAscii, sheetFromSprites, createTilemap.</p>
            </div>
            <div>
              <div className="font-mono text-primary mb-1">rpg</div>
              <p className="text-xs text-muted-foreground">generateOverworld, createBattle, resolveTurn, addItem, startDialogue, default HERO/ENEMY/NPC content.</p>
            </div>
            <div>
              <div className="font-mono text-primary mb-1">metaverse</div>
              <p className="text-xs text-muted-foreground">MetaverseRoom (presence + broadcast), createMetaverseScene, createAvatar Three.js factory.</p>
            </div>
          </div>
        </Card>

        <p className="text-xs text-muted-foreground text-center">
          Full reference lives at <Link to="/docs" className="text-primary underline">/docs</Link>. Source: <code className="font-mono">src/sdk/</code>.
        </p>
      </div>
    </div>
  );
}
