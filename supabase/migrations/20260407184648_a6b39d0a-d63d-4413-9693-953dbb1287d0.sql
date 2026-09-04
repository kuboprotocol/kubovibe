
-- Shortlink definitions (the links users will visit)
CREATE TABLE public.shortlinks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  title text NOT NULL DEFAULT 'Shortlink',
  destination_url text NOT NULL,
  reward_credits numeric NOT NULL DEFAULT 0.5,
  wait_seconds integer NOT NULL DEFAULT 8,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Track each user click/completion
CREATE TABLE public.shortlink_clicks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  shortlink_id uuid NOT NULL REFERENCES public.shortlinks(id) ON DELETE CASCADE,
  completed boolean NOT NULL DEFAULT false,
  reward_credited numeric NOT NULL DEFAULT 0,
  clicked_at timestamp with time zone NOT NULL DEFAULT now(),
  completed_at timestamp with time zone
);

-- RLS on shortlinks (public read)
ALTER TABLE public.shortlinks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active shortlinks" ON public.shortlinks FOR SELECT TO anon, authenticated USING (is_active = true);

-- RLS on shortlink_clicks (user-scoped)
ALTER TABLE public.shortlink_clicks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own clicks" ON public.shortlink_clicks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own clicks" ON public.shortlink_clicks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own clicks" ON public.shortlink_clicks FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Seed some sample shortlinks
INSERT INTO public.shortlinks (slug, title, destination_url, reward_credits, wait_seconds) VALUES
  ('music1', '🎵 Discover New Music', 'https://kubovibe.dev', 0.5, 8),
  ('crypto1', '₿ Crypto News', 'https://kubovibe.dev', 0.5, 8),
  ('game1', '🎮 Gaming Tips', 'https://kubovibe.dev', 0.5, 8),
  ('tech1', '💻 Tech Trends', 'https://kubovibe.dev', 0.5, 8),
  ('art1', '🎨 Digital Art', 'https://kubovibe.dev', 0.5, 8),
  ('learn1', '📚 Learn Web3', 'https://kubovibe.dev', 0.5, 8),
  ('news1', '📰 Daily News', 'https://kubovibe.dev', 0.5, 8),
  ('sports1', '⚽ Sports Updates', 'https://kubovibe.dev', 0.5, 8),
  ('food1', '🍕 Food & Recipes', 'https://kubovibe.dev', 0.5, 8),
  ('travel1', '✈️ Travel Deals', 'https://kubovibe.dev', 0.5, 8);
