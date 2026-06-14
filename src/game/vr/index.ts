/**
 * KUBO VR — Public module entry.
 *
 * Ultra-realistic, WebXR-ready 3D scene builder powered by Three.js.
 * - Cinematic PBR materials (MeshPhysicalMaterial: clearcoat, transmission, IOR)
 * - ACES Filmic tonemapping + sRGB output
 * - 4 quality presets: low / high / ultra / cinematic (up to 8x MSAA, 8K shadows)
 * - WebXR controllers with laser pointers
 * - Procedural cinematic environment (no external HDRI required)
 *
 * Usage:
 *   import { vr } from '@/game/vr';
 *   const scene = new vr.VrScene({ canvas, quality: 'cinematic' });
 *   scene.mountVrButton(container);
 *   scene.addObject({ id: 'orb', kind: 'sphere', position: [0, 1.6, -2],
 *                     material: { color: 0xc9941a, metalness: 1, roughness: 0.08 } });
 *   scene.start();
 */
export { VrScene, isVrSupported } from './scene';
export { buildCinematicEnvironment } from './environment';
export {
  VR_QUALITY,
  type VrQualityName,
  type VrQualityPreset,
  type VrSceneOptions,
  type VrControllerState,
  type VrFrameStats,
  type VrObjectDescriptor,
  type VrUpdateFn,
} from './types';
