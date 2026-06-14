/**
 * Oimo.js Physics Engine
 * Fast 3D physics engine for games
 */

import * as OIMO from 'oimo';
import { RigidBody, Collider } from '../types';
import { IPhysicsEngine, RaycastHit, Contact } from './base';

export class OimoPhysicsEngine implements IPhysicsEngine {
  private world: OIMO.World | null = null;
  private bodies = new Map<string, OIMO.Rigid>();

  initialize(gravity: { x: number; y: number; z: number }): void {
    const config = new OIMO.WorldConfig();
    config.gravity.set(gravity.x, gravity.y, gravity.z);
    this.world = new OIMO.World(config);
  }

  destroy(): void {
    this.bodies.clear();
    this.world = null;
  }

  step(deltaTime: number): void {
    if (!this.world) return;
    this.world.step();
  }

  setGravity(gravity: { x: number; y: number; z: number }): void {
    if (!this.world) return;
    this.world.getGravity().set(gravity.x, gravity.y, gravity.z);
  }

  addRigidBody(id: string, body: RigidBody, collider: Collider): void {
    if (!this.world) return;

    let shape: OIMO.Shape;

    switch (collider.type) {
      case 'sphere':
        shape = new OIMO.SphereShape({ radius: collider.radius || 1 });
        break;
      case 'box':
        shape = new OIMO.BoxShape({
          width: collider.size?.x || 1,
          height: collider.size?.y || 1,
          depth: collider.size?.z || 1,
        });
        break;
      default:
        shape = new OIMO.SphereShape({ radius: 1 });
    }

    const rigidBody = new OIMO.Rigid({
      shape,
      mass: body.mass,
      friction: body.friction,
      restitution: body.restitution,
    });

    this.world.addRigid(rigidBody);
    this.bodies.set(id, rigidBody);
  }

  removeRigidBody(id: string): void {
    const body = this.bodies.get(id);
    if (body && this.world) {
      this.world.removeRigid(body);
    }
    this.bodies.delete(id);
  }

  getRigidBody(id: string): OIMO.Rigid | undefined {
    return this.bodies.get(id);
  }

  raycast(): RaycastHit[] {
    return [];
  }

  getContactPoints(): Contact[] {
    return [];
  }
}
