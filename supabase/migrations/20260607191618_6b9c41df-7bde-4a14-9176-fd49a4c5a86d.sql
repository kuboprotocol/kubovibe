-- 1. Criar a tabela de roles
CREATE TABLE public.user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role text NOT NULL CHECK (role IN ('admin', 'moderator', 'user')),
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, role)
);

-- Permissões
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Função helper para verificar roles
CREATE OR REPLACE FUNCTION public.has_role(_role text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = _role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 3. Políticas para user_roles
CREATE POLICY "Admins can manage roles" 
    ON public.user_roles FOR ALL 
    TO authenticated
    USING (public.has_role('admin'));

CREATE POLICY "Users can view own roles"
    ON public.user_roles FOR SELECT
    TO authenticated
    USING (auth.uid() = user_id);

-- 4. Automação para atribuir role admin ao e-mail específico
-- Primeiro, vamos atualizar a função handle_new_user existente
CREATE OR REPLACE FUNCTION public.handle_new_user() 
RETURNS trigger AS $$
BEGIN
    -- Criar perfil
    INSERT INTO public.profiles (id, display_name, avatar_url)
    VALUES (new.id, new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'avatar_url');

    -- Atribuir role admin se for o e-mail mestre
    IF new.email = 'kuboprotocol@gmail.com' THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'admin');
    ELSE
        INSERT INTO public.user_roles (user_id, role) VALUES (new.id, 'user');
    END IF;

    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. Dar role admin retroativamente se o usuário já existir
DO $$
DECLARE
    uid uuid;
BEGIN
    SELECT id INTO uid FROM auth.users WHERE email = 'kuboprotocol@gmail.com';
    IF uid IS NOT NULL THEN
        INSERT INTO public.user_roles (user_id, role) VALUES (uid, 'admin') ON CONFLICT DO NOTHING;
    END IF;
END $$;
