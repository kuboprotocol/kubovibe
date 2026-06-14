/**
 * Shared types for the KUBO RPG template.
 */

export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Stats {
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  atk: number;
  def: number;
  spd: number;
  level: number;
  xp: number;
}

export interface Skill {
  id: string;
  name: string;
  cost: number;
  power: number;        // base damage multiplier
  kind: 'physical' | 'magic' | 'heal';
  description: string;
}

export interface Combatant {
  id: string;
  name: string;
  stats: Stats;
  skills: Skill[];
  /** 0..15 palette indices for portrait tint */
  tint: number;
}

export interface Item {
  id: string;
  name: string;
  description: string;
  effect:
    | { kind: 'heal'; amount: number }
    | { kind: 'mp'; amount: number }
    | { kind: 'key' }
    | { kind: 'gold'; amount: number };
  stackable: boolean;
}

export interface InventorySlot {
  item: Item;
  qty: number;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  choices?: Array<{ label: string; next?: string; flag?: string }>;
}

export interface DialogueNode {
  id: string;
  lines: DialogueLine[];
  next?: string;
}

export type DialogueTree = Record<string, DialogueNode>;

export interface NPC {
  id: string;
  name: string;
  x: number; // tile coords
  y: number;
  sprite: number; // sprite index in actor sheet
  dialogue: string; // root node id
  shop?: Item[];
  encounter?: Combatant; // engages when interacting
}

export interface RpgMap {
  width: number;
  height: number;
  tiles: Int16Array;       // index into tile sheet
  collision: Uint8Array;   // 1 = blocked
  encounters?: Combatant[]; // random encounters on grass tiles
  encounterRate?: number;  // 0..1 per step on encounter tiles
}
