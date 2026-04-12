
-- Table to store GitHub OAuth connections
CREATE TABLE public.github_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  github_username TEXT,
  github_avatar_url TEXT,
  access_token TEXT NOT NULL,
  scope TEXT,
  connected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.github_connections ENABLE ROW LEVEL SECURITY;

-- Users can only see their own connection
CREATE POLICY "Users can view own github connection"
ON public.github_connections FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Users can insert their own connection
CREATE POLICY "Users can insert own github connection"
ON public.github_connections FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Users can update their own connection
CREATE POLICY "Users can update own github connection"
ON public.github_connections FOR UPDATE
TO authenticated
USING (auth.uid() = user_id);

-- Users can delete their own connection
CREATE POLICY "Users can delete own github connection"
ON public.github_connections FOR DELETE
TO authenticated
USING (auth.uid() = user_id);
