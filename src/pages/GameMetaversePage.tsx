import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Globe, Users, Send, LogOut, Wifi } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/hooks/useAuth';
import {
  MetaverseRoom,
  createMetaverseScene,
  createAvatar,
  type AvatarIdentity,
  type AvatarState,
  type ChatMessage,
  type AvatarMesh,
} from '@/game/metaverse';

const ROOMS = [
  { id: 'lobby', name: 'Lobby' },
  { id: 'gold-plaza', name: 'Gold Plaza' },
  { id: 'dev-lounge', name: 'Dev Lounge' },
];

const COLORS = ['#C9941A', '#7850C8', '#3C82F6', '#22C55E', '#EF4444', '#F59E0B'];

function pickColor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function GameMetaversePage() {
  const { user } = useAuth();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const roomRef = useRef<MetaverseRoom | null>(null);
  const rafRef = useRef<number>();
  const peerMeshesRef = useRef<Map<string, AvatarMesh>>(new Map());
  const selfMeshRef = useRef<AvatarMesh | null>(null);
  const sceneRef = useRef<ReturnType<typeof createMetaverseScene> | null>(null);
  const keysRef = useRef<Set<string>>(new Set());
  const poseRef = useRef({ x: 0, y: 0, z: 8, ry: 0 });

  const [roomId, setRoomId] = useState<string>('lobby');
  const [connected, setConnected] = useState(false);
  const [peers, setPeers] = useState<AvatarState[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');

  const identity: AvatarIdentity = useMemo(() => {
    const id = user?.id ?? `guest-${Math.random().toString(36).slice(2, 10)}`;
    const name = user?.email?.split('@')[0]?.slice(0, 16) ?? `Guest${Math.floor(Math.random() * 9999)}`;
    return { id, name, color: pickColor(id) };
  }, [user]);

  // ---------- Scene setup ----------
  useEffect(() => {
    if (!canvasRef.current || !wrapRef.current) return;
    const w = wrapRef.current.clientWidth;
    const h = Math.max(360, wrapRef.current.clientHeight);
    const s = createMetaverseScene(canvasRef.current, w, h);
    sceneRef.current = s;

    const self = createAvatar(identity.name, identity.color, true);
    s.scene.add(self.group);
    selfMeshRef.current = self;

    const onKey = (e: KeyboardEvent, down: boolean) => {
      const k = e.key.toLowerCase();
      if (['arrowup','arrowdown','arrowleft','arrowright','w','a','s','d','q','e'].includes(k)) {
        e.preventDefault();
        if (down) keysRef.current.add(k); else keysRef.current.delete(k);
      }
    };
    const kd = (e: KeyboardEvent) => onKey(e, true);
    const ku = (e: KeyboardEvent) => onKey(e, false);
    window.addEventListener('keydown', kd);
    window.addEventListener('keyup', ku);

    const onResize = () => {
      if (!wrapRef.current) return;
      const ww = wrapRef.current.clientWidth;
      const hh = Math.max(360, wrapRef.current.clientHeight);
      s.resize(ww, hh);
    };
    window.addEventListener('resize', onResize);

    let last = performance.now();
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const keys = keysRef.current;
      const speed = 6;
      const rotSpeed = 2.2;
      const p = poseRef.current;
      if (keys.has('arrowleft') || keys.has('q')) p.ry += rotSpeed * dt;
      if (keys.has('arrowright') || keys.has('e')) p.ry -= rotSpeed * dt;
      const forward = (keys.has('w') || keys.has('arrowup') ? 1 : 0) - (keys.has('s') || keys.has('arrowdown') ? 1 : 0);
      const strafe = (keys.has('d') ? 1 : 0) - (keys.has('a') ? 1 : 0);
      if (forward || strafe) {
        p.x -= Math.sin(p.ry) * forward * speed * dt;
        p.z -= Math.cos(p.ry) * forward * speed * dt;
        p.x += Math.cos(p.ry) * strafe * speed * dt;
        p.z -= Math.sin(p.ry) * strafe * speed * dt;
        p.x = Math.max(-38, Math.min(38, p.x));
        p.z = Math.max(-38, Math.min(38, p.z));
        roomRef.current?.sendPose({ x: p.x, y: 0, z: p.z, ry: p.ry });
      }
      selfMeshRef.current?.setPose(p.x, 0, p.z, p.ry);

      // Camera follows behind self
      const camDist = 7, camHeight = 4;
      s.camera.position.set(
        p.x + Math.sin(p.ry) * camDist,
        camHeight,
        p.z + Math.cos(p.ry) * camDist,
      );
      s.camera.lookAt(p.x, 1.5, p.z);

      s.renderer.render(s.scene, s.camera);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      window.removeEventListener('keydown', kd);
      window.removeEventListener('keyup', ku);
      window.removeEventListener('resize', onResize);
      self.dispose();
      for (const m of peerMeshesRef.current.values()) m.dispose();
      peerMeshesRef.current.clear();
      s.dispose();
      sceneRef.current = null;
    };
  }, [identity]);

  // ---------- Realtime join/leave ----------
  useEffect(() => {
    let active = true;
    let presenceTimer: ReturnType<typeof setInterval> | null = null;
    const room = new MetaverseRoom(roomId, identity);
    roomRef.current = room;

    room.onPeers((list) => { if (active) setPeers(list); syncPeerMeshes(list); });
    room.onChat((msg) => { if (active) setMessages((prev) => [...prev.slice(-49), msg]); });

    room.join({ x: poseRef.current.x, y: 0, z: poseRef.current.z, ry: poseRef.current.ry })
      .then(() => { if (active) setConnected(true); })
      .catch((err) => console.error('[metaverse] join failed', err));

    presenceTimer = setInterval(() => room.syncPresence(), 5000);

    return () => {
      active = false;
      if (presenceTimer) clearInterval(presenceTimer);
      setConnected(false);
      room.leave().catch(() => {});
      roomRef.current = null;
      for (const m of peerMeshesRef.current.values()) {
        sceneRef.current?.scene.remove(m.group);
        m.dispose();
      }
      peerMeshesRef.current.clear();
    };
  }, [roomId, identity]);

  function syncPeerMeshes(list: AvatarState[]) {
    const s = sceneRef.current; if (!s) return;
    const meshes = peerMeshesRef.current;
    const ids = new Set(list.map((p) => p.id));

    for (const [id, mesh] of meshes) {
      if (!ids.has(id)) {
        s.scene.remove(mesh.group);
        mesh.dispose();
        meshes.delete(id);
      }
    }
    for (const peer of list) {
      let mesh = meshes.get(peer.id);
      if (!mesh) {
        mesh = createAvatar(peer.name, peer.color, false);
        s.scene.add(mesh.group);
        meshes.set(peer.id, mesh);
      }
      mesh.setPose(peer.x, peer.y, peer.z, peer.ry);
    }
  }

  const send = () => {
    const msg = roomRef.current?.sendChat(draft);
    if (msg) setMessages((prev) => [...prev.slice(-49), msg]);
    setDraft('');
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/game"><Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button></Link>
            <div className="flex items-center gap-2">
              <Globe className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">KUBO <span className="neon-text">METAVERSE</span></h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant={connected ? 'default' : 'outline'} className="gap-1">
              <Wifi className="w-3 h-3" /> {connected ? 'LIVE' : 'CONNECTING'}
            </Badge>
            <Badge variant="outline" className="gap-1"><Users className="w-3 h-3" /> {peers.length + 1}</Badge>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger className="w-36 h-8"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROOMS.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 grid lg:grid-cols-[1fr_320px] gap-4">
        <Card className="glass-premium p-2 overflow-hidden">
          <div ref={wrapRef} className="w-full h-[calc(100vh-180px)] min-h-[400px] relative">
            <canvas ref={canvasRef} className="w-full h-full block rounded" />
            <div className="absolute bottom-3 left-3 text-xs text-muted-foreground font-mono bg-background/60 px-2 py-1 rounded">
              WASD / Arrows · Q/E rotate
            </div>
            <div className="absolute top-3 left-3 flex items-center gap-2 bg-background/60 px-2 py-1 rounded">
              <span className="w-3 h-3 rounded-full" style={{ background: identity.color }} />
              <span className="text-xs font-mono">{identity.name}</span>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card className="glass-premium p-4">
            <div className="text-xs tracking-widest text-muted-foreground mb-2 flex items-center gap-1">
              <Users className="w-3 h-3" /> ROSTER
            </div>
            <ul className="space-y-1 text-sm font-mono max-h-40 overflow-auto">
              <li className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ background: identity.color }} />
                {identity.name} <span className="text-xs text-muted-foreground">(you)</span>
              </li>
              {peers.map((p) => (
                <li key={p.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                  {p.name}
                </li>
              ))}
            </ul>
          </Card>

          <Card className="glass-premium p-4 flex flex-col h-[360px]">
            <div className="text-xs tracking-widest text-muted-foreground mb-2">CHAT</div>
            <div className="flex-1 overflow-auto space-y-1 text-sm pr-1">
              {messages.length === 0 && <p className="text-xs text-muted-foreground">No messages yet — say hi.</p>}
              {messages.map((m) => (
                <div key={m.id} className="leading-tight">
                  <span className="text-xs font-mono opacity-70">{m.authorName}:</span> <span>{m.text}</span>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-2">
              <Input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); send(); } }}
                placeholder="Type a message…"
                maxLength={280}
                disabled={!connected}
              />
              <Button size="sm" onClick={send} disabled={!connected || !draft.trim()}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </Card>

          <Button variant="outline" className="w-full" onClick={() => setRoomId((r) => r === 'lobby' ? 'gold-plaza' : 'lobby')}>
            <LogOut className="w-4 h-4 mr-2" /> Teleport
          </Button>
        </div>
      </div>
    </div>
  );
}
