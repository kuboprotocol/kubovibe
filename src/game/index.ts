/**
 * Kubo Vibe Game Engine - Main Export
 * Multi-engine support: Three.js, Babylon.js, Pixi.js
 * Physics: Cannon-ES, P2, Oimo
 * Architecture: Entity Component System (ECS)
 *
 * Note: ./ecs and ./types both expose a `Transform` symbol with different
 * shapes. We re-export ./types explicitly to avoid an ambiguity error and
 * keep ./ecs as the canonical runtime ECS module.
 */

export * from './engines';
export * from './physics';
export * from './rendering';
export * from './ecs';
export {
  GameEngineType,
  PhysicsEngineType,
  type GameConfig,
  type RigidBody,
  type Collider,
  type GameEntity,
  type RenderTarget,
} from './types';
