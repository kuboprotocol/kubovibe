/**
 * Turn-based battle engine. Deterministic given a seeded RNG.
 *
 * Flow:
 *   1. createBattle(player, enemy)
 *   2. submitAction({ kind: 'attack' | 'skill' | 'item' | 'flee' })
 *   3. resolveTurn() returns an ordered log of events; status updated in-place.
 *   4. Check battle.outcome.
 */

import type { Combatant, Skill, Item } from './types';

export type BattleAction =
  | { kind: 'attack' }
  | { kind: 'skill'; skill: Skill }
  | { kind: 'item'; item: Item }
  | { kind: 'flee' };

export type BattleEvent =
  | { type: 'damage'; target: 'player' | 'enemy'; amount: number; crit: boolean }
  | { type: 'heal'; target: 'player' | 'enemy'; amount: number }
  | { type: 'mp'; target: 'player' | 'enemy'; amount: number }
  | { type: 'miss'; actor: 'player' | 'enemy' }
  | { type: 'message'; text: string }
  | { type: 'flee'; success: boolean }
  | { type: 'victory'; xp: number; gold: number }
  | { type: 'defeat' };

export type BattleOutcome = 'ongoing' | 'victory' | 'defeat' | 'fled';

export interface Battle {
  player: Combatant;
  enemy: Combatant;
  turn: number;
  outcome: BattleOutcome;
  log: BattleEvent[];
  rng: () => number;
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = t;
    r = Math.imul(r ^ (r >>> 15), r | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function createBattle(player: Combatant, enemy: Combatant, seed = Date.now()): Battle {
  return { player, enemy, turn: 0, outcome: 'ongoing', log: [], rng: mulberry32(seed) };
}

function damage(actor: Combatant, target: Combatant, power: number, rng: () => number) {
  const variance = 0.85 + rng() * 0.3;
  const crit = rng() < 0.08;
  const raw = (actor.stats.atk * power - target.stats.def * 0.5) * variance * (crit ? 1.75 : 1);
  return { amount: Math.max(1, Math.round(raw)), crit };
}

export function resolveTurn(battle: Battle, playerAction: BattleAction): BattleEvent[] {
  if (battle.outcome !== 'ongoing') return [];
  const events: BattleEvent[] = [];
  battle.turn++;

  const enemyAction: BattleAction = pickEnemyAction(battle);

  const order: Array<{ who: 'player' | 'enemy'; act: BattleAction }> =
    battle.player.stats.spd >= battle.enemy.stats.spd
      ? [{ who: 'player', act: playerAction }, { who: 'enemy', act: enemyAction }]
      : [{ who: 'enemy', act: enemyAction }, { who: 'player', act: playerAction }];

  for (const step of order) {
    if (battle.outcome !== 'ongoing') break;
    runAction(battle, step.who, step.act, events);
    checkOutcome(battle, events);
  }

  battle.log.push(...events);
  return events;
}

function pickEnemyAction(b: Battle): BattleAction {
  const useSkill = b.enemy.skills.length > 0 && b.rng() < 0.3 && b.enemy.stats.mp >= b.enemy.skills[0].cost;
  if (useSkill) return { kind: 'skill', skill: b.enemy.skills[0] };
  return { kind: 'attack' };
}

function runAction(battle: Battle, who: 'player' | 'enemy', act: BattleAction, events: BattleEvent[]) {
  const actor = who === 'player' ? battle.player : battle.enemy;
  const target = who === 'player' ? battle.enemy : battle.player;
  const targetSide = who === 'player' ? 'enemy' : 'player';

  switch (act.kind) {
    case 'attack': {
      if (battle.rng() < 0.05) { events.push({ type: 'miss', actor: who }); return; }
      const d = damage(actor, target, 1, battle.rng);
      target.stats.hp = Math.max(0, target.stats.hp - d.amount);
      events.push({ type: 'damage', target: targetSide, amount: d.amount, crit: d.crit });
      return;
    }
    case 'skill': {
      if (actor.stats.mp < act.skill.cost) {
        events.push({ type: 'message', text: `${actor.name} lacks MP` });
        return;
      }
      actor.stats.mp -= act.skill.cost;
      if (act.skill.kind === 'heal') {
        const amt = Math.round(act.skill.power * 8 + actor.stats.atk * 0.5);
        actor.stats.hp = Math.min(actor.stats.maxHp, actor.stats.hp + amt);
        events.push({ type: 'heal', target: who, amount: amt });
      } else {
        const d = damage(actor, target, act.skill.power, battle.rng);
        target.stats.hp = Math.max(0, target.stats.hp - d.amount);
        events.push({ type: 'message', text: `${actor.name} casts ${act.skill.name}` });
        events.push({ type: 'damage', target: targetSide, amount: d.amount, crit: d.crit });
      }
      return;
    }
    case 'item': {
      if (act.item.effect.kind === 'heal') {
        actor.stats.hp = Math.min(actor.stats.maxHp, actor.stats.hp + act.item.effect.amount);
        events.push({ type: 'heal', target: who, amount: act.item.effect.amount });
      } else if (act.item.effect.kind === 'mp') {
        actor.stats.mp = Math.min(actor.stats.maxMp, actor.stats.mp + act.item.effect.amount);
        events.push({ type: 'mp', target: who, amount: act.item.effect.amount });
      }
      return;
    }
    case 'flee': {
      const success = who === 'player' && battle.rng() < 0.6;
      events.push({ type: 'flee', success });
      if (success) battle.outcome = 'fled';
      return;
    }
  }
}

function checkOutcome(battle: Battle, events: BattleEvent[]) {
  if (battle.outcome !== 'ongoing') return;
  if (battle.enemy.stats.hp <= 0) {
    const xp = 10 + battle.enemy.stats.level * 8;
    const gold = 5 + Math.floor(battle.rng() * battle.enemy.stats.level * 6);
    battle.player.stats.xp += xp;
    battle.outcome = 'victory';
    events.push({ type: 'victory', xp, gold });
    levelUpCheck(battle.player, events);
  } else if (battle.player.stats.hp <= 0) {
    battle.outcome = 'defeat';
    events.push({ type: 'defeat' });
  }
}

function levelUpCheck(c: Combatant, events: BattleEvent[]) {
  const need = c.stats.level * 50;
  if (c.stats.xp >= need) {
    c.stats.xp -= need;
    c.stats.level++;
    c.stats.maxHp += 8;
    c.stats.maxMp += 3;
    c.stats.atk += 2;
    c.stats.def += 1;
    c.stats.spd += 1;
    c.stats.hp = c.stats.maxHp;
    c.stats.mp = c.stats.maxMp;
    events.push({ type: 'message', text: `${c.name} reached level ${c.stats.level}!` });
  }
}
