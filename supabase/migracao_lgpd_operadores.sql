-- MIGRACAO SEM APAGAR DADOS
-- Adiciona colunas visiveis para o aceite LGPD dos operadores.
-- Rode no SQL Editor do Supabase se o banco ja esta em uso.

alter table public.operadores add column if not exists lgpd_aceite_versao text;
alter table public.operadores add column if not exists lgpd_aceite_data timestamptz;

update public.operadores
set
  lgpd_aceite_versao = coalesce(lgpd_aceite_versao, data #>> '{lgpdAceite,versao}'),
  lgpd_aceite_data = coalesce(lgpd_aceite_data, nullif(data #>> '{lgpdAceite,data}', '')::timestamptz);

create index if not exists idx_operadores_lgpd_aceite_data
  on public.operadores (lgpd_aceite_data);
