/**
 * Pixel-perfect retro renderer.
 *
 * Maintains a low-resolution Uint32 framebuffer (the "virtual screen") and
 * blits it to a canvas at integer scale with image-rendering: pixelated so
 * pixels stay crisp. All draw calls operate in virtual coordinates.
 */

import type { RetroPalette } from './palette';
import type { Sprite } from './sprite';
import type { Tilemap } from './tilemap';
import { tileFromSheet } from './sprite';

export interface RetroRendererOptions {
  width: number;          // virtual width (e.g. 160)
  height: number;         // virtual height (e.g. 144)
  palette: RetroPalette;
  scale?: number;         // integer upscale; auto-fit when omitted
  background?: number;    // palette index for clear color
}

export class RetroRenderer {
  readonly canvas: HTMLCanvasElement;
  readonly width: number;
  readonly height: number;
  palette: RetroPalette;
  background: number;

  private ctx: CanvasRenderingContext2D;
  private image: ImageData;
  private buf32: Uint32Array;
  private scale: number;
  private offscreen: HTMLCanvasElement;
  private offCtx: CanvasRenderingContext2D;

  constructor(target: HTMLCanvasElement, opts: RetroRendererOptions) {
    this.canvas = target;
    this.width = opts.width;
    this.height = opts.height;
    this.palette = opts.palette;
    this.background = opts.background ?? 0;
    this.scale = opts.scale ?? this.fit();

    this.canvas.width = this.width * this.scale;
    this.canvas.height = this.height * this.scale;
    this.canvas.style.imageRendering = 'pixelated';

    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('RetroRenderer: 2D context unavailable');
    this.ctx = ctx;
    this.ctx.imageSmoothingEnabled = false;

    this.offscreen = document.createElement('canvas');
    this.offscreen.width = this.width;
    this.offscreen.height = this.height;
    const off = this.offscreen.getContext('2d');
    if (!off) throw new Error('RetroRenderer: offscreen context unavailable');
    this.offCtx = off;

    this.image = this.offCtx.createImageData(this.width, this.height);
    this.buf32 = new Uint32Array(this.image.data.buffer);
  }

  private fit(): number {
    const sx = Math.floor(window.innerWidth / this.width);
    const sy = Math.floor(window.innerHeight / this.height);
    return Math.max(1, Math.min(sx, sy, 8));
  }

  setScale(scale: number): void {
    this.scale = Math.max(1, Math.floor(scale));
    this.canvas.width = this.width * this.scale;
    this.canvas.height = this.height * this.scale;
    this.ctx.imageSmoothingEnabled = false;
  }

  clear(paletteIndex = this.background): void {
    this.buf32.fill(this.palette[paletteIndex] ?? 0);
  }

  /** Set a single pixel. Index 0 is treated as opaque background fill when called directly. */
  pset(x: number, y: number, paletteIndex: number): void {
    x = x | 0; y = y | 0;
    if (x < 0 || y < 0 || x >= this.width || y >= this.height) return;
    this.buf32[y * this.width + x] = this.palette[paletteIndex] ?? 0;
  }

  /** Filled rectangle. */
  rectFill(x: number, y: number, w: number, h: number, paletteIndex: number): void {
    const color = this.palette[paletteIndex] ?? 0;
    const x0 = Math.max(0, x | 0);
    const y0 = Math.max(0, y | 0);
    const x1 = Math.min(this.width, (x + w) | 0);
    const y1 = Math.min(this.height, (y + h) | 0);
    for (let yy = y0; yy < y1; yy++) {
      const base = yy * this.width;
      for (let xx = x0; xx < x1; xx++) this.buf32[base + xx] = color;
    }
  }

  /** Blit a sprite at (x,y). Index 0 is transparent. */
  blitSprite(sp: Sprite, x: number, y: number, flipX = false, flipY = false): void {
    x = x | 0; y = y | 0;
    for (let py = 0; py < sp.height; py++) {
      const dy = y + py;
      if (dy < 0 || dy >= this.height) continue;
      for (let px = 0; px < sp.width; px++) {
        const dx = x + px;
        if (dx < 0 || dx >= this.width) continue;
        const sx = flipX ? sp.width - 1 - px : px;
        const sy = flipY ? sp.height - 1 - py : py;
        const idx = sp.pixels[sy * sp.width + sx];
        if (idx === 0) continue;
        this.buf32[dy * this.width + dx] = this.palette[idx] ?? 0;
      }
    }
  }

  /** Render a tilemap with an integer pixel offset (cameraX, cameraY in virtual px). */
  drawTilemap(map: Tilemap, cameraX = 0, cameraY = 0): void {
    const tw = map.sheet.tileWidth;
    const th = map.sheet.tileHeight;
    const startCol = Math.max(0, Math.floor(cameraX / tw));
    const startRow = Math.max(0, Math.floor(cameraY / th));
    const endCol = Math.min(map.width, Math.ceil((cameraX + this.width) / tw));
    const endRow = Math.min(map.height, Math.ceil((cameraY + this.height) / th));
    for (let r = startRow; r < endRow; r++) {
      for (let c = startCol; c < endCol; c++) {
        const tile = map.cells[r * map.width + c];
        if (tile < 0) continue;
        const sp = tileFromSheet(map.sheet, tile);
        this.blitSprite(sp, c * tw - cameraX, r * th - cameraY);
      }
    }
  }

