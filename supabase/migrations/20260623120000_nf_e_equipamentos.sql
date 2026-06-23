-- NF/Cupom Fiscal (Frente 1) + Equipamentos/custo-rentabilidade (Frente 2)
-- Padrão id (text PK) + data jsonb, como o resto do app. Idempotente.

create extension if not exists "pgcrypto";

-- ── Frente 1: documentos fiscais (NF / cupom) ────────────────────────────────
create table if not exists public.fiscal_docs (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_fiscal_docs_created on public.fiscal_docs (created_at desc);

-- ── Frente 2: equipamentos e seus lançamentos financeiros ────────────────────
create table if not exists public.equipamentos (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_equipamentos_status on public.equipamentos ((data ->> 'status'));

create table if not exists public.equipamento_manutencoes (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_manut_equip on public.equipamento_manutencoes ((data ->> 'equipamentoId'));

create table if not exists public.equipamento_locacoes (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists idx_locacoes_equip on public.equipamento_locacoes ((data ->> 'equipamentoId'));

-- ── RLS ──────────────────────────────────────────────────────────────────────
alter table public.fiscal_docs enable row level security;
alter table public.equipamentos enable row level security;
alter table public.equipamento_manutencoes enable row level security;
alter table public.equipamento_locacoes enable row level security;

do $$
declare tbl text; pol record;
begin
  foreach tbl in array array['fiscal_docs','equipamentos','equipamento_manutencoes','equipamento_locacoes'] loop
    for pol in execute format('select policyname from pg_policies where schemaname=''public'' and tablename=%L', tbl) loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

-- fiscal_docs: autenticado lê/cria/edita (a aba é restrita por e-mail no app); delete só admin.
create policy "fiscal_docs select auth" on public.fiscal_docs for select to authenticated using (true);
create policy "fiscal_docs insert auth" on public.fiscal_docs for insert to authenticated with check (true);
create policy "fiscal_docs update auth" on public.fiscal_docs for update to authenticated using (true) with check (true);
create policy "fiscal_docs delete admin" on public.fiscal_docs for delete to authenticated using (public.is_app_admin());

-- equipamentos*: dado financeiro sensível → tudo só admin.
do $$
declare tbl text;
begin
  foreach tbl in array array['equipamentos','equipamento_manutencoes','equipamento_locacoes'] loop
    execute format('create policy %I on public.%I for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin())', tbl || ' admin all', tbl);
  end loop;
end $$;

-- ── Realtime ──────────────────────────────────────────────────────────────────
do $$
begin
  begin alter publication supabase_realtime add table public.fiscal_docs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.equipamentos; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.equipamento_manutencoes; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.equipamento_locacoes; exception when duplicate_object then null; end;
end $$;
