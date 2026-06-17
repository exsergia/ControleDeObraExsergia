-- EXSERGIA HUB - SUPABASE LIMPO
-- Rode este arquivo no SQL Editor do Supabase.
-- Ele cria a estrutura zerada, sem obras/materiais/checklists fictícios.
-- Mantém somente os administradores iniciais em admin_access.

create extension if not exists "pgcrypto";

create table if not exists public.obras (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.materiais (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.atividades (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.checklists (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.operadores (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.cpfs (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.tools (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public."toolLogs" (
  id text primary key default gen_random_uuid()::text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_access (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Índices de performance e bloqueio contra obra duplicada por duplo clique.
create unique index if not exists obras_nome_cliente_unico
  on public.obras (lower(coalesce(data ->> 'nome', '')), lower(coalesce(data ->> 'cliente', '')))
  where coalesce(data ->> 'nome', '') <> '';

create index if not exists idx_obras_created_at on public.obras (created_at desc);
create index if not exists idx_materiais_created_at on public.materiais (created_at desc);
create index if not exists idx_atividades_created_at on public.atividades (created_at desc);
create index if not exists idx_tools_status on public.tools ((data ->> 'status'));

-- ZERA DADOS DE TESTE/FICTÍCIOS.
-- Não apaga auth.users. Usuários do Supabase Auth devem ser controlados em Authentication > Users.
truncate table
  public.obras,
  public.materiais,
  public.atividades,
  public.checklists,
  public.operadores,
  public.cpfs,
  public.tools,
  public."toolLogs",
  public.admin_access
restart identity cascade;

-- Administradores iniciais reais.
-- Para adicionar outro admin, insira novo registro no padrão:
-- id = email:email@dominio.com ou cpf:00000000000
insert into public.admin_access (id, data) values
  ('email:nascimentoerick446@gmail.com', '{"tipo":"email","valor":"nascimentoerick446@gmail.com","ativo":true}'::jsonb),
  ('email:exsergiacel7234@gmail.com', '{"tipo":"email","valor":"exsergiacel7234@gmail.com","ativo":true}'::jsonb)
on conflict (id) do update set data = excluded.data;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    exists (
      select 1
      from public.admin_access a
      where regexp_replace(a.id, '^\s+|\s+$', '', 'g') = ('email:' || lower(coalesce(auth.jwt() ->> 'email', '')))
        and coalesce((a.data ->> 'ativo')::boolean, true) = true
    )
    or exists (
      select 1
      from public.operadores o
      join public.admin_access a on regexp_replace(a.id, '^\s+|\s+$', '', 'g') = ('cpf:' || regexp_replace(coalesce(o.data ->> 'cpf', ''), '\\D', '', 'g'))
      where o.id = auth.uid()::text
        and coalesce((a.data ->> 'ativo')::boolean, true) = true
    );
$$;

alter table public.obras enable row level security;
alter table public.materiais enable row level security;
alter table public.atividades enable row level security;
alter table public.checklists enable row level security;
alter table public.operadores enable row level security;
alter table public.cpfs enable row level security;
alter table public.tools enable row level security;
alter table public."toolLogs" enable row level security;
alter table public.admin_access enable row level security;

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array['obras','materiais','atividades','checklists','operadores','cpfs','tools','toolLogs','admin_access'] loop
    for pol in execute format('select policyname from pg_policies where schemaname = ''public'' and tablename = %L', tbl) loop
      execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
    end loop;
  end loop;
end $$;

create policy "select authenticated obras" on public.obras for select to authenticated using (true);
create policy "select authenticated materiais" on public.materiais for select to authenticated using (true);
create policy "select authenticated atividades" on public.atividades for select to authenticated using (true);
create policy "select authenticated checklists" on public.checklists for select to authenticated using (true);
create policy "select authenticated operadores" on public.operadores for select to authenticated using (true);
create policy "select authenticated tools" on public.tools for select to authenticated using (true);
create policy "select authenticated toolLogs" on public."toolLogs" for select to authenticated using (true);

create policy "admin all obras" on public.obras for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin all materiais" on public.materiais for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin all atividades" on public.atividades for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin all checklists" on public.checklists for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin all operadores" on public.operadores for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "admin all admin_access" on public.admin_access for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "authenticated write tools" on public.tools for all to authenticated using (true) with check (true);
create policy "authenticated write toolLogs" on public."toolLogs" for all to authenticated using (true) with check (true);
create policy "authenticated write atividades" on public.atividades for all to authenticated using (true) with check (true);
create policy "authenticated write checklists" on public.checklists for all to authenticated using (true) with check (true);
create policy "authenticated write materiais" on public.materiais for all to authenticated using (true) with check (true);
create policy "authenticated update obras" on public.obras for update to authenticated using (true) with check (true);

create policy "read cpf map" on public.cpfs for select to anon, authenticated using (true);
create policy "insert cpf map" on public.cpfs for insert to anon, authenticated with check (true);
create policy "update cpf map admin" on public.cpfs for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "insert operador self" on public.operadores for insert to anon, authenticated with check (true);
create policy "update operador self or admin" on public.operadores for update to authenticated using (id = auth.uid()::text or public.is_app_admin()) with check (id = auth.uid()::text or public.is_app_admin());
create policy "read admin registry" on public.admin_access for select to authenticated using (true);

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', true)
on conflict (id) do update set public = true;

drop policy if exists "authenticated read uploads" on storage.objects;
drop policy if exists "authenticated upload files" on storage.objects;
drop policy if exists "authenticated update files" on storage.objects;
drop policy if exists "authenticated delete files" on storage.objects;

create policy "authenticated read uploads" on storage.objects for select to authenticated using (bucket_id = 'uploads');
create policy "authenticated upload files" on storage.objects for insert to authenticated with check (bucket_id = 'uploads');
create policy "authenticated update files" on storage.objects for update to authenticated using (bucket_id = 'uploads') with check (bucket_id = 'uploads');
create policy "authenticated delete files" on storage.objects for delete to authenticated using (bucket_id = 'uploads');

-- Ativa Supabase Realtime nas tabelas do aplicativo.
-- Se aparecer aviso de que já existe na publicação, pode ignorar.
do $$
begin
  begin alter publication supabase_realtime add table public.obras; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.materiais; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.atividades; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.checklists; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.operadores; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.cpfs; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.tools; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public."toolLogs"; exception when duplicate_object then null; end;
  begin alter publication supabase_realtime add table public.admin_access; exception when duplicate_object then null; end;
end $$;
