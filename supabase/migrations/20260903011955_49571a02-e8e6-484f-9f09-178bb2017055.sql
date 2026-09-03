CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "Admins can view all credit transactions" ON public.credit_transactions FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "Admins can view all projects" ON public.projects FOR SELECT TO authenticated USING (public.has_role('admin'));
CREATE POLICY "Admins can view all user roles" ON public.user_roles FOR SELECT TO authenticated USING (public.has_role('admin'));