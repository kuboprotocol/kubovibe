/**
 * Default RPG content: hero, enemies, items, NPCs, dialogue trees.
 * Swap any of these to retheme the template without touching the engine.
 */

import type { Combatant, Item, NPC, DialogueTree } from './types';

export const HERO: Combatant = {
  id: 'hero',
  name: 'Kubo',
  tint: 11,
  stats: { hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 4, spd: 5, level: 1, xp: 0 },
  skills: [
    { id: 'strike', name: 'Power Strike', cost: 3, power: 1.6, kind: 'physical', description: 'Strong melee blow' },
    { id: 'spark', name: 'Spark', cost: 4, power: 1.8, kind: 'magic', description: 'Electric spell' },
    { id: 'mend', name: 'Mend', cost: 4, power: 1.2, kind: 'heal', description: 'Restore some HP' },
  ],
};

export const ENEMY_SLIME: Combatant = {
  id: 'slime',
  name: 'Slime',
  tint: 12,
  stats: { hp: 12, maxHp: 12, mp: 0, maxMp: 0, atk: 4, def: 2, spd: 3, level: 1, xp: 0 },
  skills: [],
};

export const ENEMY_GOBLIN: Combatant = {
  id: 'goblin',
  name: 'Goblin',
  tint: 3,
  stats: { hp: 18, maxHp: 18, mp: 4, maxMp: 4, atk: 6, def: 3, spd: 4, level: 2, xp: 0 },
  skills: [{ id: 'slash', name: 'Slash', cost: 2, power: 1.4, kind: 'physical', description: 'Wild slash' }],
};

export const ENEMY_DRAGON: Combatant = {
  id: 'dragon',
  name: 'Dragon',
  tint: 8,
  stats: { hp: 60, maxHp: 60, mp: 20, maxMp: 20, atk: 12, def: 8, spd: 6, level: 5, xp: 0 },
  skills: [{ id: 'flame', name: 'Flame Breath', cost: 5, power: 2.2, kind: 'magic', description: 'Wide AoE flame' }],
};

export const POTION: Item = {
  id: 'potion', name: 'Potion', description: 'Restores 15 HP',
  effect: { kind: 'heal', amount: 15 }, stackable: true,
};
export const ETHER: Item = {
  id: 'ether', name: 'Ether', description: 'Restores 8 MP',
  effect: { kind: 'mp', amount: 8 }, stackable: true,
};
export const GOLD_COIN: Item = {
  id: 'gold', name: 'Gold', description: 'Currency',
  effect: { kind: 'gold', amount: 1 }, stackable: true,
};

export const DEFAULT_NPCS: NPC[] = [
  { id: 'elder', name: 'Elder', x: 4, y: 4, sprite: 1, dialogue: 'elder_intro' },
  { id: 'merchant', name: 'Merchant', x: 10, y: 5, sprite: 2, dialogue: 'merchant_intro', shop: [POTION, ETHER] },
  { id: 'boss', name: 'Dragon', x: 18, y: 12, sprite: 3, dialogue: 'dragon_intro', encounter: ENEMY_DRAGON },
];

export const DEFAULT_DIALOGUE: DialogueTree = {
  elder_intro: {
    id: 'elder_intro',
    lines: [
      { speaker: 'Elder', text: 'Welcome to Kubo Village, traveler.' },
      { speaker: 'Elder', text: 'A dragon roams the eastern hills.' },
      {
        speaker: 'Elder',
        text: 'Will you stand against it?',
        choices: [
          { label: 'Yes', next: 'elder_yes', flag: 'quest_dragon' },
          { label: 'Not yet', next: 'elder_no' },
        ],
      },
    ],
  },
  elder_yes: {
    id: 'elder_yes',
    lines: [{ speaker: 'Elder', text: 'Take this Potion. May fortune favor you.' }],
  },
  elder_no: {
    id: 'elder_no',
    lines: [{ speaker: 'Elder', text: 'Come back when you are ready.' }],
  },
  merchant_intro: {
    id: 'merchant_intro',
    lines: [
      { speaker: 'Merchant', text: 'Potions, ethers — best prices in the realm!' },
      { speaker: 'Merchant', text: 'Open the shop from the inventory panel.' },
    ],
  },
  dragon_intro: {
    id: 'dragon_intro',
    lines: [{ speaker: 'Dragon', text: 'You dare approach? Burn!' }],
  },
};
