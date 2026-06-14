// Scene serialization for the KUBO Visual Editor.
// A scene is a flat list of entities with transform + renderable, plus optional npc tag.
import { World, T, Transform, Renderable, NPCTag, EntityId } from '@/game/ecs';

export interface SerializedEntity {
  id: number;
  name: string;
  transform: { x: number; y: number; z: number; rot: number };
  renderable: { mesh: Renderable['mesh']; color: number; scale: number };
  npc?: { npcId: string; persona: string };
}

export interface SerializedScene {
  version: 1;
  name: string;
  createdAt: string;
  entities: SerializedEntity[];
}

export function serializeScene(world: World, name = 'Untitled Scene'): SerializedScene {
  const entities: SerializedEntity[] = [];
  for (const id of world.query(['transform', 'renderable'])) {
    const t = world.getComponent<Transform>(id, 'transform')!;
    const r = world.getComponent<Renderable>(id, 'renderable')!;
    const npc = world.getComponent<NPCTag>(id, 'npc');
    entities.push({
      id,
      name: npc ? npc.npcId : `${r.mesh}-${id}`,
      transform: { x: t.x, y: t.y, z: t.z, rot: t.rot },
      renderable: { mesh: r.mesh, color: r.color, scale: r.scale },
      npc: npc ? { npcId: npc.npcId, persona: npc.persona } : undefined,
    });
  }
  return { version: 1, name, createdAt: new Date().toISOString(), entities };
}

export function loadScene(world: World, scene: SerializedScene): EntityId[] {
  // Clear existing entities with transform
  for (const id of world.query(['transform'])) world.destroyEntity(id);
  const ids: EntityId[] = [];
  for (const e of scene.entities) {
    const id = world.createEntity();
    world.addComponent(id, T.transform(e.transform.x, e.transform.y, e.transform.z, e.transform.rot));
    world.addComponent(id, T.renderable(e.renderable.mesh, e.renderable.color, e.renderable.scale));
    if (e.npc) world.addComponent(id, T.npc(e.npc.npcId, e.npc.persona));
    ids.push(id);
  }
  return ids;
}

export const EDITOR_STORAGE_KEY = 'kubo-editor-scene-v1';
