-- ENDURECIMENTO DE RLS
-- Antes: tools, toolLogs, vehicles, vehicleLogs, materiais, atividades e checklists
-- tinham policy "for all to authenticated using(true)" — qualquer usuário logado
-- (inclusive operador) podia APAGAR qualquer linha pela API.
--
-- Agora: leitura/insert/update continuam liberados para autenticados (operador
-- precisa disso para retirada/devolução/progresso/conferência), mas DELETE fica
-- restrito a admin OU encarregado. Operadores nunca apagam nada pela UI, então
-- não há mudança de comportamento para eles.

-- Função espelho de is_app_admin() para identificar encarregado ativo.
create or replace function public.is_app_encarregado()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.encarregados e
    where e.id = auth.uid()::text
      and coalesce((e.data ->> 'ativo')::boolean, true) = true
  );
$$;

do $$
declare
  tbl text;
begin
  foreach tbl in array array['tools','toolLogs','vehicles','vehicleLogs','materiais','atividades','checklists'] loop
    -- Remove a policy ampla de escrita (cobria delete também).
    execute format('drop policy if exists %I on public.%I', 'authenticated write ' || tbl, tbl);
    -- Remove policies granulares anteriores (idempotência).
    execute format('drop policy if exists %I on public.%I', tbl || ' insert auth', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || ' update auth', tbl);
    execute format('drop policy if exists %I on public.%I', tbl || ' delete admin-enc', tbl);

    -- Insert e update continuam liberados para autenticados.
    execute format('create policy %I on public.%I for insert to authenticated with check (true)', tbl || ' insert auth', tbl);
    execute format('create policy %I on public.%I for update to authenticated using (true) with check (true)', tbl || ' update auth', tbl);
    -- Delete somente para admin ou encarregado.
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_app_admin() or public.is_app_encarregado())', tbl || ' delete admin-enc', tbl);
  end loop;
end $$;
