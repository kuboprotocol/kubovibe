/**
 * KUBO Game SDK — public surface for external developers.
 *
 * Three top-level namespaces mirror the internal engine layers:
 *   - retro:     pixel-perfect 8/16-bit framebuffer + palettes + sprites + tilemaps
 *   - rpg:       turn-based battle, inventory, dialogue, procedural overworld
 *   - metaverse: Three.js shared 3D rooms over Supabase Realtime
 *
 * All exports are tree-shakable. Import only what you use:
 *
 *   import { retro } from '@kubo/sdk';
 *   const r = new retro.RetroRenderer(canvas, { width: 160, height: 144, palette: retro.KUBO_PALETTE });
 *
 *   import { rpg } from '@kubo/sdk';
 *   const map = rpg.generateOverworld(28, 22);
 *   const battle = rpg.createBattle(rpg.HERO, rpg.ENEMY_SLIME);
 *
 *   import { metaverse } from '@kubo/sdk';
 *   const room = new metaverse.MetaverseRoom('lobby', { id, name, color });
 *
 * High-level helpers (createRetroGame / createRpgGame / createMetaverseRoom)
 * bundle the common setup so simple integrations stay a single function call.
 */

import * as retro from '@/game/retro';
import * as rpg from '@/game/rpg';
import * as metaverse from '@/game/metaverse';

export { retro, rpg, metaverse };

export const VERSION = '1.0.0';

/* -------------------------------------------------------------------------- */
/* High-level convenience helpers                                              */
/* -------------------------------------------------------------------------- */

export interface CreateRetroGameOptions {
  canvas: HTMLCanvasElement;
  width?: number;
  height?: number;
  scale?: number;
  palette?: retro.PaletteName | retro.RetroPalette;
  /** Called every frame with (renderer, dt). Return false to stop. */
  update: (renderer: retro.RetroRenderer, dt: number) => boolean | void;
}

export interface RetroGameHandle {
  renderer: retro.RetroRenderer;
  stop: () => void;
}

/** Boot a retro game with a single function call. Returns a handle with stop(). */
export function createRetroGame(opts: CreateRetroGameOptions): RetroGameHandle {
  const palette =
    typeof opts.palette === 'string' || opts.palette === undefined
      ? retro.PALETTES[(opts.palette ?? 'kubo') as retro.PaletteName]
      : opts.palette;

  const renderer = new retro.RetroRenderer(opts.canvas, {
    width: opts.width ?? 160,
    height: opts.height ?? 144,
    palette,
    scale: opts.scale,
  });

  let running = true;
  let last = performance.now();
  let raf = 0;

  const loop = (now: number) => {
    if (!running) return;
    const dt = (now - last) / 1000;
    last = now;
    const cont = opts.update(renderer, dt);
    if (cont === false) { running = false; return; }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);

  return {
    renderer,
    stop: () => { running = false; cancelAnimationFrame(raf); },
  };
}

export interface CreateRpgGameOptions {
  mapWidth?: number;
  mapHeight?: number;
  seed?: number;
  hero?: rpg.Combatant;
  encounters?: rpg.Combatant[];
  encounterRate?: number;
  npcs?: rpg.NPC[];
  dialogue?: rpg.DialogueTree;
}

export interface RpgGameHandle {
  map: rpg.RpgMap;
  hero: rpg.Combatant;
  npcs: rpg.NPC[];
  dialogue: rpg.DialogueTree;
  inventory: rpg.InventorySlot[];
  startBattleWith: (enemy: rpg.Combatant, seed?: number) => rpg.Battle;
}

/** Initialize an RPG world + hero + default content in one call. */
export function createRpgGame(opts: CreateRpgGameOptions = {}): RpgGameHandle {
  const map = rpg.generateOverworld(opts.mapWidth ?? 28, opts.mapHeight ?? 22, opts.seed ?? 7);
  map.encounters = opts.encounters ?? [rpg.ENEMY_SLIME, rpg.ENEMY_GOBLIN];
  map.encounterRate = opts.encounterRate ?? 0.08;

  const hero: rpg.Combatant = opts.hero ?? JSON.parse(JSON.stringify(rpg.HERO));
  return {
    map,
    hero,
    npcs: opts.npcs ?? rpg.DEFAULT_NPCS,
    dialogue: opts.dialogue ?? rpg.DEFAULT_DIALOGUE,
    inventory: [{ item: rpg.POTION, qty: 3 }, { item: rpg.ETHER, qty: 1 }],
    startBattleWith: (enemy, seed) =>
      rpg.createBattle(JSON.parse(JSON.stringify(hero)), JSON.parse(JSON.stringify(enemy)), seed ?? Date.now()),
  };
}

export interface CreateMetaverseRoomOptions {
  roomId: string;
  identity: metaverse.AvatarIdentity;
  pose?: metaverse.AvatarPose;
}

/** Connect to a shared metaverse room. Returns the joined MetaverseRoom. */
export async function createMetaverseRoom(opts: CreateMetaverseRoomOptions): Promise<metaverse.MetaverseRoom> {
  const room = new metaverse.MetaverseRoom(opts.roomId, opts.identity);
  await room.join(opts.pose ?? { x: 0, y: 0, z: 0, ry: 0 });
  return room;
}

/* -------------------------------------------------------------------------- */
/* Type re-exports for external TS consumers                                   */
/* -------------------------------------------------------------------------- */

export type { Sprite, SpriteSheet, RetroPalette, PaletteName, RetroRendererOptions } from '@/game/retro';
export type {
  Stats, Skill, Combatant, Item, InventorySlot, NPC, RpgMap,
  DialogueTree, DialogueNode, DialogueLine, DialogueState,
  Battle, BattleAction, BattleEvent, BattleOutcome, Direction,
} from '@/game/rpg';
export type { AvatarIdentity, AvatarPose, AvatarState, ChatMessage } from '@/game/metaverse';
