/**
 * Metaverse network types.
 * Presence tracks identity + last-known pose; broadcast streams real-time updates.
 */

export interface AvatarPose {
  x: number;
  y: number;
  z: number;
  ry: number; // yaw rotation in radians
}

export interface AvatarIdentity {
  id: string;
  name: string;
  color: string; // hex e.g. #C9941A
}

export interface AvatarState extends AvatarIdentity, AvatarPose {
  ts: number;
}

export interface ChatMessage {
  id: string;
  authorId: string;
  authorName: string;
  text: string;
  ts: number;
}
