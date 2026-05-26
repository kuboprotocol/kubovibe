CREATE TABLE public.npc_memories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  npc_id text NOT NULL,
  world_seed integer NOT NULL DEFAULT 0,
  persona text,
  memory jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, npc_id, world_seed)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.npc_memories TO authenticated;
GRANT ALL ON public.npc_memories TO service_role;

ALTER TABLE public.npc_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own npc memories" ON public.npc_memories
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own npc memories" ON public.npc_memories
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own npc memories" ON public.npc_memories
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own npc memories" ON public.npc_memories
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_npc_memories_lookup ON public.npc_memories (user_id, world_seed);

CREATE TRIGGER trg_npc_memories_updated_at
  BEFORE UPDATE ON public.npc_memories
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();