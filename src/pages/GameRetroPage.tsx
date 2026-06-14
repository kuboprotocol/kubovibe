import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Gamepad2, Pause, Play, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  RetroRenderer,
  PALETTES,
  type PaletteName,
  spriteFromAscii,
  sheetFromSprites,
  createTilemap,
  setTile,
  type Sprite,
} from '@/game/retro';

// ---------- Demo content ----------
const LEGEND = { '.': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, A: 10, B: 11, C: 12, D: 13, E: 14, F: 15 } as const;

// 8x8 hero sprite
const HERO: Sprite = spriteFromAscii(
  [
    '..8888..',
    '.888888.',
    '.8FFFF8.',
    '.8F88F8.',
    '.888888.',
    '..8888..',
    '.9.99.9.',
    '.8...8..',
  ],
  LEGEND,
);

// 8x8 tiles for a tilemap: 0=grass, 1=stone, 2=gold
const TILE_GRASS = spriteFromAscii(
  ['EEEEEEEE', 'EEEEEEEE', 'EEEDEDEE', 'EEEEEEEE', 'EEEEEEEE', 'EDEEEDEE', 'EEEEEEEE', 'EEEEEEEE'],
  LEGEND,
);
const TILE_STONE = spriteFromAscii(
  ['44444444', '45554544', '45555544', '44444444', '45554544', '44545554', '45555544', '44444444'],
  LEGEND,
);
const TILE_GOLD = spriteFromAscii(
  ['99999999', '9AAAAAAA9'.slice(0, 8), '9AFFFFA9', '9AFFFFA9', '9AFFFFA9', '9AAAAA99', '99999999', '99999999'],
  LEGEND,
);

const SHEET = sheetFromSprites([TILE_GRASS, TILE_STONE, TILE_GOLD], 4);

export default function GameRetroPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RetroRenderer | null>(null);
  const rafRef = useRef<number>();
  const stateRef = useRef({ x: 32, y: 56, vx: 0, vy: 0, t: 0, paused: false, keys: new Set<string>(), gold: 0 });

  const [palette, setPalette] = useState<PaletteName>('kubo');
  const [paused, setPaused] = useState(false);
  const [score, setScore] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new RetroRenderer(canvasRef.current, {
      width: 160,
      height: 144,
      palette: PALETTES[palette],
      scale: 4,
      background: 13,
    });
    rendererRef.current = renderer;

    // Build a small tilemap (20x18 tiles at 8px = 160x144)
    const map = createTilemap(20, 18, SHEET, 0);
    for (let x = 0; x < 20; x++) setTile(map, x, 17, 1); // floor
    for (let i = 0; i < 20; i++) {
      setTile(map, Math.floor(Math.random() * 20), Math.floor(Math.random() * 14) + 2, 1);
    }
    const goldPositions: Array<{ x: number; y: number; taken: boolean }> = [];
    for (let i = 0; i < 8; i++) {
      const gx = Math.floor(Math.random() * 18) + 1;
      const gy = Math.floor(Math.random() * 12) + 2;
      setTile(map, gx, gy, 2);
      goldPositions.push({ x: gx, y: gy, taken: false });
    }

    const onKeyDown = (e: KeyboardEvent) => {
      stateRef.current.keys.add(e.key.toLowerCase());
      if (e.key === ' ') { stateRef.current.paused = !stateRef.current.paused; setPaused(stateRef.current.paused); }
    };
    const onKeyUp = (e: KeyboardEvent) => stateRef.current.keys.delete(e.key.toLowerCase());
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const s = stateRef.current;
      if (!s.paused) {
        s.t += dt;
        const speed = 60;
        s.vx = (s.keys.has('arrowright') || s.keys.has('d') ? 1 : 0) - (s.keys.has('arrowleft') || s.keys.has('a') ? 1 : 0);
        s.vy = (s.keys.has('arrowdown') || s.keys.has('s') ? 1 : 0) - (s.keys.has('arrowup') || s.keys.has('w') ? 1 : 0);
        s.x = Math.max(0, Math.min(152, s.x + s.vx * speed * dt));
        s.y = Math.max(0, Math.min(128, s.y + s.vy * speed * dt));

        // gold pickups
        const tileX = Math.floor((s.x + 4) / 8);
        const tileY = Math.floor((s.y + 4) / 8);
        for (const g of goldPositions) {
          if (!g.taken && g.x === tileX && g.y === tileY) {
            g.taken = true;
            setTile(map, g.x, g.y, 0);
            s.gold += 1;
            setScore(s.gold);
          }
        }
      }

      renderer.clear(13);
      // sky gradient via horizontal bands
      for (let y = 0; y < 80; y++) renderer.rectFill(0, y, 160, 1, y < 30 ? 1 : 2);
      renderer.drawTilemap(map, 0, 0);
      // hero with idle bob
      const bob = Math.sin(s.t * 6) > 0 ? 0 : -1;
      renderer.blitSprite(HERO, Math.round(s.x), Math.round(s.y) + bob, s.vx < 0);
      // HUD
      renderer.rectFill(0, 0, 160, 9, 0);
      renderer.text(`GOLD ${String(s.gold).padStart(2, '0')}`, 2, 2, 9);
      renderer.text(`KUBO RETRO`, 100, 2, 8);
      if (s.paused) renderer.text('PAUSED', 64, 70, 10);
      renderer.flush();

      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [palette]);

  const reset = () => {
    stateRef.current.x = 32;
    stateRef.current.y = 56;
    stateRef.current.gold = 0;
    setScore(0);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/game">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">
                KUBO <span className="neon-text">RETRO</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="neon-ring">SCORE {score}</Badge>
            <Select value={palette} onValueChange={(v) => setPalette(v as PaletteName)}>
              <SelectTrigger className="w-32 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="kubo">KUBO 16</SelectItem>
                <SelectItem value="pico8">PICO-8</SelectItem>
                <SelectItem value="nes">NES</SelectItem>
                <SelectItem value="gameboy">Game Boy</SelectItem>
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={() => { stateRef.current.paused = !stateRef.current.paused; setPaused(stateRef.current.paused); }}>
              {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
            </Button>
            <Button size="sm" variant="outline" onClick={reset}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="glass-premium p-4 flex items-center justify-center">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-2xl"
            style={{ imageRendering: 'pixelated', background: '#000' }}
            tabIndex={0}
          />
        </Card>

        <Card className="glass-premium p-4 space-y-4">
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">VIRTUAL DISPLAY</div>
            <div className="text-sm font-mono">160 × 144 px · 4× upscale · indexed color</div>
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">CONTROLS</div>
            <ul className="text-sm space-y-1 font-mono">
              <li>Arrows / WASD — Move hero</li>
              <li>Space — Pause / resume</li>
              <li>Walk onto gold tiles to collect</li>
            </ul>
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">ENGINE</div>
            <p className="text-xs text-muted-foreground">
              Pixel-perfect renderer with Uint32 framebuffer, indexed-color sprites,
              tilemap rendering and authentic 8/16-bit palettes (NES, Game Boy, PICO-8, KUBO).
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
