-- Tabela para salvar preferências do usuário no Creative (filtros, busca, ordenação)
CREATE TABLE IF NOT EXISTS public.creative_user_settings (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    filter TEXT DEFAULT 'all',
    search_query TEXT DEFAULT '',
    sort_order TEXT DEFAULT 'desc',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE(user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_user_settings TO authenticated;
GRANT ALL ON public.creative_user_settings TO service_role;

ALTER TABLE public.creative_user_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own creative settings" 
ON public.creative_user_settings FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Tabela para agendamentos de exportação de auditoria
CREATE TABLE IF NOT EXISTS public.creative_audit_schedules (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    schedule_time TIME NOT NULL, -- HH:MM:SS
    last_run TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.creative_audit_schedules TO authenticated;
GRANT ALL ON public.creative_audit_schedules TO service_role;

ALTER TABLE public.creative_audit_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own audit schedules" 
ON public.creative_audit_schedules FOR ALL 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column() 
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_creative_user_settings_updated_at 
BEFORE UPDATE ON public.creative_user_settings 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_creative_audit_schedules_updated_at 
BEFORE UPDATE ON public.creative_audit_schedules 
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();