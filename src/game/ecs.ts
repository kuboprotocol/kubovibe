// Tiny Entity-Component-System core for the Kubo Quantum Game Engine.
// Designed to be deterministic, allocation-light, and ready for procedural worlds.

export type EntityId = number;

export interface Component {
  readonly __type: string;
}

export class World {
  private nextId: EntityId = 1;
  private entities = new Set<EntityId>();
  private components = new Map<string, Map<EntityId, Component>>();
  private systems: System[] = [];
  public time = 0;

  createEntity(): EntityId {
    const id = this.nextId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    this.entities.delete(id);
    for (const store of this.components.values()) store.delete(id);
  }

  addComponent<T extends Component>(id: EntityId, c: T): void {
    if (!this.components.has(c.__type)) this.components.set(c.__type, new Map());
    this.components.get(c.__type)!.set(id, c);
  }

  getComponent<T extends Component>(id: EntityId, type: string): T | undefined {
    return this.components.get(type)?.get(id) as T | undefined;
  }

  removeComponent(id: EntityId, type: string): void {
    this.components.get(type)?.delete(id);
  }

  query(types: string[]): EntityId[] {
    if (types.length === 0) return [...this.entities];
    const first = this.components.get(types[0]);
    if (!first) return [];
    const out: EntityId[] = [];
    for (const id of first.keys()) {
      if (types.every(t => this.components.get(t)?.has(id))) out.push(id);
    }
    return out;
  }

  registerSystem(sys: System): void { this.systems.push(sys); }

  tick(dt: number): void {
    this.time += dt;
    for (const sys of this.systems) sys.update(this, dt);
  }
}

export interface System { update(world: World, dt: number): void }

// ---------- Components ----------
export interface Transform extends Component { __type: 'transform'; x: number; y: number; z: number; rot: number }
export interface Velocity extends Component { __type: 'velocity'; vx: number; vy: number; vz: number }
export interface Renderable extends Component { __type: 'renderable'; mesh: 'cube' | 'sphere' | 'npc'; color: number; scale: number }
export interface NPCTag extends Component { __type: 'npc'; npcId: string; persona: string; memory: Array<{ role: 'user'|'assistant'; content: string }> }
export interface PlayerTag extends Component { __type: 'player' }
export interface Emote extends Component { __type: 'emote'; kind: 'wave' | 'bow' | 'cheer' | 'attack'; ttl: number; elapsed: number }
export interface Health extends Component { __type: 'health'; hp: number; max: number }

export const T = {
  transform: (x = 0, y = 0, z = 0, rot = 0): Transform => ({ __type: 'transform', x, y, z, rot }),
  velocity: (vx = 0, vy = 0, vz = 0): Velocity => ({ __type: 'velocity', vx, vy, vz }),
  renderable: (mesh: Renderable['mesh'], color = 0xc9941a, scale = 1): Renderable => ({ __type: 'renderable', mesh, color, scale }),
  npc: (npcId: string, persona: string): NPCTag => ({ __type: 'npc', npcId, persona, memory: [] }),
  player: (): PlayerTag => ({ __type: 'player' }),
  emote: (kind: Emote['kind'], ttl = 1.2): Emote => ({ __type: 'emote', kind, ttl, elapsed: 0 }),
  health: (max = 100): Health => ({ __type: 'health', hp: max, max }),
};

// ---------- Systems ----------
export const MovementSystem: System = {
  update(world, dt) {
    for (const id of world.query(['transform', 'velocity'])) {
      const t = world.getComponent<Transform>(id, 'transform')!;
      const v = world.getComponent<Velocity>(id, 'velocity')!;
      t.x += v.vx * dt; t.y += v.vy * dt; t.z += v.vz * dt;
    }
  },
};

// Ticks down emote TTL and removes expired ones so the renderer can stop the animation.
export const EmoteSystem: System = {
  update(world, dt) {
    for (const id of world.query(['emote'])) {
      const e = world.getComponent<Emote>(id, 'emote')!;
      e.elapsed += dt;
      if (e.elapsed >= e.ttl) world['components'].get('emote')?.delete(id);
    }
  },
};

