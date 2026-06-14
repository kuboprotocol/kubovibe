/**
 * Entity Component System - Component
 * Base class for all components
 */

import { Entity } from './entity';

export abstract class Component {
  protected entity: Entity | null = null;
  enabled = true;

  setEntity(entity: Entity): void {
    this.entity = entity;
  }

  getEntity(): Entity | null {
    return this.entity;
  }

  abstract onAttach(): void;
  abstract onUpdate(deltaTime: number): void;
  abstract onDetach(): void;
}