  /** Tiny 3x5 bitmap font for HUD text. */
  text(str: string, x: number, y: number, paletteIndex: number): void {
    const font = TINY_FONT;
    let cx = x | 0;
    const upper = str.toUpperCase();
    for (let i = 0; i < upper.length; i++) {
      const glyph = font[upper.charCodeAt(i)] ?? font[32]!;
      for (let py = 0; py < 5; py++) {
        const row = glyph[py];
        for (let px = 0; px < 3; px++) {
          if (row & (1 << (2 - px))) this.pset(cx + px, y + py, paletteIndex);
        }
      }
      cx += 4;
    }
  }

  /** Push the virtual framebuffer to the visible canvas. */
  flush(): void {
    this.offCtx.putImageData(this.image, 0, 0);
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.drawImage(
      this.offscreen,
      0, 0, this.width, this.height,
      0, 0, this.canvas.width, this.canvas.height,
    );
  }
}

// ---------- Tiny 3x5 font ----------
// Each glyph is 5 rows of 3 bits stored in the lowest 3 bits of a number.
const G = (...rows: number[]): number[] => rows;
const TINY_FONT: Record<number, number[]> = {
  32: G(0, 0, 0, 0, 0), // space
  48: G(0b111, 0b101, 0b101, 0b101, 0b111), // 0
  49: G(0b010, 0b110, 0b010, 0b010, 0b111), // 1
  50: G(0b111, 0b001, 0b111, 0b100, 0b111), // 2
  51: G(0b111, 0b001, 0b111, 0b001, 0b111), // 3
  52: G(0b101, 0b101, 0b111, 0b001, 0b001), // 4
  53: G(0b111, 0b100, 0b111, 0b001, 0b111), // 5
  54: G(0b111, 0b100, 0b111, 0b101, 0b111), // 6
  55: G(0b111, 0b001, 0b010, 0b010, 0b010), // 7
  56: G(0b111, 0b101, 0b111, 0b101, 0b111), // 8
  57: G(0b111, 0b101, 0b111, 0b001, 0b111), // 9
  65: G(0b111, 0b101, 0b111, 0b101, 0b101), // A
  66: G(0b110, 0b101, 0b110, 0b101, 0b110), // B
  67: G(0b111, 0b100, 0b100, 0b100, 0b111), // C
  68: G(0b110, 0b101, 0b101, 0b101, 0b110), // D
  69: G(0b111, 0b100, 0b110, 0b100, 0b111), // E
  70: G(0b111, 0b100, 0b110, 0b100, 0b100), // F
  71: G(0b111, 0b100, 0b101, 0b101, 0b111), // G
  72: G(0b101, 0b101, 0b111, 0b101, 0b101), // H
  73: G(0b111, 0b010, 0b010, 0b010, 0b111), // I
  74: G(0b001, 0b001, 0b001, 0b101, 0b111), // J
  75: G(0b101, 0b110, 0b100, 0b110, 0b101), // K
  76: G(0b100, 0b100, 0b100, 0b100, 0b111), // L
  77: G(0b101, 0b111, 0b111, 0b101, 0b101), // M
  78: G(0b101, 0b111, 0b111, 0b111, 0b101), // N
  79: G(0b111, 0b101, 0b101, 0b101, 0b111), // O
  80: G(0b111, 0b101, 0b111, 0b100, 0b100), // P
  81: G(0b111, 0b101, 0b101, 0b111, 0b011), // Q
  82: G(0b111, 0b101, 0b110, 0b101, 0b101), // R
  83: G(0b111, 0b100, 0b111, 0b001, 0b111), // S
  84: G(0b111, 0b010, 0b010, 0b010, 0b010), // T
  85: G(0b101, 0b101, 0b101, 0b101, 0b111), // U
  86: G(0b101, 0b101, 0b101, 0b101, 0b010), // V
  87: G(0b101, 0b101, 0b111, 0b111, 0b101), // W
  88: G(0b101, 0b101, 0b010, 0b101, 0b101), // X
  89: G(0b101, 0b101, 0b010, 0b010, 0b010), // Y
  90: G(0b111, 0b001, 0b010, 0b100, 0b111), // Z
  58: G(0b000, 0b010, 0b000, 0b010, 0b000), // :
  45: G(0b000, 0b000, 0b111, 0b000, 0b000), // -
  46: G(0b000, 0b000, 0b000, 0b000, 0b010), // .
  47: G(0b001, 0b001, 0b010, 0b100, 0b100), // /
};
