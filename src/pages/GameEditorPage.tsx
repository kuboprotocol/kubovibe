import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft, Box, Circle, User, Trash2, Save, FolderOpen,
  Download, Upload, Plus, Sparkles, FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { toast } from 'sonner';
import { World, T, Transform, Renderable, NPCTag, EntityId } from '@/game/ecs';
import { GameRenderer } from '@/game/renderer';
import {
  serializeScene, loadScene, EDITOR_STORAGE_KEY, SerializedScene,
} from '@/game/editor/sceneIO';

type MeshKind = Renderable['mesh'];

interface EntityRow {
  id: EntityId;
  name: string;
  mesh: MeshKind;
}

export default function GameEditorPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [sceneName, setSceneName] = useState('Untitled Scene');
  const [entities, setEntities] = useState<EntityRow[]>([]);
  const [selectedId, setSelectedId] = useState<EntityId | null>(null);
  const [, forceRender] = useState(0);
  const refresh = useCallback(() => forceRender(x => x + 1), []);

  const rebuildList = useCallback(() => {
    const w = worldRef.current;
    if (!w) return;
    const rows: EntityRow[] = [];
    for (const id of w.query(['transform', 'renderable'])) {
      const r = w.getComponent<Renderable>(id, 'renderable')!;
      const npc = w.getComponent<NPCTag>(id, 'npc');
      rows.push({ id, name: npc?.npcId ?? `${r.mesh}-${id}`, mesh: r.mesh });
    }
    setEntities(rows);
  }, []);

  // Init world + renderer
  useEffect(() => {
    if (!containerRef.current) return;
    const world = new World();
    const renderer = new GameRenderer(containerRef.current);
    worldRef.current = world;
    rendererRef.current = renderer;

    // Try restore from localStorage
    const saved = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (saved) {
      try {
        const scene = JSON.parse(saved) as SerializedScene;
        loadScene(world, scene);
        setSceneName(scene.name);
      } catch {
        seedDefault(world);
      }
    } else {
      seedDefault(world);
    }

    renderer.start(() => renderer.syncEntities(world));
    rebuildList();

    const onClick = (e: MouseEvent) => {
      const id = renderer.pickEntity(e.clientX, e.clientY);
      setSelectedId(id);
    };
    containerRef.current.addEventListener('click', onClick);

    return () => {
      containerRef.current?.removeEventListener('click', onClick);
      renderer.dispose();
    };
  }, [rebuildList]);

  const addEntity = (mesh: MeshKind) => {
    const w = worldRef.current;
    if (!w) return;
    const id = w.createEntity();
    w.addComponent(id, T.transform((Math.random() - 0.5) * 8, 1, (Math.random() - 0.5) * 8));
    const color = mesh === 'cube' ? 0x16213e : mesh === 'sphere' ? 0x8b5cf6 : 0xc9941a;
    const scale = mesh === 'npc' ? 1.4 : 1;
    w.addComponent(id, T.renderable(mesh, color, scale));
    if (mesh === 'npc') {
      w.addComponent(id, T.npc(`npc-${id}`, 'A mysterious entity awaiting its persona.'));
    }
    rebuildList();
    setSelectedId(id);
    toast.success(`Added ${mesh}`);
  };

  const deleteSelected = () => {
    const w = worldRef.current;
    if (!w || selectedId == null) return;
    w.destroyEntity(selectedId);
    setSelectedId(null);
    rebuildList();
  };

  const clearScene = () => {
    const w = worldRef.current;
    if (!w) return;
    for (const id of w.query(['transform'])) w.destroyEntity(id);
    setSelectedId(null);
    rebuildList();
    toast.info('Scene cleared');
  };

  const resetMeshes = () => {
    // Force renderer to drop cached meshes so material/color changes apply.
    const r = rendererRef.current;
    const w = worldRef.current;
    if (!r || !w) return;
    for (const [id, mesh] of r.meshes) {
      r.scene.remove(mesh);
      mesh.geometry.dispose();
      (mesh.material as { dispose?: () => void }).dispose?.();
    }
    r.meshes.clear();
  };

  const saveLocal = () => {
    const w = worldRef.current;
    if (!w) return;
    const scene = serializeScene(w, sceneName);
    localStorage.setItem(EDITOR_STORAGE_KEY, JSON.stringify(scene));
    toast.success('Scene saved locally');
  };

  const loadLocal = () => {
    const w = worldRef.current;
    if (!w) return;
    const raw = localStorage.getItem(EDITOR_STORAGE_KEY);
    if (!raw) { toast.error('No saved scene found'); return; }
    try {
      const scene = JSON.parse(raw) as SerializedScene;
      resetMeshes();
      loadScene(w, scene);
      setSceneName(scene.name);
      setSelectedId(null);
      rebuildList();
      toast.success('Scene loaded');
    } catch {
      toast.error('Failed to parse saved scene');
    }
  };

  const exportJSON = () => {
    const w = worldRef.current;
    if (!w) return;
    const scene = serializeScene(w, sceneName);
    const blob = new Blob([JSON.stringify(scene, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${sceneName.replace(/\s+/g, '-').toLowerCase()}.kubo-scene.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importJSON = async (file: File) => {
    const w = worldRef.current;
    if (!w) return;
    try {
      const text = await file.text();
      const scene = JSON.parse(text) as SerializedScene;
      if (scene.version !== 1) throw new Error('Unsupported scene version');
      resetMeshes();
      loadScene(w, scene);
      setSceneName(scene.name);
      setSelectedId(null);
      rebuildList();
      toast.success('Scene imported');
    } catch (e) {
      toast.error((e as Error).message);
    }
  };

  const selected = useMemo(() => {
    const w = worldRef.current;
    if (!w || selectedId == null) return null;
    const t = w.getComponent<Transform>(selectedId, 'transform');
    const r = w.getComponent<Renderable>(selectedId, 'renderable');
    if (!t || !r) return null;
    const npc = w.getComponent<NPCTag>(selectedId, 'npc');
    return { id: selectedId, t, r, npc };
  }, [selectedId, entities]);

  const updateTransform = (key: 'x' | 'y' | 'z' | 'rot', value: number) => {
    if (!selected) return;
    selected.t[key] = value;
    refresh();
  };

  const updateRenderable = <K extends keyof Renderable>(key: K, value: Renderable[K]) => {
    if (!selected) return;
    // Mesh kind & color require recreating the Three.js mesh
    if (key === 'mesh' || key === 'color') {
      const r = rendererRef.current;
      const m = r?.meshes.get(selected.id);
      if (r && m) {
        r.scene.remove(m);
        m.geometry.dispose();
        (m.material as { dispose?: () => void }).dispose?.();
        r.meshes.delete(selected.id);
      }
    }
    selected.r[key] = value;
    refresh();
    rebuildList();
  };

  const updateNPC = (key: 'npcId' | 'persona', value: string) => {
    if (!selected?.npc) return;
    selected.npc[key] = value;
    refresh();
    rebuildList();
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/game">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Game</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">
                KUBO <span className="neon-text">VISUAL EDITOR</span>
              </h1>
            </div>
            <Badge variant="outline" className="neon-ring">BETA</Badge>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={sceneName}
              onChange={e => setSceneName(e.target.value)}
              className="h-8 w-48"
              placeholder="Scene name"
            />
            <Button size="sm" variant="outline" onClick={saveLocal}><Save className="w-4 h-4 mr-1" /> Save</Button>
            <Button size="sm" variant="outline" onClick={loadLocal}><FolderOpen className="w-4 h-4 mr-1" /> Load</Button>
            <Button size="sm" variant="outline" onClick={exportJSON}><Download className="w-4 h-4 mr-1" /> Export</Button>
            <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()}>
              <Upload className="w-4 h-4 mr-1" /> Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) importJSON(f);
                e.target.value = '';
              }}
            />
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 grid lg:grid-cols-[260px_1fr_320px] gap-4">
        {/* Hierarchy */}
        <Card className="glass-premium p-3 h-[calc(100vh-160px)] min-h-[480px] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs tracking-widest text-muted-foreground">HIERARCHY</h2>
            <Badge variant="secondary" className="text-[10px]">{entities.length}</Badge>
          </div>
          <div className="grid grid-cols-3 gap-1 mb-2">
            <Button size="sm" variant="outline" onClick={() => addEntity('cube')} title="Add cube">
              <Box className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => addEntity('sphere')} title="Add sphere">
              <Circle className="w-3 h-3" />
            </Button>
            <Button size="sm" variant="outline" onClick={() => addEntity('npc')} title="Add NPC">
              <User className="w-3 h-3" />
            </Button>
          </div>
          <Separator className="my-2" />
          <ScrollArea className="flex-1 -mx-1">
            <div className="px-1 space-y-1">
              {entities.map(e => {
                const Icon = e.mesh === 'cube' ? Box : e.mesh === 'sphere' ? Circle : User;
                const active = e.id === selectedId;
                return (
                  <button
                    key={e.id}
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors ${
                      active ? 'bg-primary/20 border border-primary/40' : 'hover:bg-muted/40 border border-transparent'
                    }`}
                  >
                    <Icon className="w-3 h-3 text-muted-foreground" />
                    <span className="truncate">{e.name}</span>
                    <span className="ml-auto text-[10px] text-muted-foreground">#{e.id}</span>
                  </button>
                );
              })}
              {entities.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-8">Empty scene. Add an entity above.</p>
              )}
            </div>
          </ScrollArea>
          <Separator className="my-2" />
          <Button size="sm" variant="ghost" onClick={clearScene} className="text-destructive">
            <Trash2 className="w-3 h-3 mr-1" /> Clear scene
          </Button>
        </Card>

        {/* Viewport */}
        <Card className="glass-premium overflow-hidden p-0 h-[calc(100vh-160px)] min-h-[480px] relative">
          <div ref={containerRef} className="w-full h-full" />
          <div className="absolute top-3 left-3 text-[11px] text-muted-foreground space-y-0.5 pointer-events-none">
            <div>Click an entity to select</div>
            <div>Three.js · ECS · Live edit</div>
          </div>
        </Card>

        {/* Inspector */}
        <Card className="glass-premium p-3 h-[calc(100vh-160px)] min-h-[480px] flex flex-col">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs tracking-widest text-muted-foreground">INSPECTOR</h2>
            {selected && (
              <Button size="sm" variant="ghost" onClick={deleteSelected} className="h-7 text-destructive">
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
          </div>

          {!selected ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-muted-foreground p-4">
              Select an entity from the hierarchy or viewport to edit its components.
            </div>
          ) : (
            <ScrollArea className="flex-1 -mx-1">
              <div className="px-1 space-y-4">
                <div>
                  <Badge className="neon-ring-gold text-[10px]">Entity #{selected.id}</Badge>
                </div>

                <section className="space-y-2">
                  <h3 className="text-[10px] tracking-widest text-muted-foreground">TRANSFORM</h3>
                  {(['x', 'y', 'z'] as const).map(axis => (
                    <div key={axis} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <Label className="text-[11px] uppercase">{axis}</Label>
                        <span className="text-[11px] font-mono">{selected.t[axis].toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[selected.t[axis]]}
                        min={-20} max={20} step={0.1}
                        onValueChange={([v]) => updateTransform(axis, v)}
                      />
                    </div>
                  ))}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px] uppercase">Rotation Y</Label>
                      <span className="text-[11px] font-mono">{selected.t.rot.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[selected.t.rot]}
                      min={-Math.PI} max={Math.PI} step={0.05}
                      onValueChange={([v]) => updateTransform('rot', v)}
                    />
                  </div>
                </section>

                <Separator />

                <section className="space-y-2">
                  <h3 className="text-[10px] tracking-widest text-muted-foreground">RENDERABLE</h3>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Mesh</Label>
                    <Select
                      value={selected.r.mesh}
                      onValueChange={(v: MeshKind) => updateRenderable('mesh', v)}
                    >
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cube">Cube</SelectItem>
                        <SelectItem value="sphere">Sphere</SelectItem>
                        <SelectItem value="npc">NPC (Cone)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px]">Color</Label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={`#${selected.r.color.toString(16).padStart(6, '0')}`}
                        onChange={e => updateRenderable('color', parseInt(e.target.value.slice(1), 16))}
                        className="h-8 w-12 rounded border border-border bg-transparent cursor-pointer"
                      />
                      <span className="text-[11px] font-mono text-muted-foreground">
                        #{selected.r.color.toString(16).padStart(6, '0')}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <Label className="text-[11px]">Scale</Label>
                      <span className="text-[11px] font-mono">{selected.r.scale.toFixed(2)}</span>
                    </div>
                    <Slider
                      value={[selected.r.scale]}
                      min={0.1} max={5} step={0.1}
                      onValueChange={([v]) => updateRenderable('scale', v)}
                    />
                  </div>
                </section>

                {selected.npc && (
                  <>
                    <Separator />
                    <section className="space-y-2">
                      <h3 className="text-[10px] tracking-widest text-muted-foreground flex items-center gap-1">
                        <FileText className="w-3 h-3" /> NPC
                      </h3>
                      <div className="space-y-1">
                        <Label className="text-[11px]">NPC ID</Label>
                        <Input
                          value={selected.npc.npcId}
                          onChange={e => updateNPC('npcId', e.target.value)}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[11px]">Persona</Label>
                        <textarea
                          value={selected.npc.persona}
                          onChange={e => updateNPC('persona', e.target.value)}
                          rows={4}
                          className="w-full text-xs rounded-md border border-border bg-background/40 p-2 resize-none"
                        />
                      </div>
                    </section>
                  </>
                )}
              </div>
            </ScrollArea>
          )}

          <Separator className="my-2" />
          <Button size="sm" variant="outline" onClick={() => addEntity('cube')}>
            <Plus className="w-3 h-3 mr-1" /> Add cube at origin
          </Button>
        </Card>
      </div>
    </div>
  );
}

function seedDefault(world: World) {
  // Lightweight starter scene so the editor never opens empty.
  const ground = world.createEntity();
  world.addComponent(ground, T.transform(0, 0, 0));
  world.addComponent(ground, T.renderable('cube', 0x16213e, 4));

  const orb = world.createEntity();
  world.addComponent(orb, T.transform(2, 1.5, 0));
  world.addComponent(orb, T.renderable('sphere', 0x8b5cf6, 1));

  const npc = world.createEntity();
  world.addComponent(npc, T.transform(-2, 1.2, 1));
  world.addComponent(npc, T.renderable('npc', 0xc9941a, 1.4));
  world.addComponent(npc, T.npc('npc-1', 'A friendly guide ready to be customized.'));
}
