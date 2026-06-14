/**
 * Game Engine Type Definitions
 */

export enum GameEngineType {
  THREE = 'three',
  BABYLON = 'babylon',
  PIXI = 'pixi',
}

export enum PhysicsEngineType {
  CANNON = 'cannon',
  P2 = 'p2',
  OIMO = 'oimo',
}

export interface GameConfig {
  engine: GameEngineType;
  physics: PhysicsEngineType;
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  antialias: boolean;
  alpha: boolean;
  premultipliedAlpha: boolean;
}

export interface Transform {
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
}

export interface RigidBody {
  mass: number;
  friction: number;
  restitution: number;
  linearVelocity?: { x: number; y: number; z: number };
  angularVelocity?: { x: number; y: number; z: number };
}

export interface Collider {
  type: 'box' | 'sphere' | 'cylinder' | 'capsule' | 'mesh';
  size?: { x: number; y: number; z: number };
  radius?: number;
  isTrigger?: boolean;
}

export interface GameEntity {
  id: string;
  name: string;
  transform: Transform;
  components: Map<string, any>;
  active: boolean;
}

export interface RenderTarget {
  width: number;
  height: number;
  texture: any;
}
