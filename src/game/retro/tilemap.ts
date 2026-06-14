/**
 * Simple integer tilemap. Cell value = sprite index in the bound SpriteSheet.
 * Negative values are treated as empty.
 */

import type { SpriteSheet } from './sprite';

export interface Tilemap {
  width: number;
  height: number;
  /** Row-major, length = width*height. Use -1 for empty. */
  cells: Int16Array;
  sheet: SpriteSheet;
}

export function createTilemap(width: number, height: number, sheet: SpriteSheet, fill = -1): Tilemap {
  const cells = new Int16Array(width * height);
  if (fill !== 0) cells.fill(fill);
  return { width, height, cells, sheet };
}

export function setTile(map: Tilemap, x: number, y: number, tile: number): void {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return;
  map.cells[y * map.width + x] = tile;
}

export function getTile(map: Tilemap, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= map.width || y >= map.height) return -1;
  return map.cells[y * map.width + x];
}
