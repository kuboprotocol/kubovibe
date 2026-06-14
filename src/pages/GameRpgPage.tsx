import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Swords, Heart, Zap, Package, MessageCircle, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  RetroRenderer, KUBO_PALETTE, spriteFromAscii, sheetFromSprites, type Sprite,
} from '@/game/retro';
import {
  HERO, ENEMY_SLIME, ENEMY_GOBLIN, POTION, ETHER, GOLD_COIN, DEFAULT_NPCS, DEFAULT_DIALOGUE,
  generateOverworld, canWalk, rollEncounter, createBattle, resolveTurn,
  addItem, hasItem, removeItem, startDialogue, currentLine, advance, choose,
  TILE, type Combatant, type InventorySlot, type DialogueState, type Direction,
  type Battle, type BattleAction, type Item, type NPC,
} from '@/game/rpg';

// ---------- Sprites ----------
const LEGEND = { '.': 0, '1': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, A: 10, B: 11, C: 12, D: 13, E: 14, F: 15 } as const;

// 16x16 tile = 16 tiles wide ... too big. We use 8x8 tiles.
const TILE_GRASS = spriteFromAscii(['EEEEEEEE','EEEDEDEE','EEEEEEEE','EDEEEDEE','EEEEEEEE','EEEDEEDE','EEEEEEEE','EEDEDEEE'], LEGEND);
const TILE_PATH  = spriteFromAscii(['44444444','45554544','44444454','45444454','44545544','44444454','45554444','44444444'], LEGEND);
const TILE_WATER = spriteFromAscii(['DDDDDDDD','D6DDD6DD','DDDDDDDD','DD6DDDD6','DDDDDDDD','D6DD6DDD','DDDDDDDD','DDD6DDD6'], LEGEND);
const TILE_TREE  = spriteFromAscii(['..EEE...','.EEEEE..','EEEEEEEE','EEEEEEEE','.EEEEE..','..EBE...','..EBE...','..BBB...'], LEGEND);
const TILE_STONE = spriteFromAscii(['44444444','45554544','45555444','44444444','45544544','44545554','45555444','44444444'], LEGEND);
const TILE_FLOWER= spriteFromAscii(['EEEEEEEE','EE9.9EEE','E.A9A.EE','EE9.9EEE','EEEEEEEE','EEE9.9EE','EE.A9A.E','EEE9.9EE'], LEGEND);
const TILE_ROOF  = spriteFromAscii(['FFFFFFFF','FBBBBBBF','FBBBBBBF','FBBBBBBF','22222222','24242424','22222222','22222222'], LEGEND);
const TILE_DOOR  = spriteFromAscii(['22222222','2BBBBBB2','2B8888B2','2B8998B2','2B8998B2','2B8888B2','2BBBBBB2','22222222'], LEGEND);

const TILE_SHEET = sheetFromSprites(
  [TILE_GRASS, TILE_PATH, TILE_WATER, TILE_TREE, TILE_STONE, TILE_FLOWER, TILE_ROOF, TILE_DOOR],
  4,
);

// 8x8 actor sprites (down-facing). Hero (0), Elder (1), Merchant (2), Dragon (3).
const ACTOR_HERO = spriteFromAscii(['..888...','.888BB..','.8FFFB..','.8F8FB..','.8FFFB..','..BBB...','.B888B..','.8...8..'], LEGEND);
const ACTOR_ELDER = spriteFromAscii(['..666...','.666BB..','.6FFF6..','.6F6F6..','.6FFF6..','..CCC...','.C666C..','.6...6..'], LEGEND);
const ACTOR_MERCH = spriteFromAscii(['..999...','.99988..','.9FFF9..','.9F9F9..','.9FFF9..','..BBB...','.B999B..','.9...9..'], LEGEND);
const ACTOR_DRAGON= spriteFromAscii(['.FFFFF..','FF888FF.','F8FFF8F.','F8F8F8F.','F88888F.','FF888FF.','.F8.8F..','.F...F..'], LEGEND);

const ACTORS: Sprite[] = [ACTOR_HERO, ACTOR_ELDER, ACTOR_MERCH, ACTOR_DRAGON];

const VIEW_W = 160;
const VIEW_H = 144;
const TILE_PX = 8;

interface PlayerState {
  x: number; y: number; dir: Direction; steps: number; gold: number;
}

