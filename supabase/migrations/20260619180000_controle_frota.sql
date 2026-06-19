-- CONTROLE DE FROTA
-- Cria as tabelas de veículos e logs de movimentação (retirada/devolução).
-- Rode no SQL Editor do Supabase. Idempotente — pode rodar mais de uma vez.

create extension if not exists "pgcrypto";

create table if not exists public.vehicles (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public."vehicleLogs" (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_vehicles_status on public.vehicles ((data ->> 'status'));
create index if not exists idx_vehicles_codigo on public.vehicles ((data ->> 'codigo'));
create index if not exists idx_vehiclelogs_vehicle on public."vehicleLogs" ((data ->> 'vehicleId'));

alter table public.vehicles enable row level security;
alter table public."vehicleLogs" enable row level security;

-- Limpa políticas antigas (caso a migração rode novamente)
do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['vehicles','vehicleLogs'] loop
    for pol in execute format('select policyname from pg_policies where schemaname = ''public'' and tablename = %L', tbl) loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

-- Leitura para qualquer usuário autenticado
create policy "select authenticated vehicles" on public.vehicles for select to authenticated using (true);
create policy "select authenticated vehicleLogs" on public."vehicleLogs" for select to authenticated using (true);

-- Escrita para qualquer usuário autenticado (retirada/devolução são feitas pelos operadores;
-- o controle de cadastro/edição/exclusão é aplicado na camada do app por papel).
create policy "authenticated write vehicles" on public.vehicles for all to authenticated using (true) with check (true);
create policy "authenticated write vehicleLogs" on public."vehicleLogs" for all to authenticated using (true) with check (true);

-- Realtime
do $$
begin
  begin alter publication supabase_realtime add table public.vehicles; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public."vehicleLogs"; exception when duplicate_object then null; end;
end $$;
