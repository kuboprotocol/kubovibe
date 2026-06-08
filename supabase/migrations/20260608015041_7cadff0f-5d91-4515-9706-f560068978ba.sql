-- Hardening performance_metrics
ALTER TABLE public.performance_metrics ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- Update policies for performance_metrics
DROP POLICY IF EXISTS "Authenticated users can view metrics" ON public.performance_metrics;
DROP POLICY IF EXISTS "Authenticated users can insert metrics" ON public.performance_metrics;

CREATE POLICY "Users can view own metrics" ON public.performance_metrics
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR internal.is_kubo_admin());

CREATE POLICY "Users can insert own metrics" ON public.performance_metrics
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Ensure RLS is enabled (it was already, but for completeness)
ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

-- Grant access
GRANT SELECT, INSERT ON public.performance_metrics TO authenticated;
GRANT ALL ON public.performance_metrics TO service_role;
