-- MIGRACAO SEM APAGAR DADOS
-- Corrige suporte a historico individual de ferramentas e fotos de devolucao.
-- Rode no SQL Editor do Supabase depois de publicar o codigo atualizado.

-- 1) Garante bucket privado para fotos de ferramentas/devolucoes.
insert into storage.buckets (id, name, public)
values ('ferramentas', 'ferramentas', false)
on conflict (id) do update set public = false;

-- 2) Recria policies do bucket ferramentas para usuarios autenticados.
drop policy if exists "authenticated read ferramentas" on storage.objects;
drop policy if exists "authenticated upload ferramentas" on storage.objects;
drop policy if exists "authenticated update ferramentas" on storage.objects;
drop policy if exists "authenticated delete ferramentas" on storage.objects;

create policy "authenticated read ferramentas"
on storage.objects for select
to authenticated
using (bucket_id = 'ferramentas');

create policy "authenticated upload ferramentas"
on storage.objects for insert
to authenticated
with check (bucket_id = 'ferramentas');

create policy "authenticated update ferramentas"
on storage.objects for update
to authenticated
using (bucket_id = 'ferramentas')
with check (bucket_id = 'ferramentas');

create policy "authenticated delete ferramentas"
on storage.objects for delete
to authenticated
using (bucket_id = 'ferramentas');

-- 3) Indices para buscar historico e log aberto por ferramenta.
create index if not exists idx_tool_logs_tool_status_saida
on public."toolLogs" (
  (data ->> 'toolId'),
  (data ->> 'statusLog'),
  (data ->> 'dataSaida')
);

create index if not exists idx_tool_logs_return_photo_path
on public."toolLogs" ((data ->> 'fotoDevolucaoPath'))
where coalesce(data ->> 'fotoDevolucaoPath', '') <> '';

-- 4) Preenche os novos campos de foto em logs antigos, sem alterar datas antigas.
update public."toolLogs"
set data = jsonb_set(
  jsonb_set(data, '{fotoDevolucaoBucket}', coalesce(data -> 'fotoDevolucaoBucket', 'null'::jsonb), true),
  '{fotoDevolucaoPath}',
  coalesce(data -> 'fotoDevolucaoPath', 'null'::jsonb),
  true
);

-- 5) Realinha cada ferramenta com o log aberto mais recente dela.
-- Isso nao muda dataSaida/dataDevolucao de nenhum log.
with latest_open_log as (
  select distinct on (data ->> 'toolId')
    id as log_id,
    data ->> 'toolId' as tool_id
  from public."toolLogs"
  where data ->> 'statusLog' = 'Aberta'
    and coalesce(data ->> 'toolId', '') <> ''
  order by data ->> 'toolId', data ->> 'dataSaida' desc
)
update public.tools t
set data = jsonb_set(
  jsonb_set(t.data, '{lastLogId}', to_jsonb(l.log_id), true),
  '{status}',
  to_jsonb('Em Uso'::text),
  true
)
from latest_open_log l
where t.id = l.tool_id;

-- 6) Remove lastLogId de ferramentas que nao tem log aberto.
update public.tools t
set data = t.data - 'lastLogId'
where coalesce(t.data ->> 'lastLogId', '') <> ''
  and not exists (
    select 1
    from public."toolLogs" l
    where l.id = t.data ->> 'lastLogId'
      and l.data ->> 'statusLog' = 'Aberta'
  );
