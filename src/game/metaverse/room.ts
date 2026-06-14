/**
 * Multiplayer room over Supabase Realtime.
 *
 * Presence holds the canonical roster + last pose. Broadcasts:
 *  - 'pose' (rate-limited): high-frequency movement updates
 *  - 'chat': discrete chat messages
 *
 * Usage:
 *   const room = new MetaverseRoom('lobby', self);
 *   await room.join();
 *   room.onPeers((peers) => ...);
 *   room.onChat((msg) => ...);
 *   room.sendPose({ x, y, z, ry });
 *   room.sendChat('hi');
 *   await room.leave();
 */

import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { AvatarIdentity, AvatarPose, AvatarState, ChatMessage } from './types';

const POSE_RATE_MS = 80; // ~12Hz

export class MetaverseRoom {
  readonly roomId: string;
  readonly self: AvatarIdentity;
  private channel: RealtimeChannel | null = null;
  private peers = new Map<string, AvatarState>();
  private lastPoseSent = 0;
  private lastPose: AvatarPose = { x: 0, y: 0, z: 0, ry: 0 };

  private peerListeners = new Set<(peers: AvatarState[]) => void>();
  private chatListeners = new Set<(msg: ChatMessage) => void>();

  constructor(roomId: string, self: AvatarIdentity) {
    this.roomId = roomId;
    this.self = self;
  }

  async join(initialPose: AvatarPose = { x: 0, y: 0, z: 0, ry: 0 }): Promise<void> {
    if (this.channel) return;
    this.lastPose = initialPose;

    const channel = supabase.channel(`metaverse:${this.roomId}`, {
      config: { presence: { key: this.self.id }, broadcast: { ack: false, self: false } },
    });

    channel.on('presence', { event: 'sync' }, () => {
      const state = channel.presenceState() as Record<string, AvatarState[]>;
      const next = new Map<string, AvatarState>();
      for (const [id, metas] of Object.entries(state)) {
        if (!metas.length || id === this.self.id) continue;
        next.set(id, metas[metas.length - 1]);
      }
      this.peers = next;
      this.emitPeers();
    });

    channel.on('broadcast', { event: 'pose' }, ({ payload }) => {
      const p = payload as AvatarState;
      if (!p?.id || p.id === this.self.id) return;
      this.peers.set(p.id, p);
      this.emitPeers();
    });

    channel.on('broadcast', { event: 'chat' }, ({ payload }) => {
      const m = payload as ChatMessage;
      if (!m?.id) return;
      for (const cb of this.chatListeners) cb(m);
    });

    await new Promise<void>((resolve, reject) => {
      channel.subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ ...this.self, ...initialPose, ts: Date.now() } satisfies AvatarState);
          resolve();
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          reject(new Error(`Realtime channel error: ${status}`));
        }
      });
    });

    this.channel = channel;
  }

  async leave(): Promise<void> {
    if (!this.channel) return;
    await this.channel.untrack();
    await supabase.removeChannel(this.channel);
    this.channel = null;
    this.peers.clear();
    this.peerListeners.clear();
    this.chatListeners.clear();
  }

  sendPose(pose: AvatarPose): void {
    if (!this.channel) return;
    this.lastPose = pose;
    const now = Date.now();
    if (now - this.lastPoseSent < POSE_RATE_MS) return;
    this.lastPoseSent = now;
    const state: AvatarState = { ...this.self, ...pose, ts: now };
    this.channel.send({ type: 'broadcast', event: 'pose', payload: state });
  }

  /** Periodically refresh presence so reconnecting peers see the latest pose. */
  syncPresence(): void {
    if (!this.channel) return;
    this.channel.track({ ...this.self, ...this.lastPose, ts: Date.now() } satisfies AvatarState).catch(() => {});
  }

  sendChat(text: string): ChatMessage | null {
    if (!this.channel || !text.trim()) return null;
    const msg: ChatMessage = {
      id: crypto.randomUUID(),
      authorId: this.self.id,
      authorName: this.self.name,
      text: text.slice(0, 280),
      ts: Date.now(),
    };
    this.channel.send({ type: 'broadcast', event: 'chat', payload: msg });
    return msg;
  }

  onPeers(cb: (peers: AvatarState[]) => void): () => void {
    this.peerListeners.add(cb);
    cb(Array.from(this.peers.values()));
    return () => this.peerListeners.delete(cb);
  }

  onChat(cb: (msg: ChatMessage) => void): () => void {
    this.chatListeners.add(cb);
    return () => this.chatListeners.delete(cb);
  }

  private emitPeers(): void {
    const arr = Array.from(this.peers.values());
    for (const cb of this.peerListeners) cb(arr);
  }
}
