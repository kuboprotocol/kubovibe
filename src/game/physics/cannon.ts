/**
 * Cannon-ES Physics Engine
 * Rigid body dynamics with constraints and collisions
 */

import * as CANNON from 'cannon-es';
import { RigidBody, Collider } from '../types';
import { IPhysicsEngine, RaycastHit, Contact } from './base';

export class CannonPhysicsEngine implements IPhysicsEngine {
  private world: CANNON.World | null = null;
  private bodies = new Map<string, CANNON.Body>();

  initialize(gravity: { x: number; y: number; z: number }): void {
    this.world = new CANNON.World();
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);
    this.world.defaultContactMaterial.friction = 0.3;
    this.world.defaultContactMaterial.restitution = 0.3;
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
    this.world.gravity.set(gravity.x, gravity.y, gravity.z);
  }

  addRigidBody(id: string, body: RigidBody, collider: Collider): void {
    if (!this.world) return;

    let shape: CANNON.Shape;

    switch (collider.type) {
      case 'sphere':
        shape = new CANNON.Sphere(collider.radius || 1);
        break;
      case 'box':
        shape = new CANNON.Box(
          new CANNON.Vec3(
            (collider.size?.x || 1) / 2,
            (collider.size?.y || 1) / 2,
            (collider.size?.z || 1) / 2
          )
        );
        break;
      case 'cylinder':
        shape = new CANNON.Cylinder(
          collider.radius || 1,
          collider.radius || 1,
          collider.size?.y || 2,
          16
        );
        break;
      default:
        shape = new CANNON.Sphere(1);
    }

    const cannonBody = new CANNON.Body({
      mass: body.mass,
      shape,
      friction: body.friction,
      restitution: body.restitution,
    });

    if (body.linearVelocity) {
      cannonBody.velocity.set(
        body.linearVelocity.x,
        body.linearVelocity.y,
        body.linearVelocity.z
      );
    }

    this.world.addBody(cannonBody);
    this.bodies.set(id, cannonBody);
  }

  removeRigidBody(id: string): void {
    const body = this.bodies.get(id);
    if (body && this.world) {
      this.world.removeBody(body);
    }
    this.bodies.delete(id);
  }

  getRigidBody(id: string): CANNON.Body | undefined {
    return this.bodies.get(id);
  }

  raycast(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): RaycastHit[] {
    if (!this.world) return [];

    const hits: RaycastHit[] = [];
    const result = new CANNON.RaycastResult();

    this.world.raycastClosest(
      new CANNON.Vec3(from.x, from.y, from.z),
      new CANNON.Vec3(to.x, to.y, to.z),
      { skipBackfaces: true },
      result
    );

    if (result.hasHit) {
      // Find the body id
      for (const [id, body] of this.bodies.entries()) {
        if (body === result.body) {
          hits.push({
            bodyId: id,
            point: {
              x: result.hitPointWorld.x,
              y: result.hitPointWorld.y,
              z: result.hitPointWorld.z,
            },
            normal: {
              x: result.hitNormalWorld.x,
              y: result.hitNormalWorld.y,
              z: result.hitNormalWorld.z,
            },
            distance: result.distance,
          });
          break;
        }
      }
    }

    return hits;
  }

  getContactPoints(): Contact[] {
    if (!this.world) return [];

    const contacts: Contact[] = [];

    // Note: Cannon-ES doesn't expose contacts directly
    // This is a simplified version

    return contacts;
  }
}
