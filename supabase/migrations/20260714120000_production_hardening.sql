-- Ajustes de producao: schema principal e banco migrado devem ter as mesmas
-- tabelas, policies e indices usados pelo app atual.

create table if not exists public.push_subscriptions (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user
  on public.push_subscriptions ((data ->> 'userId'));

create index if not exists idx_toollogs_responsavel_status_saida
  on public."toolLogs" ((data ->> 'responsavelId'), (data ->> 'statusLog'), (data ->> 'dataSaida'));

create index if not exists idx_toollogs_tool_status
  on public."toolLogs" ((data ->> 'toolId'), (data ->> 'statusLog'));

alter table public.push_subscriptions enable row level security;

drop policy if exists "authenticated manage push" on public.push_subscriptions;
drop policy if exists "push subscriptions own" on public.push_subscriptions;
create policy "push subscriptions own" on public.push_subscriptions
  for all to authenticated
  using (public.is_app_admin() or coalesce(data ->> 'userId', '') = auth.uid()::text)
  with check (public.is_app_admin() or coalesce(data ->> 'userId', '') = auth.uid()::text);

drop policy if exists "select operadores scoped" on public.operadores;
drop policy if exists "operadores select scoped" on public.operadores;
create policy "operadores select scoped" on public.operadores
  for select to authenticated
  using (
    id = auth.uid()::text
    or public.is_app_admin()
    or public.is_app_encarregado()
    or public.is_fiscal_user()
  );

do $$
begin
  begin alter publication supabase_realtime add table public.push_subscriptions; exception when duplicate_object then null; end;
end $$;