export default function GameRpgPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<RetroRenderer | null>(null);
  const rafRef = useRef<number>();
  const rngRef = useRef<() => number>(() => Math.random());

  const map = useMemo(() => {
    const m = generateOverworld(28, 22, 7);
    m.encounters = [ENEMY_SLIME, ENEMY_GOBLIN];
    m.encounterRate = 0.08;
    return m;
  }, []);
  const [npcs, setNpcs] = useState<NPC[]>(() => DEFAULT_NPCS);

  const [player, setPlayer] = useState<PlayerState>({ x: 6, y: 7, dir: 'down', steps: 0, gold: 25 });
  const [hero, setHero] = useState<Combatant>(() => JSON.parse(JSON.stringify(HERO)));
  const [inventory, setInventory] = useState<InventorySlot[]>(() => [
    { item: POTION, qty: 3 }, { item: ETHER, qty: 1 },
  ]);

  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);
  const [battleMsg, setBattleMsg] = useState<string>('');
  const [showInv, setShowInv] = useState(false);
  const [shopWith, setShopWith] = useState<NPC | null>(null);

  const playerRef = useRef(player);
  playerRef.current = player;
  const blockedRef = useRef(false);
  blockedRef.current = !!(dialogue || battle || showInv || shopWith);

  // ---------- Movement ----------
  const tryStep = useCallback((dx: number, dy: number, dir: Direction) => {
    if (blockedRef.current) return;
    const p = playerRef.current;
    const nx = p.x + dx, ny = p.y + dy;

    // NPC interaction (face them, no step, open dialogue)
    const facedNpc = npcs.find((n) => n.x === nx && n.y === ny);
    if (facedNpc) {
      setPlayer({ ...p, dir });
      if (facedNpc.encounter) {
        const b = createBattle(JSON.parse(JSON.stringify(hero)), JSON.parse(JSON.stringify(facedNpc.encounter)), Date.now());
        setBattle(b);
        setBattleMsg(`${facedNpc.encounter.name} attacks!`);
      } else {
        setDialogue(startDialogue(DEFAULT_DIALOGUE, facedNpc.dialogue));
        if (facedNpc.shop) setShopWith(facedNpc);
      }
      return;
    }

    if (!canWalk(map, nx, ny, npcs)) {
      setPlayer({ ...p, dir });
      return;
    }
    const steps = p.steps + 1;
    const next: PlayerState = { x: nx, y: ny, dir, steps, gold: p.gold };
    setPlayer(next);

    const enemy = rollEncounter(map, nx, ny, rngRef.current);
    if (enemy) {
      const b = createBattle(JSON.parse(JSON.stringify(hero)), enemy, Date.now());
      setBattle(b);
      setBattleMsg(`A wild ${enemy.name} appears!`);
    }
  }, [map, npcs, hero]);

  // ---------- Render loop ----------
  useEffect(() => {
    if (!canvasRef.current) return;
    const renderer = new RetroRenderer(canvasRef.current, {
      width: VIEW_W, height: VIEW_H, palette: KUBO_PALETTE, scale: 3, background: 0,
    });
    rendererRef.current = renderer;

    let t = 0;
    let last = performance.now();

    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (battle || dialogue || showInv || shopWith) return;
      if (k === 'arrowup' || k === 'w') { e.preventDefault(); tryStep(0, -1, 'up'); }
      else if (k === 'arrowdown' || k === 's') { e.preventDefault(); tryStep(0, 1, 'down'); }
      else if (k === 'arrowleft' || k === 'a') { e.preventDefault(); tryStep(-1, 0, 'left'); }
      else if (k === 'arrowright' || k === 'd') { e.preventDefault(); tryStep(1, 0, 'right'); }
      else if (k === 'i') setShowInv(true);
    };
    window.addEventListener('keydown', onKey);

    const loop = (now: number) => {
      const dt = (now - last) / 1000; last = now; t += dt;
      const p = playerRef.current;
      const camX = Math.max(0, Math.min(map.width * TILE_PX - VIEW_W, p.x * TILE_PX - VIEW_W / 2 + 4));
      const camY = Math.max(0, Math.min(map.height * TILE_PX - VIEW_H, p.y * TILE_PX - VIEW_H / 2 + 4));

      renderer.clear(2);
      // tiles
      const startCol = Math.floor(camX / TILE_PX);
      const startRow = Math.floor(camY / TILE_PX);
      const endCol = Math.min(map.width, startCol + Math.ceil(VIEW_W / TILE_PX) + 1);
      const endRow = Math.min(map.height, startRow + Math.ceil(VIEW_H / TILE_PX) + 1);
      for (let r = startRow; r < endRow; r++) {
        for (let c = startCol; c < endCol; c++) {
          const tile = map.tiles[r * map.width + c];
          const sp = TILE_SHEET_SPRITES[tile] ?? TILE_SHEET_SPRITES[0];
          renderer.blitSprite(sp, c * TILE_PX - camX, r * TILE_PX - camY);
        }
      }
      // NPCs
      for (const n of npcs) {
        const sx = n.x * TILE_PX - camX;
        const sy = n.y * TILE_PX - camY;
        if (sx < -8 || sy < -8 || sx > VIEW_W || sy > VIEW_H) continue;
        renderer.blitSprite(ACTORS[n.sprite] ?? ACTORS[0], sx, sy);
      }
      // Player with bob
      const bob = Math.sin(t * 6) > 0 && (p.steps & 1) ? -1 : 0;
      renderer.blitSprite(
        ACTOR_HERO,
        Math.round(p.x * TILE_PX - camX),
        Math.round(p.y * TILE_PX - camY) + bob,
        p.dir === 'left',
      );
      // HUD
      renderer.rectFill(0, 0, VIEW_W, 9, 0);
      renderer.text(`HP ${hero.stats.hp}/${hero.stats.maxHp}`, 2, 2, 14);
      renderer.text(`LV ${hero.stats.level}`, 60, 2, 9);
      renderer.text(`GOLD ${player.gold}`, 90, 2, 9);
      renderer.flush();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', onKey);
    };
  }, [map, npcs, hero, player.gold, tryStep, battle, dialogue, showInv, shopWith]);

  // ---------- Dialogue actions ----------
  const dlgLine = dialogue ? currentLine(DEFAULT_DIALOGUE, dialogue) : null;
  const dlgAdvance = () => {
    if (!dialogue) return;
    const next = advance(DEFAULT_DIALOGUE, dialogue);
    if (next.done) {
      // grant quest reward
      if (next.flags.has('quest_dragon') && !hasItem(inventory, 'potion-reward')) {
        setInventory((inv) => addItem(inv, POTION, 1));
      }
      setDialogue(null);
    } else setDialogue(next);
  };
  const dlgChoose = (i: number) => {
    if (!dialogue) return;
    setDialogue(choose(DEFAULT_DIALOGUE, dialogue, i));
  };

  // ---------- Battle actions ----------
  const handleBattleAction = (act: BattleAction) => {
    if (!battle) return;
    const events = resolveTurn(battle, act);
    const last = events[events.length - 1];
    const msgs: string[] = [];
    for (const e of events) {
      if (e.type === 'damage') msgs.push(`${e.target === 'player' ? hero.name : battle.enemy.name} takes ${e.amount}${e.crit ? ' (crit!)' : ''}`);
      else if (e.type === 'heal') msgs.push(`${e.target === 'player' ? hero.name : battle.enemy.name} heals ${e.amount}`);
      else if (e.type === 'miss') msgs.push(`${e.actor === 'player' ? hero.name : battle.enemy.name} missed`);
      else if (e.type === 'message') msgs.push(e.text);
      else if (e.type === 'flee') msgs.push(e.success ? 'Escaped!' : 'Cannot escape!');
      else if (e.type === 'victory') msgs.push(`Victory! +${e.xp} XP +${e.gold} gold`);
      else if (e.type === 'defeat') msgs.push('You have fallen...');
    }
    setBattleMsg(msgs.join(' · '));
    setHero({ ...battle.player });
    setBattle({ ...battle });

    if (battle.outcome !== 'ongoing') {
      const winGold = events.find((e) => e.type === 'victory');
      if (winGold && winGold.type === 'victory') {
        setPlayer((p) => ({ ...p, gold: p.gold + winGold.gold }));
      }
      if (battle.outcome === 'defeat') {
        // revive at half HP, return to start
        setTimeout(() => {
          setHero((h) => ({ ...h, stats: { ...h.stats, hp: Math.ceil(h.stats.maxHp / 2) } }));
          setPlayer((p) => ({ ...p, x: 6, y: 7 }));
          setBattle(null);
        }, 1500);
      } else {
        setTimeout(() => setBattle(null), 1500);
      }
    }
  };

  const useItem = (slot: InventorySlot) => {
    if (slot.item.effect.kind === 'heal') {
      setHero((h) => ({ ...h, stats: { ...h.stats, hp: Math.min(h.stats.maxHp, h.stats.hp + (slot.item.effect.kind === 'heal' ? slot.item.effect.amount : 0)) } }));
    } else if (slot.item.effect.kind === 'mp') {
      setHero((h) => ({ ...h, stats: { ...h.stats, mp: Math.min(h.stats.maxMp, h.stats.mp + (slot.item.effect.kind === 'mp' ? slot.item.effect.amount : 0)) } }));
    } else return;
    setInventory((inv) => removeItem(inv, slot.item.id, 1));
  };

  const buyItem = (item: Item) => {
    const price = 10;
    if (player.gold < price) return;
    setPlayer((p) => ({ ...p, gold: p.gold - price }));
    setInventory((inv) => addItem(inv, item, 1));
  };

  const resetGame = () => {
    setHero(JSON.parse(JSON.stringify(HERO)));
    setPlayer({ x: 6, y: 7, dir: 'down', steps: 0, gold: 25 });
    setInventory([{ item: POTION, qty: 3 }, { item: ETHER, qty: 1 }]);
    setBattle(null); setDialogue(null); setShowInv(false); setShopWith(null);
    setNpcs(DEFAULT_NPCS);
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/game"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button></Link>
            <div className="flex items-center gap-2">
              <Swords className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">KUBO <span className="neon-text">RPG</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="neon-ring">LV {hero.stats.level}</Badge>
            <Badge variant="outline">GOLD {player.gold}</Badge>
            <Button size="sm" variant="outline" onClick={() => setShowInv(true)}><Package className="w-4 h-4" /></Button>
            <Button size="sm" variant="outline" onClick={resetGame}><RotateCcw className="w-4 h-4" /></Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="glass-premium p-4 flex flex-col items-center justify-center gap-3">
          <canvas
            ref={canvasRef}
            className="rounded-lg shadow-2xl"
            style={{ imageRendering: 'pixelated', background: '#000' }}
            tabIndex={0}
          />
          <div className="w-full max-w-md space-y-2">
            <div className="flex items-center gap-2 text-xs"><Heart className="w-3 h-3 text-red-500" /> HP
              <Progress className="flex-1 h-2" value={(hero.stats.hp / hero.stats.maxHp) * 100} />
              <span className="font-mono">{hero.stats.hp}/{hero.stats.maxHp}</span>
            </div>
            <div className="flex items-center gap-2 text-xs"><Zap className="w-3 h-3 text-blue-400" /> MP
              <Progress className="flex-1 h-2" value={(hero.stats.mp / hero.stats.maxMp) * 100} />
              <span className="font-mono">{hero.stats.mp}/{hero.stats.maxMp}</span>
            </div>
          </div>
        </Card>

        <Card className="glass-premium p-4 space-y-4">
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">CONTROLS</div>
            <ul className="text-sm space-y-1 font-mono">
              <li>Arrows / WASD — Walk</li>
              <li>Bump NPC — Talk</li>
              <li>I — Inventory</li>
            </ul>
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">QUEST</div>
            <p className="text-xs text-muted-foreground">Speak with the Village Elder, then defeat the dragon in the eastern hills.</p>
          </div>
          <div>
            <div className="text-xs tracking-widest text-muted-foreground mb-1">SKILLS</div>
            <ul className="text-xs space-y-1 font-mono">
              {hero.skills.map((s) => (
                <li key={s.id}>{s.name} <span className="text-muted-foreground">— {s.cost} MP</span></li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {/* Dialogue overlay */}
      <Dialog open={!!dialogue} onOpenChange={(o) => { if (!o) setDialogue(null); }}>
        <DialogContent className="glass-premium max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><MessageCircle className="w-5 h-5" />{dlgLine?.speaker}</DialogTitle>
          </DialogHeader>
          <p className="text-sm">{dlgLine?.text}</p>
          {dlgLine?.choices ? (
            <div className="flex flex-wrap gap-2">
              {dlgLine.choices.map((c, i) => (
                <Button key={i} size="sm" onClick={() => dlgChoose(i)}>{c.label}</Button>
              ))}
            </div>
          ) : (
            <Button onClick={dlgAdvance}>Continue →</Button>
          )}
        </DialogContent>
      </Dialog>

      {/* Battle overlay */}
      <Dialog open={!!battle} onOpenChange={() => { /* locked by outcome */ }}>
        <DialogContent className="glass-premium max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2"><Swords className="w-5 h-5" /> Battle</span>
              {battle && <Badge variant={battle.outcome === 'victory' ? 'default' : 'destructive'}>{battle.outcome}</Badge>}
            </DialogTitle>
          </DialogHeader>
          {battle && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <div className="text-xs font-mono">{battle.player.name}</div>
                  <Progress value={(battle.player.stats.hp / battle.player.stats.maxHp) * 100} />
                  <div className="text-xs">HP {battle.player.stats.hp}/{battle.player.stats.maxHp}</div>
                  <div className="text-xs">MP {battle.player.stats.mp}/{battle.player.stats.maxMp}</div>
                </div>
                <div className="space-y-1">
                  <div className="text-xs font-mono">{battle.enemy.name}</div>
                  <Progress value={(battle.enemy.stats.hp / battle.enemy.stats.maxHp) * 100} />
                  <div className="text-xs">HP {battle.enemy.stats.hp}/{battle.enemy.stats.maxHp}</div>
                  <div className="text-xs">LV {battle.enemy.stats.level}</div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground min-h-[1.5rem]">{battleMsg}</p>
              {battle.outcome === 'ongoing' && (
                <div className="grid grid-cols-2 gap-2">
                  <Button size="sm" onClick={() => handleBattleAction({ kind: 'attack' })}>Attack</Button>
                  <Button size="sm" variant="outline" onClick={() => handleBattleAction({ kind: 'flee' })}>Flee</Button>
                  {battle.player.skills.map((s) => (
                    <Button key={s.id} size="sm" variant="secondary"
                      disabled={battle.player.stats.mp < s.cost}
                      onClick={() => handleBattleAction({ kind: 'skill', skill: s })}>
                      {s.name} ({s.cost})
                    </Button>
                  ))}
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Inventory overlay */}
      <Dialog open={showInv} onOpenChange={setShowInv}>
        <DialogContent className="glass-premium max-w-md">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Package className="w-5 h-5" /> Inventory</DialogTitle></DialogHeader>
          <div className="space-y-2">
            {inventory.length === 0 && <p className="text-xs text-muted-foreground">Empty.</p>}
            {inventory.map((s) => (
              <div key={s.item.id} className="flex items-center justify-between text-sm border-b border-border/30 py-1">
                <div>
                  <div className="font-mono">{s.item.name} <span className="text-muted-foreground">×{s.qty}</span></div>
                  <div className="text-xs text-muted-foreground">{s.item.description}</div>
                </div>
                {(s.item.effect.kind === 'heal' || s.item.effect.kind === 'mp') && (
                  <Button size="sm" variant="outline" onClick={() => useItem(s)}>Use</Button>
                )}
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Shop overlay */}
      <Dialog open={!!shopWith} onOpenChange={(o) => { if (!o) setShopWith(null); }}>
        <DialogContent className="glass-premium max-w-md">
          <DialogHeader><DialogTitle>{shopWith?.name}'s Shop</DialogTitle></DialogHeader>
          <p className="text-xs text-muted-foreground">All items cost 10 gold.</p>
          <div className="space-y-2">
            {shopWith?.shop?.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-border/30 py-1">
                <div>
                  <div className="font-mono text-sm">{item.name}</div>
                  <div className="text-xs text-muted-foreground">{item.description}</div>
                </div>
                <Button size="sm" disabled={player.gold < 10} onClick={() => buyItem(item)}>Buy</Button>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Build sprite array indexed by tile constant.
const TILE_SHEET_SPRITES: Sprite[] = [];
TILE_SHEET_SPRITES[TILE.GRASS] = TILE_GRASS;
TILE_SHEET_SPRITES[TILE.PATH] = TILE_PATH;
TILE_SHEET_SPRITES[TILE.WATER] = TILE_WATER;
TILE_SHEET_SPRITES[TILE.TREE] = TILE_TREE;
TILE_SHEET_SPRITES[TILE.STONE] = TILE_STONE;
TILE_SHEET_SPRITES[TILE.FLOWER] = TILE_FLOWER;
TILE_SHEET_SPRITES[TILE.ROOF] = TILE_ROOF;
TILE_SHEET_SPRITES[TILE.DOOR] = TILE_DOOR;
// reference TILE_SHEET to keep the helper export warm
void TILE_SHEET;
// reference GOLD_COIN for future shop currency tooltips
void GOLD_COIN;
