-- Fix 1: prevent authenticated users from reading other users' published projects (which exposes messages column)
DROP POLICY IF EXISTS "Public can view published project meta" ON public.projects;

CREATE POLICY "Anon can view published project meta"
ON public.projects
FOR SELECT
TO anon
USING (is_published = true);

-- Fix 2: realtime channel policy for skill_imports — only skill admins may subscribe
CREATE POLICY "skill_imports realtime admin only"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  (realtime.topic() LIKE 'skill_imports:%') AND public.is_skill_admin()
);
