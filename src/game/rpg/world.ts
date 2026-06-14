/**
 * Overworld map generation, collision, and step-based encounter checks.
 */

import type { Combatant, NPC, RpgMap } from './types';

export const TILE = {
  GRASS: 0,
  PATH: 1,
  WATER: 2,
  TREE: 3,
  STONE: 4,
  FLOWER: 5,
  ROOF: 6,
  DOOR: 7,
} as const;

export function generateOverworld(width: number, height: number, seed = 1): RpgMap {
  const tiles = new Int16Array(width * height);
  const collision = new Uint8Array(width * height);

  // base grass with scattered flowers
  for (let i = 0; i < tiles.length; i++) {
    const r = pseudo(seed + i);
    tiles[i] = r < 0.05 ? TILE.FLOWER : TILE.GRASS;
  }

  // diagonal river of water
  for (let y = 0; y < height; y++) {
    const x = Math.floor(width / 2 + Math.sin(y * 0.4 + seed * 0.13) * 3);
    for (let dx = -1; dx <= 1; dx++) {
      const ix = x + dx;
      if (ix >= 0 && ix < width) {
        const idx = y * width + ix;
        tiles[idx] = TILE.WATER;
        collision[idx] = 1;
      }
    }
  }

  // bridge across river at mid-height
  const by = Math.floor(height / 2);
  for (let x = 0; x < width; x++) {
    const idx = by * width + x;
    if (tiles[idx] === TILE.WATER) {
      tiles[idx] = TILE.PATH;
      collision[idx] = 0;
    }
  }

  // ring of trees as border
  for (let x = 0; x < width; x++) {
    place(tiles, collision, width, x, 0, TILE.TREE, 1);
    place(tiles, collision, width, x, height - 1, TILE.TREE, 1);
  }
  for (let y = 0; y < height; y++) {
    place(tiles, collision, width, 0, y, TILE.TREE, 1);
    place(tiles, collision, width, width - 1, y, TILE.TREE, 1);
  }

  // small village at top-left
  buildHouse(tiles, collision, width, 3, 3, 4, 3);
  buildHouse(tiles, collision, width, 9, 4, 4, 3);

  // path connecting village to bridge
  for (let x = 5; x < width / 2; x++) place(tiles, collision, width, x, by, TILE.PATH, 0);
  for (let y = 5; y < by; y++) place(tiles, collision, width, 5, y, TILE.PATH, 0);

  return { width, height, tiles, collision, encounterRate: 0.12 };
}

function place(
  tiles: Int16Array,
  col: Uint8Array,
  w: number,
  x: number,
  y: number,
  tile: number,
  blocked: number,
) {
  const i = y * w + x;
  if (i < 0 || i >= tiles.length) return;
  tiles[i] = tile;
  col[i] = blocked;
}

function buildHouse(
  tiles: Int16Array,
  col: Uint8Array,
  w: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < width; dx++) {
      place(tiles, col, w, x + dx, y + dy, TILE.ROOF, 1);
    }
  }
  // door at bottom-center
  const dx = x + Math.floor(width / 2);
  place(tiles, col, w, dx, y + height - 1, TILE.DOOR, 0);
}

function pseudo(n: number): number {
  let t = (n * 2654435761) >>> 0;
  t ^= t >>> 13;
  t = Math.imul(t, 0x5bd1e995);
  return (t >>> 0) / 4294967296;
}

export function canWalk(map: RpgMap, x: number, y: number, npcs: NPC[]): boolean {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return false;
  if (map.collision[y * map.width + x]) return false;
  return !npcs.some((n) => n.x === x && n.y === y);
}

export function rollEncounter(
  map: RpgMap,
  x: number,
  y: number,
  rng: () => number,
): Combatant | null {
  if (!map.encounters?.length || !map.encounterRate) return null;
  const tile = map.tiles[y * map.width + x];
  if (tile !== TILE.GRASS && tile !== TILE.FLOWER) return null;
  if (rng() > map.encounterRate) return null;
  const e = map.encounters[Math.floor(rng() * map.encounters.length)];
  return JSON.parse(JSON.stringify(e)) as Combatant;
}
