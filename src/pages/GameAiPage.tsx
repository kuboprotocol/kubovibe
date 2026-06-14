import { useRef, useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Wand2, Loader2, Gamepad2, Send, Rocket, Download } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as THREE from 'three';
import { EDITOR_STORAGE_KEY, type SerializedScene, type SerializedEntity } from '@/game/editor/sceneIO';


interface Entity {
  kind: 'player' | 'npc' | 'enemy' | 'prop' | 'portal';
  name: string;
  persona?: string;
  position: { x: number; y: number; z: number };
  color?: string;
}

interface Blueprint {
  title?: string;
  genre?: string;
  dimension?: string;
  pillars?: string[];
  lore?: string;
  gameplay_loop?: string[];
  mechanics?: string[];
  art_direction?: string;
  soundtrack?: string;
  monetization?: string;
  scene?: { seed: number; ambient: string; entities: Entity[] };
  roadmap?: string[];
}

const SAMPLE = 'A cyberpunk samurai roguelite set in a holographic Tokyo skyline. Fast katana combat, parkour rooftops, neon procedural districts, AI-driven yakuza factions.';

export default function GameAiPage() {
  const [prompt, setPrompt] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [blueprint, setBlueprint] = useState<Blueprint | null>(null);
  const [designDoc, setDesignDoc] = useState('');
  const previewRef = useRef<HTMLDivElement>(null);

  // Live preview of generated scene
  useEffect(() => {
    if (!blueprint?.scene || !previewRef.current) return;
    const host = previewRef.current;
    host.innerHTML = '';
    const w = host.clientWidth;
    const h = host.clientHeight;
    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#05060a');
    scene.fog = new THREE.Fog('#05060a', 18, 60);

    const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 200);
    camera.position.set(14, 12, 16);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(w, h);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    host.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xfff0c0, 1.2);
    key.position.set(10, 14, 6);
    scene.add(key);
    const rim = new THREE.PointLight(0x7c3aed, 1.8, 40);
    rim.position.set(-8, 6, -4);
    scene.add(rim);

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(20, 64),
      new THREE.MeshStandardMaterial({ color: '#0b0c12', roughness: 0.4, metalness: 0.6 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);

    const grid = new THREE.GridHelper(40, 40, 0x222233, 0x111118);
    scene.add(grid);

    const meshes: THREE.Object3D[] = [];
    for (const e of blueprint.scene.entities) {
      const color = e.color ?? (
        e.kind === 'player' ? '#C9941A' :
        e.kind === 'enemy' ? '#ff3060' :
        e.kind === 'portal' ? '#7c3aed' :
        e.kind === 'npc' ? '#22d3ee' : '#9ca3af'
      );
      const geom = e.kind === 'portal'
        ? new THREE.TorusGeometry(1, 0.18, 16, 48)
        : e.kind === 'prop'
        ? new THREE.BoxGeometry(1, 1, 1)
        : new THREE.CapsuleGeometry(0.5, 1, 6, 12);
      const mat = new THREE.MeshPhysicalMaterial({
        color, metalness: 0.7, roughness: 0.25, emissive: color, emissiveIntensity: 0.15,
        clearcoat: 0.6,
      });
      const m = new THREE.Mesh(geom, mat);
      m.position.set(e.position.x, e.position.y + 0.5, e.position.z);
      m.userData.kind = e.kind;
      scene.add(m);
      meshes.push(m);
    }

    let raf = 0;
    const tick = () => {
      const t = performance.now() * 0.001;
      for (const m of meshes) {
        if (m.userData.kind === 'portal') m.rotation.z += 0.02;
        else m.position.y = (m.position.y < 0.6 ? 0.6 : m.position.y) + Math.sin(t * 2 + m.position.x) * 0.002;
      }
      camera.position.x = Math.cos(t * 0.15) * 18;
      camera.position.z = Math.sin(t * 0.15) * 18;
      camera.lookAt(0, 1, 0);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      const nw = host.clientWidth, nh = host.clientHeight;
      camera.aspect = nw / nh; camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(host);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      renderer.dispose();
      host.innerHTML = '';
    };
  }, [blueprint]);

  const generate = async () => {
    if (!prompt.trim() || loading) return;
    setLoading(true);
    setBlueprint(null);
    setDesignDoc('');
    try {
      const { data, error } = await supabase.functions.invoke('game-ai-architect', {
        body: { prompt: prompt.trim() },
      });
      if (error) throw error;
      if (data?.error === 'rate_limited') { toast.error('Rate limit reached. Try again in a minute.'); return; }
      if (data?.error === 'credits_required') { toast.error('Lovable AI credits required.'); return; }
      if (data?.error) { toast.error(data.error); return; }
      setBlueprint(data.blueprint ?? null);
      setDesignDoc(data.designDoc ?? '');
      toast.success(`Blueprint ready · ${data.blueprint?.title ?? 'Untitled'}`);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/game">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Wand2 className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">
                KUBO <span className="neon-text">GAME AI ARCHITECT</span>
              </h1>
              <Badge className="neon-ring-gold ml-2">Lovable AI</Badge>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-6 grid lg:grid-cols-[420px_1fr] gap-6">
        <Card className="glass-premium p-5 space-y-4 h-fit">
          <div>
            <h2 className="font-display text-lg tracking-wide mb-1">Pitch your game</h2>
            <p className="text-xs text-muted-foreground">
              Describe the vibe. The Architect will design lore, mechanics, scene & roadmap.
            </p>
          </div>
          <Textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={8}
            placeholder="A cyberpunk samurai roguelite…"
            disabled={loading}
            className="resize-none"
          />
          <Button onClick={generate} disabled={loading || !prompt.trim()} className="w-full gap-2">
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {loading ? 'Architecting…' : 'Generate AAA blueprint'}
          </Button>
          <Separator />
          <div className="space-y-2 text-xs text-muted-foreground">
            <p className="font-medium text-foreground">What you get</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Structured blueprint (JSON tool-call)</li>
              <li>Director's design doc (markdown)</li>
              <li>Live 3D scene preview from the blueprint</li>
              <li>Ready to drop into <code>/game/editor</code></li>
            </ul>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="glass-premium overflow-hidden p-0 h-[420px] relative">
            <div ref={previewRef} className="w-full h-full" />
            {!blueprint && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-muted-foreground gap-2">
                <Gamepad2 className="w-10 h-10 opacity-50" />
                <p className="text-sm">Your generated scene will render here.</p>
              </div>
            )}
            {blueprint?.title && (
              <div className="absolute top-3 left-3 glass-premium px-3 py-2 rounded-lg text-xs">
                <div className="font-display tracking-wider">{blueprint.title}</div>
                <div className="text-muted-foreground">
                  {blueprint.genre} · {blueprint.dimension}
                </div>
              </div>
            )}
          </Card>

          {blueprint && (
            <Card className="glass-premium p-5 space-y-4">
              <div className="flex flex-wrap gap-2">
                {(blueprint.pillars ?? []).map((p, i) => (
                  <Badge key={i} variant="secondary">{p}</Badge>
                ))}
              </div>

              {blueprint.lore && (
                <section>
                  <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">LORE</h3>
                  <p className="text-sm leading-relaxed">{blueprint.lore}</p>
                </section>
              )}

              <div className="grid md:grid-cols-2 gap-4">
                {blueprint.gameplay_loop && (
                  <section>
                    <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">GAMEPLAY LOOP</h3>
                    <ol className="text-sm list-decimal list-inside space-y-1">
                      {blueprint.gameplay_loop.map((s, i) => <li key={i}>{s}</li>)}
                    </ol>
                  </section>
                )}
                {blueprint.mechanics && (
                  <section>
                    <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">MECHANICS</h3>
                    <ul className="text-sm list-disc list-inside space-y-1">
                      {blueprint.mechanics.map((s, i) => <li key={i}>{s}</li>)}
                    </ul>
                  </section>
                )}
              </div>

              {blueprint.roadmap && (
                <section>
                  <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">ROADMAP</h3>
                  <ul className="text-sm list-disc list-inside space-y-1">
                    {blueprint.roadmap.map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </section>
              )}

              {designDoc && (
                <section>
                  <h3 className="font-display text-sm tracking-widest text-muted-foreground mb-1">DIRECTOR'S DOC</h3>
                  <pre className="text-xs whitespace-pre-wrap leading-relaxed max-h-80 overflow-auto glass-premium p-3 rounded-lg">
                    {designDoc}
                  </pre>
                </section>
              )}
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
