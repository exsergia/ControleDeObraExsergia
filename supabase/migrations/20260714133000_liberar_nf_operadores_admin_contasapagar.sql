-- Libera NF/Cupom Fiscal para operadores autenticados e adiciona
-- contasapagar@exsergia.eng.br como administrador.

insert into public.admin_access (id, data) values
  ('email:contasapagar@exsergia.eng.br', '{"tipo":"email","valor":"contasapagar@exsergia.eng.br","ativo":true}'::jsonb)
on conflict (id) do update set data = excluded.data;

drop policy if exists "select fiscal docs fiscal" on public.fiscal_docs;
drop policy if exists "fiscal docs select fiscal" on public.fiscal_docs;
drop policy if exists "fiscal_docs select auth" on public.fiscal_docs;
drop policy if exists "select fiscal docs auth" on public.fiscal_docs;
create policy "select fiscal docs auth" on public.fiscal_docs
  for select to authenticated using (true);

drop policy if exists "fiscal docs insert fiscal" on public.fiscal_docs;
drop policy if exists "fiscal_docs insert auth" on public.fiscal_docs;
drop policy if exists "fiscal docs insert auth" on public.fiscal_docs;
create policy "fiscal docs insert auth" on public.fiscal_docs
  for insert to authenticated with check (true);

drop policy if exists "fiscal docs update fiscal" on public.fiscal_docs;
drop policy if exists "fiscal_docs update auth" on public.fiscal_docs;
drop policy if exists "fiscal docs update auth" on public.fiscal_docs;
create policy "fiscal docs update auth" on public.fiscal_docs
  for update to authenticated using (true) with check (true);

create or replace function public.can_write_app_record(
  p_table text,
  p_action text,
  p_record_id text,
  p_value jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  is_admin boolean := public.is_app_admin();
  is_enc boolean := public.is_app_encarregado();
  current_owner text;
begin
  if auth.role() <> 'authenticated' then
    return false;
  end if;

  if is_admin then
    return true;
  end if;

  if p_table in ('obras', 'materiais', 'atividades', 'checklists', 'progresso_diario') then
    return is_enc;
  end if;

  if p_table in ('admin_access', 'encarregados', 'equipamentos', 'equipamento_manutencoes', 'equipamento_locacoes') then
    return false;
  end if;

  if p_table = 'fiscal_docs' then
    return p_action in ('insert', 'update');
  end if;

  if p_table in ('tools', 'vehicles') then
    if is_enc then
      return true;
    end if;
    return p_action = 'update' and public.jsonb_only_has_keys(p_value, array['status', 'lastLogId', 'updatedAt']);
  end if;

  if p_table = 'toolLogs' then
    if is_enc then
      return true;
    end if;
    if p_action = 'insert' then
      return coalesce(p_value ->> 'responsavelId', '') = auth.uid()::text;
    elsif p_action = 'update' then
      select data ->> 'responsavelId' into current_owner from public."toolLogs" where id = p_record_id;
      return current_owner = auth.uid()::text
        and public.jsonb_only_has_keys(p_value, array['previsaoDevolucao', 'diasUso', 'activityId', 'movementHash', 'dataDevolucao', 'fotoDevolucaoUrl', 'statusLog', 'updatedAt']);
    end if;
    return false;
  end if;

  if p_table = 'vehicleLogs' then
    if is_enc then
      return true;
    end if;
    if p_action = 'insert' then
      return coalesce(p_value ->> 'responsavelId', '') = auth.uid()::text;
    elsif p_action = 'update' then
      select data ->> 'responsavelId' into current_owner from public."vehicleLogs" where id = p_record_id;
      return current_owner = auth.uid()::text
        and public.jsonb_only_has_keys(p_value, array['dataDevolucao', 'kmRetorno', 'fotoRetornoUrl', 'fotoPainelRetornoUrl', 'avariaRetornoUrl', 'statusLog', 'updatedAt', 'localRetorno', 'movementHash', 'activityId']);
    end if;
    return false;
  end if;

  return false;
end $$;
