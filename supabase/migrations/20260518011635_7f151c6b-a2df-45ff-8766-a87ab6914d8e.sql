create table public.web3_connections (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  provider text not null,
  network text not null,
  connection_name text not null,
  rpc_url_ciphertext text not null,
  rpc_url_iv text not null,
  rpc_url_tag text not null,
  api_key_ciphertext text,
  api_key_iv text,
  api_key_tag text,
  api_key_hint text,
  explorer_url text not null,
  last_status text not null default 'unknown',
  last_checked_at timestamptz,
  last_block bigint,
  last_latency_ms integer,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider, network, connection_name)
);

create index web3_connections_user_idx on public.web3_connections (user_id, updated_at desc);

alter table public.web3_connections enable row level security;

create policy "web3 owner select" on public.web3_connections
  for select to authenticated using (auth.uid() = user_id);
create policy "web3 owner insert" on public.web3_connections
  for insert to authenticated with check (auth.uid() = user_id);
create policy "web3 owner update" on public.web3_connections
  for update to authenticated using (auth.uid() = user_id);
create policy "web3 owner delete" on public.web3_connections
  for delete to authenticated using (auth.uid() = user_id);
create policy "web3 service role" on public.web3_connections
  for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

create trigger web3_connections_touch_updated_at
  before update on public.web3_connections
  for each row execute function public.touch_updated_at();

alter publication supabase_realtime add table public.web3_connections;