-- Scheduled exports configuration
CREATE TABLE IF NOT EXISTS public.creative_scheduled_exports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    schedule_time TIME NOT NULL,
    last_run_at TIMESTAMP WITH TIME ZONE,
    status TEXT DEFAULT 'active',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_scheduled_exports TO authenticated;
GRANT ALL ON public.creative_scheduled_exports TO service_role;
ALTER TABLE public.creative_scheduled_exports ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own scheduled exports') THEN
        CREATE POLICY "Users can manage their own scheduled exports" 
        ON public.creative_scheduled_exports FOR ALL 
        USING (auth.uid() = user_id) 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;

-- Organization branding for emails
CREATE TABLE IF NOT EXISTS public.creative_org_branding (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    org_name TEXT,
    logo_url TEXT,
    primary_color TEXT DEFAULT '#6366f1',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_org_branding TO authenticated;
GRANT ALL ON public.creative_org_branding TO service_role;
ALTER TABLE public.creative_org_branding ENABLE ROW LEVEL SECURITY;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users can manage their own org branding') THEN
        CREATE POLICY "Users can manage their own org branding" 
        ON public.creative_org_branding FOR ALL 
        USING (auth.uid() = user_id) 
        WITH CHECK (auth.uid() = user_id);
    END IF;
END $$;
