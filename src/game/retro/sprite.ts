/**
 * Indexed-color sprite primitives.
 * Each pixel is a single palette index (0..palette.length-1). Index 0 = transparent.
 */

export interface Sprite {
  width: number;
  height: number;
  /** Row-major palette indices, length = width*height. */
  pixels: Uint8Array;
}

export interface SpriteSheet {
  tileWidth: number;
  tileHeight: number;
  columns: number;
  rows: number;
  pixels: Uint8Array; // full atlas indices
}

/** Build a sprite from a list of strings where each char maps via legend. */
export function spriteFromAscii(rows: string[], legend: Record<string, number>): Sprite {
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  const pixels = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const row = rows[y];
    for (let x = 0; x < width; x++) {
      pixels[y * width + x] = legend[row[x]] ?? 0;
    }
  }
  return { width, height, pixels };
}

/** Build a sheet from a tiled atlas of equal-size sprites described as ASCII. */
export function sheetFromSprites(sprites: Sprite[], columns: number): SpriteSheet {
  if (sprites.length === 0) throw new Error('sheetFromSprites: empty');
  const tileWidth = sprites[0].width;
  const tileHeight = sprites[0].height;
  const rows = Math.ceil(sprites.length / columns);
  const pixels = new Uint8Array(tileWidth * columns * tileHeight * rows);
  sprites.forEach((sp, i) => {
    if (sp.width !== tileWidth || sp.height !== tileHeight) {
      throw new Error('sheetFromSprites: inconsistent sprite size');
    }
    const cx = (i % columns) * tileWidth;
    const cy = Math.floor(i / columns) * tileHeight;
    for (let y = 0; y < tileHeight; y++) {
      for (let x = 0; x < tileWidth; x++) {
        pixels[(cy + y) * (tileWidth * columns) + (cx + x)] = sp.pixels[y * tileWidth + x];
      }
    }
  });
  return { tileWidth, tileHeight, columns, rows, pixels };
}

export function tileFromSheet(sheet: SpriteSheet, index: number): Sprite {
  const cx = (index % sheet.columns) * sheet.tileWidth;
  const cy = Math.floor(index / sheet.columns) * sheet.tileHeight;
  const stride = sheet.tileWidth * sheet.columns;
  const pixels = new Uint8Array(sheet.tileWidth * sheet.tileHeight);
  for (let y = 0; y < sheet.tileHeight; y++) {
    for (let x = 0; x < sheet.tileWidth; x++) {
      pixels[y * sheet.tileWidth + x] = sheet.pixels[(cy + y) * stride + (cx + x)];
    }
  }
  return { width: sheet.tileWidth, height: sheet.tileHeight, pixels };
}
