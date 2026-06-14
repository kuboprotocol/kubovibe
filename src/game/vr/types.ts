/**
 * KUBO VR — Type definitions for the ultra-realistic VR layer.
 */
import type * as THREE from 'three';

export interface VrQualityPreset {
  /** Internal render scale (1.0 = native HMD res). 1.5 = supersampling. */
  pixelRatio: number;
  /** Enable WebGL multisampling on XR framebuffer (2/4/8). */
  msaa: 0 | 2 | 4 | 8;
  /** Enable shadows. */
  shadows: boolean;
  /** Shadow map resolution. */
  shadowMapSize: number;
  /** Enable physically correct tonemapping (ACESFilmic). */
  acesTonemapping: boolean;
  /** Use environment IBL (HDRI-like procedural sky) for reflections. */
  envIBL: boolean;
  /** Anisotropic filtering for textures. */
  anisotropy: number;
  /** Bloom intensity (0 disables). */
  bloom: number;
  /** SSAO strength (0 disables). Currently informational. */
  ssao: number;
}

export const VR_QUALITY: Record<'low' | 'high' | 'ultra' | 'cinematic', VrQualityPreset> = {
  low:        { pixelRatio: 1.0, msaa: 0, shadows: false, shadowMapSize: 1024, acesTonemapping: true,  envIBL: false, anisotropy: 4,  bloom: 0,    ssao: 0 },
  high:       { pixelRatio: 1.2, msaa: 4, shadows: true,  shadowMapSize: 2048, acesTonemapping: true,  envIBL: true,  anisotropy: 8,  bloom: 0.4,  ssao: 0.3 },
  ultra:      { pixelRatio: 1.5, msaa: 4, shadows: true,  shadowMapSize: 4096, acesTonemapping: true,  envIBL: true,  anisotropy: 16, bloom: 0.7,  ssao: 0.6 },
  cinematic:  { pixelRatio: 2.0, msaa: 8, shadows: true,  shadowMapSize: 8192, acesTonemapping: true,  envIBL: true,  anisotropy: 16, bloom: 1.0,  ssao: 0.9 },
};

export type VrQualityName = keyof typeof VR_QUALITY;

export interface VrSceneOptions {
  canvas: HTMLCanvasElement;
  quality?: VrQualityName | VrQualityPreset;
  /** Force WebXR session even when GPU is weak. */
  preferImmersive?: boolean;
  /** Background color (linear). */
  background?: number;
}

export interface VrControllerState {
  index: 0 | 1;
  connected: boolean;
  pose: { x: number; y: number; z: number };
  trigger: boolean;
  grip: boolean;
}

export interface VrFrameStats {
  fps: number;
  drawCalls: number;
  triangles: number;
  xrActive: boolean;
}

export interface VrObjectDescriptor {
  id: string;
  kind: 'box' | 'sphere' | 'plane' | 'gltf';
  url?: string;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number];
  material?: {
    color?: number;
    metalness?: number;
    roughness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    clearcoat?: number;
    transmission?: number;
    ior?: number;
  };
}

export type VrUpdateFn = (dt: number, ctx: { scene: THREE.Scene; camera: THREE.Camera; xrActive: boolean }) => void;
