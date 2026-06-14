import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, Sparkles, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { VrScene, isVrSupported, VR_QUALITY, type VrQualityName } from '@/game/vr';

export default function GameVrPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const vrButtonHostRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<VrScene | null>(null);
  const [quality, setQuality] = useState<VrQualityName>('ultra');
  const [supported, setSupported] = useState<boolean | null>(null);
  const [stats, setStats] = useState({ fps: 0, drawCalls: 0, triangles: 0, xrActive: false });

  useEffect(() => {
    isVrSupported().then(setSupported);
  }, []);

  useEffect(() => {
    if (!canvasRef.current || !vrButtonHostRef.current) return;
    const scene = new VrScene({ canvas: canvasRef.current, quality });
    sceneRef.current = scene;

    // Hero centerpiece — chrome gold orb
    scene.addObject({
      id: 'orb',
      kind: 'sphere',
      position: [0, 1.6, -2.4],
      material: { color: 0xc9941a, metalness: 1, roughness: 0.06, clearcoat: 1 },
    });

    // Glass cube
    scene.addObject({
      id: 'glass',
      kind: 'box',
      position: [-1.6, 1.2, -2.2],
      scale: [0.7, 0.7, 0.7],
      material: { color: 0xffffff, metalness: 0, roughness: 0.02, transmission: 1, ior: 1.52, clearcoat: 1 },
    });

    // Emissive neon block
    scene.addObject({
      id: 'neon',
      kind: 'box',
      position: [1.6, 1.2, -2.2],
      scale: [0.6, 0.6, 0.6],
      material: { color: 0x111122, emissive: 0x6a8cff, emissiveIntensity: 2.4, metalness: 0.4, roughness: 0.3 },
    });

    // Subtle floating animation
    const orb = scene.scene.getObjectByName('orb');
    const glass = scene.scene.getObjectByName('glass');
    const neon = scene.scene.getObjectByName('neon');
    let t = 0;
    const off = scene.onUpdate((dt) => {
      t += dt;
      if (orb) { orb.position.y = 1.6 + Math.sin(t * 1.2) * 0.08; orb.rotation.y += dt * 0.4; }
      if (glass) glass.rotation.y += dt * 0.6;
      if (neon) neon.rotation.x += dt * 0.5;
    });

    scene.mountVrButton(vrButtonHostRef.current);
    scene.start();

    const interval = window.setInterval(() => setStats(scene.getStats()), 500);

    return () => {
      off();
      clearInterval(interval);
      scene.dispose();
      vrButtonHostRef.current?.querySelectorAll('button').forEach((b) => b.remove());
    };
  }, [quality]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-border bg-card/60 backdrop-blur">
        <div className="flex items-center gap-3">
          <Link to="/game">
            <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game Hub</Button>
          </Link>
          <h1 className="text-lg sm:text-xl font-bold tracking-tight">KUBO VR · Ultra Realistic</h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1 text-xs text-muted-foreground mr-2">
            <Gauge className="w-3 h-3" /> {stats.fps} fps · {stats.drawCalls} dc · {stats.triangles.toLocaleString()} tris
            {stats.xrActive && <span className="ml-2 text-primary font-semibold">XR LIVE</span>}
          </div>
          {(Object.keys(VR_QUALITY) as VrQualityName[]).map((q) => (
            <Button
              key={q}
              size="sm"
              variant={quality === q ? 'default' : 'outline'}
              onClick={() => setQuality(q)}
              className="capitalize"
            >
              {q}
            </Button>
          ))}
        </div>
      </header>

      <section className="relative">
        <canvas ref={canvasRef} className="block w-full h-[calc(100vh-57px)]" />
        <div ref={vrButtonHostRef} className="pointer-events-none absolute inset-0">
          {/* VRButton injected here gets pointer events back via its own styles */}
        </div>

        <div className="absolute top-4 left-4 max-w-xs bg-card/70 backdrop-blur border border-border rounded-lg p-3 text-xs">
          <div className="flex items-center gap-2 font-semibold mb-1">
            <Sparkles className="w-3.5 h-3.5 text-primary" /> Cinematic PBR
          </div>
          <p className="text-muted-foreground leading-relaxed">
            ACES Filmic tonemapping, MeshPhysicalMaterial with clearcoat &amp; transmission,
            up to 8K shadow maps and {VR_QUALITY[quality].msaa}× MSAA.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5" />
            <span className={supported ? 'text-primary' : 'text-muted-foreground'}>
              {supported === null ? 'Detecting WebXR…' : supported ? 'WebXR ready — tap Enter VR' : 'WebXR unavailable — flat preview'}
            </span>
          </div>
        </div>
      </section>
    </div>
  );
}
