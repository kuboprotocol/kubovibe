ALTER TABLE public.performance_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert metrics" ON public.performance_metrics 
FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated users can view metrics" ON public.performance_metrics 
FOR SELECT TO authenticated USING (true);