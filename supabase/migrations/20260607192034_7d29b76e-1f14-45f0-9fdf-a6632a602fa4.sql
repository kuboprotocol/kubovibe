-- 1. Alterar has_role para SECURITY INVOKER
-- Isso resolve o aviso do linter sobre funções SECURITY DEFINER chamáveis por usuários autenticados.
CREATE OR REPLACE FUNCTION public.has_role(_role text)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_id = auth.uid() AND role = _role
    );
END;
$$ LANGUAGE plpgsql SECURITY INVOKER SET search_path = public;

-- 2. Atualizar internal.is_skill_admin para usar o sistema RBAC
CREATE OR REPLACE FUNCTION internal.is_skill_admin()
RETURNS boolean AS $$
BEGIN
  RETURN public.has_role('admin');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
