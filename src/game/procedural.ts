// Procedural seed-based world generation — deterministic biomes & NPC spawns.
import { World, T, EntityId } from './ecs';

// Mulberry32 deterministic PRNG
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s |= 0; s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const NPC_PERSONAS = [
  { id: 'mercador-aurum', persona: 'Mercador místico que negocia créditos KUBO por relíquias quânticas. Fala em sussurros e adora enigmas.' },
  { id: 'guardiao-neon',  persona: 'Guardião cibernético do portal neon. Estoico, direto, leal ao Protocolo KUBO.' },
  { id: 'oraculo-flow',   persona: 'Oráculo da FLOW AI. Profetiza decisões de gameplay com metáforas de fluxo e código.' },
  { id: 'arquiteta-void', persona: 'Arquiteta do Void que constrói mundos. Curiosa, criativa, sempre propõe missões de design.' },
];

export interface WorldGenResult { entities: EntityId[]; npcIds: EntityId[] }

export function generateWorld(world: World, seed = 42, size = 24): WorldGenResult {
  const rand = rng(seed);
  const entities: EntityId[] = [];
  const npcIds: EntityId[] = [];

  // Terrain cubes (biome blocks)
  for (let i = 0; i < size; i++) {
    for (let j = 0; j < size; j++) {
      if (rand() > 0.78) continue;
      const e = world.createEntity();
      const h = Math.floor(rand() * 3);
      const hue = rand() > 0.5 ? 0x1a1a2e : 0x16213e;
      world.addComponent(e, T.transform(i - size / 2, h * 0.4, j - size / 2));
      world.addComponent(e, T.renderable('cube', hue, 1));
      entities.push(e);
    }
  }

  // NPCs scattered
  for (const p of NPC_PERSONAS) {
    const e = world.createEntity();
    const px = (rand() - 0.5) * size * 0.8;
    const pz = (rand() - 0.5) * size * 0.8;
    world.addComponent(e, T.transform(px, 1.2, pz));
    world.addComponent(e, T.renderable('npc', 0xc9941a, 1.4));
    world.addComponent(e, T.velocity((rand() - 0.5) * 0.4, 0, (rand() - 0.5) * 0.4));
    world.addComponent(e, T.npc(p.id, p.persona));
    entities.push(e); npcIds.push(e);
  }

  // Player avatar
  const player = world.createEntity();
  world.addComponent(player, T.transform(0, 1, 0));
  world.addComponent(player, T.renderable('sphere', 0x8b5cf6, 1));
  world.addComponent(player, T.velocity());
  world.addComponent(player, T.player());
  entities.push(player);

  return { entities, npcIds };
}
