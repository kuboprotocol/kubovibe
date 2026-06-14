/**
 * Entity Component System - System
 * Systems process entities with specific components
 */

import { Entity } from './entity';
import { Component } from './component';

export abstract class System {
  protected entities: Entity[] = [];

  addEntity(entity: Entity): void {
    if (!this.entities.includes(entity)) {
      this.entities.push(entity);
    }
  }

  removeEntity(entity: Entity): void {
    this.entities = this.entities.filter((e) => e !== entity);
  }

  update(deltaTime: number): void {
    this.entities.forEach((entity) => {
      if (entity.active) {
        this.processEntity(entity, deltaTime);
      }
    });
  }

  abstract processEntity(entity: Entity, deltaTime: number): void;
}
