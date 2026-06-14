/**
 * Entity Component System - World
 * Main ECS world that manages entities and systems
 */

import { Entity } from './entity';
import { System } from './system';

export class World {
  private entities: Map<string, Entity> = new Map();
  private systems: System[] = [];
  private lastTime = performance.now();

  addEntity(entity: Entity): void {
    this.entities.set(entity.id, entity);
    // Register with systems
    this.systems.forEach((system) => system.addEntity(entity));
  }

  removeEntity(id: string): void {
    const entity = this.entities.get(id);
    if (entity) {
      // Unregister from systems
      this.systems.forEach((system) => system.removeEntity(entity));
      entity.destroy();
      this.entities.delete(id);
    }
  }

  getEntity(id: string): Entity | null {
    return this.entities.get(id) || null;
  }

  getAllEntities(): Entity[] {
    return Array.from(this.entities.values());
  }

  addSystem(system: System): void {
    this.systems.push(system);
  }

  removeSystem(system: System): void {
    this.systems = this.systems.filter((s) => s !== system);
  }

  update(): void {
    const now = performance.now();
    const deltaTime = (now - this.lastTime) / 1000;
    this.lastTime = now;

    this.systems.forEach((system) => system.update(deltaTime));
  }

  destroy(): void {
    this.entities.forEach((entity) => entity.destroy());
    this.entities.clear();
    this.systems = [];
  }
}
