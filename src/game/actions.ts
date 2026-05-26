// Executes actions returned by the game-npc-ai edge function on the ECS world.
// Schema produced by the NPC: { type: 'move'|'trade'|'attack'|'emote', payload: {...} }
import { World, T, Transform, Velocity, Health, EntityId, NPCTag, PlayerTag } from './ecs';

export type NPCActionType = 'move' | 'trade' | 'attack' | 'emote';

export interface NPCAction {
  type: NPCActionType;
  payload?: Record<string, unknown>;
}

export interface NPCActionEvent {
  kind: 'moved' | 'traded' | 'attacked' | 'emoted' | 'rejected';
  message: string;
  data?: Record<string, unknown>;
}

const WORLD_BOUND = 12;
const ATTACK_RANGE = 3;
const ATTACK_DAMAGE = 10;

function clamp(n: number, min: number, max: number) { return Math.max(min, Math.min(max, n)); }

function findPlayer(world: World): EntityId | null {
  const players = world.query(['player', 'transform']);
  return players[0] ?? null;
}

/**
 * Apply a single NPC action against the ECS world. Mutations sync to the renderer
 * automatically on the next `renderer.syncEntities(world)` call.
 */
export function executeNPCAction(
  world: World,
  npcEntity: EntityId,
  raw: unknown,
): NPCActionEvent {
  // Validate shape — never trust AI output
  if (!raw || typeof raw !== 'object') {
    return { kind: 'rejected', message: 'Ação ignorada: payload inválido' };
  }
  const action = raw as Partial<NPCAction>;
  if (!action.type || !['move', 'trade', 'attack', 'emote'].includes(action.type)) {
    return { kind: 'rejected', message: `Tipo de ação desconhecido: ${String(action.type)}` };
  }

  const npc = world.getComponent<NPCTag>(npcEntity, 'npc');
  const npcT = world.getComponent<Transform>(npcEntity, 'transform');
  if (!npc || !npcT) return { kind: 'rejected', message: 'NPC sem componentes' };

  const payload = (action.payload ?? {}) as Record<string, unknown>;

  switch (action.type) {
    case 'move': {
      // Accept { dx, dy, dz } relative or { x, y, z } absolute. Clamp & cap distance.
      const dx = Number(payload.dx ?? 0);
      const dz = Number(payload.dz ?? 0);
      const ax = payload.x !== undefined ? Number(payload.x) : npcT.x + clamp(dx, -4, 4);
      const az = payload.z !== undefined ? Number(payload.z) : npcT.z + clamp(dz, -4, 4);
      const targetX = clamp(ax, -WORLD_BOUND, WORLD_BOUND);
      const targetZ = clamp(az, -WORLD_BOUND, WORLD_BOUND);
      // Issue impulse via velocity; MovementSystem integrates it. Reset after 0.6s.
      const vx = (targetX - npcT.x) / 0.6;
      const vz = (targetZ - npcT.z) / 0.6;
      world.addComponent(npcEntity, T.velocity(vx, 0, vz));
      npcT.rot = Math.atan2(vx, vz);
      setTimeout(() => {
        const v = world.getComponent<Velocity>(npcEntity, 'velocity');
        if (v) { v.vx = 0; v.vz = 0; }
      }, 600);
      return { kind: 'moved', message: `NPC se moveu para (${targetX.toFixed(1)}, ${targetZ.toFixed(1)})`, data: { targetX, targetZ } };
    }

    case 'trade': {
      const item = String(payload.item ?? 'relíquia');
      const credits = clamp(Number(payload.credits ?? 1), 0, 50);
      world.addComponent(npcEntity, T.emote('wave'));
      return { kind: 'traded', message: `Troca proposta: ${item} ↔ ${credits} créditos`, data: { item, credits } };
    }

    case 'attack': {
      const player = findPlayer(world);
      if (!player) return { kind: 'rejected', message: 'Sem jogador para atacar' };
      const pT = world.getComponent<Transform>(player, 'transform')!;
      const dist = Math.hypot(pT.x - npcT.x, pT.z - npcT.z);
      if (dist > ATTACK_RANGE) {
        return { kind: 'rejected', message: `Fora de alcance (${dist.toFixed(1)}m)` };
      }
      let hp = world.getComponent<Health>(player, 'health');
      if (!hp) { world.addComponent(player, T.health(100)); hp = world.getComponent<Health>(player, 'health')!; }
      hp.hp = Math.max(0, hp.hp - ATTACK_DAMAGE);
      world.addComponent(npcEntity, T.emote('attack', 0.5));
      return { kind: 'attacked', message: `Ataque! Jogador HP: ${hp.hp}/${hp.max}`, data: { hp: hp.hp, max: hp.max } };
    }

    case 'emote': {
      const kind = (payload.kind as string) ?? 'wave';
      const safe: 'wave' | 'bow' | 'cheer' | 'attack' =
        kind === 'bow' || kind === 'cheer' || kind === 'attack' ? kind : 'wave';
      world.addComponent(npcEntity, T.emote(safe));
      return { kind: 'emoted', message: `NPC emote: ${safe}`, data: { emote: safe } };
    }
  }
}

// Public helper for badges/animations
export function getActiveEmote(world: World, entity: EntityId) {
  return world.getComponent(entity, 'emote') as { kind: string; ttl: number; elapsed: number } | undefined;
}
