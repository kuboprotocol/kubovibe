/**
 * Convenience React hooks built on the KUBO Game SDK.
 *
 * Optional: external apps can use the SDK directly without these hooks.
 */

import { useEffect, useRef, useState } from 'react';
import {
  createRetroGame, createMetaverseRoom,
  type CreateRetroGameOptions, type RetroGameHandle,
  type CreateMetaverseRoomOptions,
} from './index';
import type { MetaverseRoom, AvatarState, ChatMessage } from '@/game/metaverse';

/** Mount a retro game inside a React component. Auto-cleans on unmount. */
export function useRetroGame(
  ref: React.RefObject<HTMLCanvasElement>,
  options: Omit<CreateRetroGameOptions, 'canvas'>,
): React.MutableRefObject<RetroGameHandle | null> {
  const handle = useRef<RetroGameHandle | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    handle.current = createRetroGame({ canvas: ref.current, ...options });
    return () => { handle.current?.stop(); handle.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return handle;
}

/** Join a metaverse room and expose live roster + chat to React state. */
export function useMetaverseRoom(opts: CreateMetaverseRoomOptions | null) {
  const [room, setRoom] = useState<MetaverseRoom | null>(null);
  const [peers, setPeers] = useState<AvatarState[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');

  useEffect(() => {
    if (!opts) return;
    let cancelled = false;
    setStatus('connecting');

    createMetaverseRoom(opts).then((r) => {
      if (cancelled) { r.leave(); return; }
      setRoom(r);
      setStatus('live');
      r.onPeers(setPeers);
      r.onChat((m) => setMessages((prev) => [...prev.slice(-49), m]));
    }).catch(() => setStatus('error'));

    return () => {
      cancelled = true;
      setRoom(null);
      setPeers([]);
      setMessages([]);
      setStatus('idle');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts?.roomId, opts?.identity.id]);

  return { room, peers, messages, status };
}
