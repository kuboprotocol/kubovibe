/**
 * Retro color palettes — authentic 8/16-bit lookups.
 * All colors are stored as 0xAARRGGBB integers for fast Uint32 framebuffer writes.
 */

export type RetroPalette = Uint32Array;

const rgb = (r: number, g: number, b: number, a = 255): number =>
  ((a & 0xff) << 24) | ((b & 0xff) << 16) | ((g & 0xff) << 8) | (r & 0xff);

/** Classic NES (subset 32 entries — most-used). */
export const NES_PALETTE: RetroPalette = new Uint32Array([
  rgb(0, 0, 0), rgb(124, 124, 124), rgb(188, 188, 188), rgb(252, 252, 252),
  rgb(0, 0, 252), rgb(0, 120, 248), rgb(60, 188, 252), rgb(168, 228, 252),
  rgb(0, 0, 188), rgb(0, 88, 248), rgb(104, 136, 252), rgb(216, 184, 248),
  rgb(68, 40, 188), rgb(104, 68, 252), rgb(152, 120, 248), rgb(216, 184, 248),
  rgb(148, 0, 132), rgb(216, 0, 204), rgb(248, 120, 248), rgb(248, 184, 248),
  rgb(168, 0, 32), rgb(228, 0, 88), rgb(248, 88, 152), rgb(248, 164, 192),
  rgb(168, 16, 0), rgb(248, 56, 0), rgb(248, 120, 88), rgb(240, 208, 176),
  rgb(0, 168, 0), rgb(0, 184, 0), rgb(184, 248, 24), rgb(216, 248, 120),
]);

/** Game Boy classic 4-shade green. */
export const GAMEBOY_PALETTE: RetroPalette = new Uint32Array([
  rgb(15, 56, 15),
  rgb(48, 98, 48),
  rgb(139, 172, 15),
  rgb(155, 188, 15),
]);

/** PICO-8 official 16-color palette. */
export const PICO8_PALETTE: RetroPalette = new Uint32Array([
  rgb(0, 0, 0), rgb(29, 43, 83), rgb(126, 37, 83), rgb(0, 135, 81),
  rgb(171, 82, 54), rgb(95, 87, 79), rgb(194, 195, 199), rgb(255, 241, 232),
  rgb(255, 0, 77), rgb(255, 163, 0), rgb(255, 236, 39), rgb(0, 228, 54),
  rgb(41, 173, 255), rgb(131, 118, 156), rgb(255, 119, 168), rgb(255, 204, 170),
]);

/** KUBO gold-accented 16-color palette aligned to brand. */
export const KUBO_PALETTE: RetroPalette = new Uint32Array([
  rgb(7, 9, 14), rgb(18, 22, 33), rgb(33, 40, 58), rgb(56, 66, 92),
  rgb(95, 110, 140), rgb(167, 179, 200), rgb(232, 236, 244), rgb(255, 255, 255),
  rgb(201, 148, 26), rgb(255, 196, 71), rgb(255, 232, 150), rgb(120, 80, 0),
  rgb(125, 70, 200), rgb(60, 130, 246), rgb(34, 197, 94), rgb(239, 68, 68),
]);

export const PALETTES = {
  nes: NES_PALETTE,
  gameboy: GAMEBOY_PALETTE,
  pico8: PICO8_PALETTE,
  kubo: KUBO_PALETTE,
} as const;

export type PaletteName = keyof typeof PALETTES;
