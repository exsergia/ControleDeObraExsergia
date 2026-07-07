create extension if not exists "pgcrypto";

create table if not exists public.encarregados (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  operador_id text,
  nome text,
  email text,
  created_at timestamptz not null default now()
);

create table if not exists public.progresso_diario (
  id text primary key,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table public.obras add column if not exists nome text;
alter table public.obras add column if not exists status text;
alter table public.obras add column if not exists cliente text;
alter table public.obras add column if not exists responsavel text;
alter table public.obras add column if not exists centro_custo text;
alter table public.atividades add column if not exists obra_id text;
alter table public.atividades add column if not exists updated_at timestamptz;
alter table public.encarregados add column if not exists operador_id text;
alter table public.encarregados add column if not exists nome text;
alter table public.encarregados add column if not exists email text;
alter table public.progresso_diario add column if not exists updated_at timestamptz not null default now();

create index if not exists idx_encarregados_operador on public.encarregados (operador_id);
create index if not exists idx_encarregados_email on public.encarregados (lower(email));
create index if not exists idx_atividades_obra_id on public.atividades (obra_id);
create index if not exists idx_progresso_diario_updated_at on public.progresso_diario (updated_at desc);

alter table public.encarregados enable row level security;
alter table public.progresso_diario enable row level security;

create or replace function public.try_timestamptz(value text)
returns timestamptz
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return null;
  end if;
  return value::timestamptz;
exception when others then
  return null;
end;
$$;

create or replace function public.try_numeric(value text)
returns numeric
language plpgsql
immutable
as $$
begin
  if value is null or btrim(value) = '' then
    return 0;
  end if;
  return value::numeric;
exception when others then
  return 0;
end;
$$;

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

create or replace function public.is_fiscal_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_app_admin()
    or lower(coalesce(auth.jwt() ->> 'email', '')) in (
      'contasapagar@gmail.com',
      'nascimentoerick446@gmail.com'
    );
$$;

create or replace function public.resolve_login_identifier(p_identifier text)
returns text
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  digits text := regexp_replace(coalesce(p_identifier, ''), '\D', '', 'g');
  resolved_email text;
begin
  if digits = '' then
    return null;
  end if;

  select lower(c.data ->> 'email')
    into resolved_email
  from public.cpfs c
  where c.id = digits
  limit 1;

  if resolved_email is not null and resolved_email <> '' then
    return resolved_email;
  end if;

  select lower(coalesce(o.email, o.data ->> 'email'))
    into resolved_email
  from public.operadores o
  where regexp_replace(coalesce(o.cpf, o.data ->> 'cpf', ''), '\D', '', 'g') = digits
     or regexp_replace(coalesce(o.telefone, o.data ->> 'telefone', ''), '\D', '', 'g') = digits
  limit 1;

  return nullif(resolved_email, '');
end;
$$;

revoke all on function public.resolve_login_identifier(text) from public;
grant execute on function public.resolve_login_identifier(text) to anon, authenticated;

create or replace function public.sync_app_flat_columns()
returns trigger
language plpgsql
as $$
declare
  planned numeric;
  executed numeric;
  percent numeric;
begin
  new.data = coalesce(new.data, '{}'::jsonb) || jsonb_build_object('id', new.id);

  if TG_TABLE_NAME = 'obras' then
    new.nome = new.data ->> 'nome';
    new.status = new.data ->> 'status';
    new.cliente = new.data ->> 'cliente';
    new.responsavel = new.data ->> 'responsavel';
    new.centro_custo = new.data ->> 'centroCusto';
  elsif TG_TABLE_NAME = 'atividades' then
    planned := public.try_numeric(new.data ->> 'quantidadePrevista');
    executed := public.try_numeric(new.data ->> 'quantidadeExecutada');
    percent := case when planned > 0 then least(100, (executed / planned) * 100) else 0 end;

    new.data = jsonb_set(new.data, '{percentual}', to_jsonb(percent), true);
    new.obra_id = new.data ->> 'obraId';
    new.updated_at = coalesce(public.try_timestamptz(new.data ->> 'updatedAt'), new.updated_at, now());
  elsif TG_TABLE_NAME = 'operadores' then
    new.nome = new.data ->> 'nome';
    new.sobrenome = new.data ->> 'sobrenome';
    new.email = new.data ->> 'email';
    new.cpf = new.data ->> 'cpf';
    new.telefone = new.data ->> 'telefone';
    new.funcao = new.data ->> 'funcao';
    new.role = coalesce(new.data ->> 'role', new.role, 'operator');
    new.lgpd_aceite_versao = coalesce(new.data #>> '{lgpdAceite,versao}', new.lgpd_aceite_versao);
    new.lgpd_aceite_data = coalesce(public.try_timestamptz(new.data #>> '{lgpdAceite,data}'), new.lgpd_aceite_data);
  elsif TG_TABLE_NAME = 'encarregados' then
    new.operador_id = coalesce(new.data ->> 'operadorId', new.id);
    new.nome = new.data ->> 'nome';
    new.email = new.data ->> 'email';
  elsif TG_TABLE_NAME = 'progresso_diario' then
    new.updated_at = coalesce(public.try_timestamptz(new.data ->> 'updatedAt'), new.updated_at, now());
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_obras_flat on public.obras;
create trigger trg_sync_obras_flat before insert or update on public.obras
for each row execute function public.sync_app_flat_columns();

drop trigger if exists trg_sync_atividades_flat on public.atividades;
create trigger trg_sync_atividades_flat before insert or update on public.atividades
for each row execute function public.sync_app_flat_columns();

drop trigger if exists trg_sync_operadores_flat on public.operadores;
create trigger trg_sync_operadores_flat before insert or update on public.operadores
for each row execute function public.sync_app_flat_columns();

drop trigger if exists trg_sync_encarregados_flat on public.encarregados;
create trigger trg_sync_encarregados_flat before insert or update on public.encarregados
for each row execute function public.sync_app_flat_columns();

drop trigger if exists trg_sync_progresso_diario_flat on public.progresso_diario;
create trigger trg_sync_progresso_diario_flat before insert or update on public.progresso_diario
for each row execute function public.sync_app_flat_columns();

update public.obras set data = data;
update public.atividades set data = data;
update public.operadores set data = data;
update public.encarregados set data = data;
update public.progresso_diario set data = data;

create or replace function public.jsonb_only_has_keys(p_value jsonb, p_keys text[])
returns boolean
language sql
immutable
as $$
  select not exists (
    select 1
    from jsonb_object_keys(coalesce(p_value, '{}'::jsonb)) as obj(key)
    where not (obj.key = any(p_keys))
  );
$$;

create or replace function public.apply_jsonb_patch(p_base jsonb, p_patch jsonb)
returns jsonb
language plpgsql
immutable
as $$
declare
  next_data jsonb := coalesce(p_base, '{}'::jsonb);
  key text;
  val jsonb;
  op text;
  existing_array jsonb;
  updated_array jsonb;
  item jsonb;
  current_num numeric;
  delta numeric;
begin
  for key, val in select * from jsonb_each(coalesce(p_patch, '{}'::jsonb)) loop
    if jsonb_typeof(val) = 'object' and val ? '__op' then
      op := val ->> '__op';

      if op = 'arrayUnion' then
        existing_array := case
          when jsonb_typeof(next_data -> key) = 'array' then next_data -> key
          else '[]'::jsonb
        end;

        for item in select value from jsonb_array_elements(coalesce(val -> 'values', '[]'::jsonb)) loop
          if not exists (
            select 1 from jsonb_array_elements(existing_array) as elem(value)
            where elem.value = item
          ) then
            existing_array := existing_array || jsonb_build_array(item);
          end if;
        end loop;

        next_data := jsonb_set(next_data, array[key], existing_array, true);
      elsif op = 'arrayRemove' then
        existing_array := case
          when jsonb_typeof(next_data -> key) = 'array' then next_data -> key
          else '[]'::jsonb
        end;

        select coalesce(jsonb_agg(elem.value), '[]'::jsonb)
          into updated_array
        from jsonb_array_elements(existing_array) as elem(value)
        where not exists (
          select 1
          from jsonb_array_elements(coalesce(val -> 'values', '[]'::jsonb)) as rem(value)
          where rem.value = elem.value
        );

        next_data := jsonb_set(next_data, array[key], coalesce(updated_array, '[]'::jsonb), true);
      elsif op = 'increment' then
        current_num := public.try_numeric(next_data ->> key);
        delta := public.try_numeric(val ->> 'value');
        next_data := jsonb_set(next_data, array[key], to_jsonb(current_num + delta), true);
      end if;
    else
      next_data := jsonb_set(next_data, array[key], val, true);
    end if;
  end loop;

  return next_data;
end;
$$;

create or replace function public.can_write_app_table(
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
    return public.is_fiscal_user();
  end if;

  if p_table in ('tools', 'vehicles') then
    if is_enc then
      return true;
    end if;

    return p_action = 'update'
      and public.jsonb_only_has_keys(p_value, array['status', 'lastLogId', 'updatedAt']);
  end if;

  if p_table = 'toolLogs' then
    if is_enc then
      return true;
    end if;

    if p_action = 'insert' then
      return coalesce(p_value ->> 'responsavelId', '') = auth.uid()::text;
    elsif p_action = 'update' then
      select data ->> 'responsavelId'
        into current_owner
      from public."toolLogs"
      where id = p_record_id;

      return current_owner = auth.uid()::text
        and public.jsonb_only_has_keys(
          p_value,
          array['previsaoDevolucao', 'diasUso', 'activityId', 'movementHash', 'dataDevolucao', 'fotoDevolucaoUrl', 'statusLog', 'updatedAt']
        );
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
      select data ->> 'responsavelId'
        into current_owner
      from public."vehicleLogs"
      where id = p_record_id;

      return current_owner = auth.uid()::text
        and public.jsonb_only_has_keys(
          p_value,
          array['activityId', 'movementHash', 'dataDevolucao', 'fotoPainelDevolucao', 'localDevolucao', 'observacaoDevolucao', 'fotosAvaria', 'statusLog', 'updatedAt']
        );
    end if;

    return false;
  end if;

  if p_table = 'operadores' then
    return p_action = 'update' and p_record_id = auth.uid()::text;
  end if;

  return false;
end;
$$;

create or replace function public.commit_json_batch(p_ops jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  op jsonb;
  action text;
  tbl text;
  rec_id text;
  patch jsonb;
  current_data jsonb;
  next_data jsonb;
begin
  if jsonb_typeof(coalesce(p_ops, '[]'::jsonb)) <> 'array' then
    raise exception 'Operações inválidas.';
  end if;

  for op in select value from jsonb_array_elements(coalesce(p_ops, '[]'::jsonb)) loop
    action := op ->> 'type';
    tbl := op ->> 'table';
    rec_id := op ->> 'id';
    patch := coalesce(op -> 'value', '{}'::jsonb);

    if action not in ('set', 'update', 'delete') or rec_id is null or tbl is null then
      raise exception 'Operação inválida no batch.';
    end if;

    if tbl not in (
      'obras', 'materiais', 'atividades', 'checklists', 'operadores', 'encarregados',
      'tools', 'toolLogs', 'vehicles', 'vehicleLogs', 'fiscal_docs',
      'equipamentos', 'equipamento_manutencoes', 'equipamento_locacoes', 'progresso_diario'
    ) then
      raise exception 'Tabela não permitida no batch: %', tbl;
    end if;

    if not public.can_write_app_table(tbl, action, rec_id, patch) then
      raise exception 'Permissão negada para % em %', action, tbl;
    end if;

    if action = 'delete' then
      execute format('delete from public.%I where id = $1', tbl) using rec_id;
    elsif action = 'set' then
      next_data := coalesce(patch, '{}'::jsonb) || jsonb_build_object('id', rec_id);
      execute format(
        'insert into public.%I (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data',
        tbl
      ) using rec_id, next_data;
    elsif action = 'update' then
      execute format('select data from public.%I where id = $1 for update', tbl)
        into current_data
        using rec_id;

      next_data := public.apply_jsonb_patch(
        coalesce(current_data, '{}'::jsonb) || jsonb_build_object('id', rec_id),
        patch
      );

      execute format(
        'insert into public.%I (id, data) values ($1, $2) on conflict (id) do update set data = excluded.data',
        tbl
      ) using rec_id, next_data;
    end if;
  end loop;
end;
$$;

revoke all on function public.commit_json_batch(jsonb) from public;
grant execute on function public.commit_json_batch(jsonb) to authenticated;

insert into storage.buckets (id, name, public)
values ('uploads', 'uploads', false)
on conflict (id) do update set public = false;

do $$
declare
  tbl text;
  pol record;
begin
  foreach tbl in array array[
    'obras', 'materiais', 'atividades', 'checklists', 'operadores', 'cpfs',
    'tools', 'toolLogs', 'vehicles', 'vehicleLogs', 'admin_access',
    'encarregados', 'progresso_diario', 'fiscal_docs', 'equipamentos',
    'equipamento_manutencoes', 'equipamento_locacoes', 'push_subscriptions'
  ] loop
    if to_regclass('public.' || quote_ident(tbl)) is not null then
      for pol in execute format(
        'select policyname from pg_policies where schemaname = ''public'' and tablename = %L',
        tbl
      ) loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, tbl);
      end loop;
    end if;
  end loop;
end $$;

create policy "obras select auth" on public.obras
  for select to authenticated using (true);
create policy "obras write staff" on public.obras
  for all to authenticated using (public.can_write_app_table('obras', 'update', id, data))
  with check (public.can_write_app_table('obras', 'insert', id, data));

create policy "materiais select auth" on public.materiais
  for select to authenticated using (true);
create policy "materiais write staff" on public.materiais
  for all to authenticated using (public.can_write_app_table('materiais', 'update', id, data))
  with check (public.can_write_app_table('materiais', 'insert', id, data));

create policy "atividades select auth" on public.atividades
  for select to authenticated using (true);
create policy "atividades write staff" on public.atividades
  for all to authenticated using (public.can_write_app_table('atividades', 'update', id, data))
  with check (public.can_write_app_table('atividades', 'insert', id, data));

create policy "checklists select auth" on public.checklists
  for select to authenticated using (true);
create policy "checklists write staff" on public.checklists
  for all to authenticated using (public.can_write_app_table('checklists', 'update', id, data))
  with check (public.can_write_app_table('checklists', 'insert', id, data));

create policy "progresso diario select auth" on public.progresso_diario
  for select to authenticated using (true);
create policy "progresso diario write staff" on public.progresso_diario
  for all to authenticated using (public.can_write_app_table('progresso_diario', 'update', id, data))
  with check (public.can_write_app_table('progresso_diario', 'insert', id, data));

create policy "operadores select scoped" on public.operadores
  for select to authenticated
  using (id = auth.uid()::text or public.is_app_admin() or public.is_app_encarregado() or public.is_fiscal_user());
create policy "operadores insert signup" on public.operadores
  for insert to anon, authenticated with check (true);
create policy "operadores update self admin" on public.operadores
  for update to authenticated
  using (id = auth.uid()::text or public.is_app_admin())
  with check (id = auth.uid()::text or public.is_app_admin());
create policy "operadores delete admin" on public.operadores
  for delete to authenticated using (public.is_app_admin());

create policy "encarregados select scoped" on public.encarregados
  for select to authenticated
  using (id = auth.uid()::text or public.is_app_admin() or public.is_app_encarregado());
create policy "encarregados write admin" on public.encarregados
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "cpfs insert signup" on public.cpfs
  for insert to anon, authenticated
  with check (id ~ '^[0-9]{11}$' and coalesce(data ->> 'email', '') <> '');
create policy "cpfs update admin" on public.cpfs
  for update to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "cpfs delete admin" on public.cpfs
  for delete to authenticated using (public.is_app_admin());

create policy "admin access select auth" on public.admin_access
  for select to authenticated using (true);
create policy "admin access write admin" on public.admin_access
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "tools select auth" on public.tools
  for select to authenticated using (true);
create policy "tools insert staff" on public.tools
  for insert to authenticated with check (public.is_app_admin() or public.is_app_encarregado());
create policy "tools update staff" on public.tools
  for update to authenticated using (public.is_app_admin() or public.is_app_encarregado())
  with check (public.is_app_admin() or public.is_app_encarregado());
create policy "tools delete staff" on public.tools
  for delete to authenticated using (public.is_app_admin() or public.is_app_encarregado());

create policy "tool logs select auth" on public."toolLogs"
  for select to authenticated using (true);
create policy "tool logs insert owner" on public."toolLogs"
  for insert to authenticated
  with check (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text);
create policy "tool logs update owner" on public."toolLogs"
  for update to authenticated
  using (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text)
  with check (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text);
create policy "tool logs delete staff" on public."toolLogs"
  for delete to authenticated using (public.is_app_admin() or public.is_app_encarregado());

create policy "vehicles select auth" on public.vehicles
  for select to authenticated using (true);
create policy "vehicles insert staff" on public.vehicles
  for insert to authenticated with check (public.is_app_admin() or public.is_app_encarregado());
create policy "vehicles update staff" on public.vehicles
  for update to authenticated using (public.is_app_admin() or public.is_app_encarregado())
  with check (public.is_app_admin() or public.is_app_encarregado());
create policy "vehicles delete staff" on public.vehicles
  for delete to authenticated using (public.is_app_admin() or public.is_app_encarregado());

create policy "vehicle logs select auth" on public."vehicleLogs"
  for select to authenticated using (true);
create policy "vehicle logs insert owner" on public."vehicleLogs"
  for insert to authenticated
  with check (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text);
create policy "vehicle logs update owner" on public."vehicleLogs"
  for update to authenticated
  using (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text)
  with check (public.is_app_admin() or public.is_app_encarregado() or data ->> 'responsavelId' = auth.uid()::text);
create policy "vehicle logs delete staff" on public."vehicleLogs"
  for delete to authenticated using (public.is_app_admin() or public.is_app_encarregado());

create policy "fiscal docs select fiscal" on public.fiscal_docs
  for select to authenticated using (public.is_fiscal_user());
create policy "fiscal docs insert fiscal" on public.fiscal_docs
  for insert to authenticated with check (public.is_fiscal_user());
create policy "fiscal docs update fiscal" on public.fiscal_docs
  for update to authenticated using (public.is_fiscal_user()) with check (public.is_fiscal_user());
create policy "fiscal docs delete admin" on public.fiscal_docs
  for delete to authenticated using (public.is_app_admin());

create policy "equipamentos admin all" on public.equipamentos
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "equipamento manutencoes admin all" on public.equipamento_manutencoes
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());
create policy "equipamento locacoes admin all" on public.equipamento_locacoes
  for all to authenticated using (public.is_app_admin()) with check (public.is_app_admin());

create policy "push subscriptions own" on public.push_subscriptions
  for all to authenticated
  using (data ->> 'userId' = auth.uid()::text)
  with check (data ->> 'userId' = auth.uid()::text);

drop policy if exists "authenticated read uploads" on storage.objects;
drop policy if exists "authenticated upload files" on storage.objects;
drop policy if exists "authenticated update files" on storage.objects;
drop policy if exists "authenticated delete files" on storage.objects;

create policy "authenticated read uploads" on storage.objects
  for select to authenticated using (bucket_id = 'uploads');
create policy "authenticated upload files" on storage.objects
  for insert to authenticated with check (bucket_id = 'uploads');
create policy "authenticated update files" on storage.objects
  for update to authenticated using (bucket_id = 'uploads') with check (bucket_id = 'uploads');
create policy "authenticated delete files" on storage.objects
  for delete to authenticated using (bucket_id = 'uploads' and public.is_app_admin());
