/**
 * Base Physics Engine Interface
 * All physics engines must implement this interface
 */

import { RigidBody, Collider } from '../types';

export interface IPhysicsEngine {
  // Lifecycle
  initialize(gravity: { x: number; y: number; z: number }): void;
  destroy(): void;

  // Physics simulation
  step(deltaTime: number): void;
  setGravity(gravity: { x: number; y: number; z: number }): void;

  // Bodies
  addRigidBody(id: string, body: RigidBody, collider: Collider): void;
  removeRigidBody(id: string): void;
  getRigidBody(id: string): any;

  // Queries
  raycast(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }): RaycastHit[];
  getContactPoints(): Contact[];
}

export interface RaycastHit {
  bodyId: string;
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  distance: number;
}

export interface Contact {
  bodyA: string;
  bodyB: string;
  point: { x: number; y: number; z: number };
  normal: { x: number; y: number; z: number };
  impulse: number;
}
