/**
 * P2.js Physics Engine
 * 2D rigid body dynamics for 2D games
 */

import * as p2 from 'p2';
import { RigidBody, Collider } from '../types';
import { IPhysicsEngine, RaycastHit, Contact } from './base';

export class P2PhysicsEngine implements IPhysicsEngine {
  private world: p2.World | null = null;
  private bodies = new Map<string, p2.Body>();

  initialize(gravity: { x: number; y: number; z: number }): void {
    this.world = new p2.World({
      gravity: [gravity.x, gravity.y],
    });
    this.world.defaultContactMaterial.friction = 0.3;
  }

  destroy(): void {
    this.bodies.forEach((body) => this.world?.removeBody(body));
    this.bodies.clear();
    this.world = null;
  }

  step(deltaTime: number): void {
    if (!this.world) return;
    this.world.step(1 / 60, deltaTime, 3);
  }

  setGravity(gravity: { x: number; y: number; z: number }): void {
    if (!this.world) return;
    this.world.gravity = [gravity.x, gravity.y];
  }

  addRigidBody(id: string, body: RigidBody, collider: Collider): void {
    if (!this.world) return;

    let shape: p2.Shape;

    switch (collider.type) {
      case 'sphere':
        shape = new p2.Circle({ radius: collider.radius || 1 });
        break;
      case 'box':
        shape = new p2.Box({
          width: collider.size?.x || 1,
          height: collider.size?.y || 1,
        });
        break;
      default:
        shape = new p2.Circle({ radius: 1 });
    }

    const p2Body = new p2.Body({
      mass: body.mass,
      shape,
    });

    p2Body.friction = body.friction;

    if (body.linearVelocity) {
      p2Body.velocity = [body.linearVelocity.x, body.linearVelocity.y];
    }

    this.world.addBody(p2Body);
    this.bodies.set(id, p2Body);
  }

  removeRigidBody(id: string): void {
    const body = this.bodies.get(id);
    if (body && this.world) {
      this.world.removeBody(body);
    }
    this.bodies.delete(id);
  }

  getRigidBody(id: string): p2.Body | undefined {
    return this.bodies.get(id);
  }

  raycast(): RaycastHit[] {
    return [];
  }

  getContactPoints(): Contact[] {
    if (!this.world) return [];
    return [];
  }
}
