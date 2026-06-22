-- WEB PUSH: inscrições de dispositivos para notificações (ex.: ferramenta em atraso).
-- Padrão id + data jsonb, como as demais tabelas do app.

create table if not exists public.push_subscriptions (
  id text primary key,          -- endpoint da inscrição (único por dispositivo/navegador)
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_push_subscriptions_user on public.push_subscriptions ((data ->> 'userId'));

alter table public.push_subscriptions enable row level security;

do $$
declare pol record;
begin
  for pol in execute 'select policyname from pg_policies where schemaname = ''public'' and tablename = ''push_subscriptions''' loop
    execute format('drop policy if exists %I on public.push_subscriptions', pol.policyname);
  end loop;
end $$;

-- Usuários autenticados podem registrar/atualizar/remover a própria inscrição.
-- O envio é feito pela Edge Function com a service role (ignora RLS).
create policy "authenticated manage push" on public.push_subscriptions
  for all to authenticated using (true) with check (true);
