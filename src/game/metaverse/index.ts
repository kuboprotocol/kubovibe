/**
 * KUBO Metaverse Template — shared 3D rooms over Supabase Realtime.
 *
 * Modules:
 *  - types: AvatarIdentity, AvatarPose, AvatarState, ChatMessage
 *  - room: MetaverseRoom — presence + broadcast wrapper
 *  - scene: Three.js room and avatar mesh factories
 */

export * from './types';
export * from './room';
export * from './scene';
