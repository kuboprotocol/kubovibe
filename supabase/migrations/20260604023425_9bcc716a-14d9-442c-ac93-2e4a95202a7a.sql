-- Fix 1: Stop exposing chat history (messages column) to anonymous users on published projects.
-- The published_projects view already excludes 'messages'. Switch it to a SECURITY DEFINER
-- view (security_invoker = false) so the public path reads only the safe columns,
-- then drop the anon SELECT policy on the base projects table.

ALTER VIEW public.published_projects SET (security_invoker = false);

GRANT SELECT ON public.published_projects TO anon, authenticated;

DROP POLICY IF EXISTS "Anon can view published project meta" ON public.projects;

-- Fix 2: Scope creative_assets Realtime channels to their owner.
-- Without this, any authenticated user could subscribe to another user's
-- creative_assets:* topic and receive their generation events in real time.

DROP POLICY IF EXISTS "Users subscribe own creative_assets topic" ON realtime.messages;
CREATE POLICY "Users subscribe own creative_assets topic"
  ON realtime.messages
  FOR SELECT TO authenticated
  USING (
    realtime.topic() LIKE ('creative_assets:user:' || (auth.uid())::text || '%')
    OR realtime.topic() NOT LIKE 'creative_assets:%'
  );