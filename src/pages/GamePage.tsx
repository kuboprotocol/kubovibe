import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { World, MovementSystem, EmoteSystem, NPCTag, Transform, Health, EntityId } from '@/game/ecs';
import { generateWorld } from '@/game/procedural';
import { GameRenderer } from '@/game/renderer';
import { executeNPCAction, type NPCActionEvent } from '@/game/actions';
import { toast } from 'sonner';
import WGSLSandbox from '@/components/WGSLSandbox';

interface DialogueEntry { role: 'user' | 'assistant'; content: string; npcId: string }

export default function GamePage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const worldRef = useRef<World | null>(null);
  const rendererRef = useRef<GameRenderer | null>(null);
  const [selectedNPC, setSelectedNPC] = useState<{ entity: EntityId; npcId: string; persona: string } | null>(null);
  const [dialogue, setDialogue] = useState<DialogueEntry[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [seed, setSeed] = useState(42);
  const [actionLog, setActionLog] = useState<NPCActionEvent[]>([]);
  const [playerHP, setPlayerHP] = useState<{ hp: number; max: number } | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const world = new World();
    world.registerSystem(MovementSystem);
    world.registerSystem(EmoteSystem);
    generateWorld(world, seed);
    const renderer = new GameRenderer(containerRef.current);
    worldRef.current = world;
    rendererRef.current = renderer;

    renderer.start((dt) => {
      world.tick(dt);
      // Wrap NPCs within bounds
      for (const id of world.query(['npc', 'transform', 'velocity'])) {
        const t = world.getComponent<Transform>(id, 'transform')!;
        if (Math.abs(t.x) > 12) t.x = -t.x * 0.9;
        if (Math.abs(t.z) > 12) t.z = -t.z * 0.9;
      }
      // Sync player HP HUD
      const players = world.query(['player', 'health']);
      if (players[0]) {
        const h = world.getComponent<Health>(players[0], 'health')!;
        setPlayerHP(prev => prev?.hp === h.hp ? prev : { hp: h.hp, max: h.max });
      }
      renderer.syncEntities(world);
    });

    const onClick = (e: MouseEvent) => {
      const id = renderer.pickEntity(e.clientX, e.clientY);
      if (id == null) return;
      const npc = world.getComponent<NPCTag>(id, 'npc');
      if (npc) {
        setSelectedNPC({ entity: id, npcId: npc.npcId, persona: npc.persona });
        setDialogue([]);
      }
    };
    containerRef.current.addEventListener('click', onClick);

    return () => {
      containerRef.current?.removeEventListener('click', onClick);
      renderer.dispose();
    };
  }, [seed]);

  const send = async () => {
    if (!selectedNPC || !input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    setLoading(true);
    const userEntry: DialogueEntry = { role: 'user', content: text, npcId: selectedNPC.npcId };
    setDialogue(d => [...d, userEntry]);

    const npc = worldRef.current?.getComponent<NPCTag>(selectedNPC.entity, 'npc');
    try {
      const { data, error } = await supabase.functions.invoke('game-npc-ai', {
        body: {
          npcId: selectedNPC.npcId,
          npcPersona: selectedNPC.persona,
          playerInput: text,
          memory: npc?.memory ?? [],
          worldState: { seed, time: Math.floor(worldRef.current?.time ?? 0) },
        },
      });
      if (error) throw error;
      if (data?.error === 'rate_limited') { toast.error('Limite de IA atingido. Aguarde.'); return; }
      if (data?.error === 'credits_required') { toast.error('Créditos KUBO necessários.'); return; }

      const reply = data?.dialogue ?? '...';
      const asst: DialogueEntry = { role: 'assistant', content: reply, npcId: selectedNPC.npcId };
      setDialogue(d => [...d, asst]);
      if (npc) {
        npc.memory.push({ role: 'user', content: text }, { role: 'assistant', content: reply });
        if (npc.memory.length > 12) npc.memory.splice(0, npc.memory.length - 12);
      }

      // Execute the NPC action against the ECS (move/trade/attack/emote)
      if (data?.action && worldRef.current) {
        const evt = executeNPCAction(worldRef.current, selectedNPC.entity, data.action);
        setActionLog(log => [evt, ...log].slice(0, 6));
        if (evt.kind === 'rejected') toast.warning(evt.message);
        else toast.success(evt.message);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40 backdrop-blur-md bg-background/60 sticky top-0 z-20">
        <div className="container mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="sm"><ArrowLeft className="w-4 h-4 mr-1" /> Dashboard</Button>
            </Link>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h1 className="text-xl font-bold font-display tracking-wider">
                KUBO <span className="neon-text">QUANTUM ENGINE</span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge className="neon-ring">SEED {seed}</Badge>
            <Button size="sm" variant="outline" onClick={() => setSeed(Math.floor(Math.random() * 10000))}>
              Novo mundo
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-4 grid lg:grid-cols-[1fr_360px] gap-4">
        <Card className="glass-premium overflow-hidden p-0 h-[calc(100vh-160px)] min-h-[480px] relative">
          <div ref={containerRef} className="w-full h-full" />
          <div className="absolute top-3 left-3 flex flex-col gap-1 text-xs text-muted-foreground">
            <span>Clique em um NPC dourado para conversar</span>
            <span>Procedural · ECS · Three.js · AI NPCs</span>
          </div>
        </Card>

        <Card className="glass-premium p-4 flex flex-col h-[calc(100vh-160px)] min-h-[480px]">
          {selectedNPC ? (
            <>
              <div className="border-b border-border/40 pb-3 mb-3">
                <Badge className="neon-ring-gold mb-2">{selectedNPC.npcId}</Badge>
                <p className="text-xs text-muted-foreground">{selectedNPC.persona}</p>
              </div>
              <div className="flex-1 overflow-y-auto space-y-3 mb-3">
                {dialogue.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center mt-8">Inicie a conversa…</p>
                )}
                {dialogue.map((d, i) => (
                  <div key={i} className={`text-sm p-3 rounded-lg ${
                    d.role === 'user'
                      ? 'bg-primary/10 border border-primary/30 ml-6'
                      : 'glass-premium mr-6'
                  }`}>
                    {d.content}
                  </div>
                ))}
                {loading && <div className="text-xs text-muted-foreground animate-pulse">NPC pensando…</div>}
              </div>
              <div className="flex gap-2">
                <Input
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && send()}
                  placeholder="Diga algo ao NPC…"
                  disabled={loading}
                />
                <Button onClick={send} disabled={loading || !input.trim()} size="icon">
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-center text-muted-foreground text-sm">
              Selecione um NPC dourado no mundo para iniciar uma conversa com IA.
            </div>
          )}
        </Card>
      </div>

      <div className="container mx-auto px-4 pb-6">
        <WGSLSandbox />
      </div>
    </div>
  );
}
