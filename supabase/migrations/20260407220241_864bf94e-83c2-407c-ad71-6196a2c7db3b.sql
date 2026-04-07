
CREATE TABLE public.user_streaks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  current_streak integer NOT NULL DEFAULT 0,
  longest_streak integer NOT NULL DEFAULT 0,
  last_activity_date date,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own streak" ON public.user_streaks FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own streak" ON public.user_streaks FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own streak" ON public.user_streaks FOR UPDATE TO authenticated USING (auth.uid() = user_id);
