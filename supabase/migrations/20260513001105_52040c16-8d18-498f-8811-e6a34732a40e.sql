insert into storage.buckets (id, name, public) values ('audit-reports', 'audit-reports', true) on conflict (id) do nothing;

create policy "Public can read audit reports"
on storage.objects for select
to public
using (bucket_id = 'audit-reports');

create policy "Anyone can upload audit reports"
on storage.objects for insert
to public
with check (bucket_id = 'audit-reports');