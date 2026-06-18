-- MIGRACAO SEM APAGAR DADOS
-- Use este arquivo se o banco já está em uso e você não quer zerar as tabelas.
-- Ele adiciona colunas visíveis na tabela operadores e copia os dados do JSON para elas.

alter table public.operadores add column if not exists nome text;
alter table public.operadores add column if not exists sobrenome text;
alter table public.operadores add column if not exists email text;
alter table public.operadores add column if not exists cpf text;
alter table public.operadores add column if not exists telefone text;
alter table public.operadores add column if not exists funcao text;
alter table public.operadores add column if not exists role text default 'operator';
alter table public.operadores add column if not exists lgpd_aceite_versao text;
alter table public.operadores add column if not exists lgpd_aceite_data timestamptz;

update public.operadores
set
  nome = coalesce(nome, data ->> 'nome'),
  sobrenome = coalesce(sobrenome, data ->> 'sobrenome'),
  email = coalesce(email, data ->> 'email'),
  cpf = coalesce(cpf, data ->> 'cpf'),
  telefone = coalesce(telefone, data ->> 'telefone'),
  funcao = coalesce(funcao, data ->> 'funcao'),
  role = coalesce(role, data ->> 'role', 'operator'),
  lgpd_aceite_versao = coalesce(lgpd_aceite_versao, data #>> '{lgpdAceite,versao}'),
  lgpd_aceite_data = coalesce(lgpd_aceite_data, nullif(data #>> '{lgpdAceite,data}', '')::timestamptz);

create index if not exists idx_operadores_nome on public.operadores (lower(coalesce(nome, data ->> 'nome', '')));
create index if not exists idx_operadores_email on public.operadores (lower(coalesce(email, data ->> 'email', '')));
create index if not exists idx_operadores_cpf on public.operadores (regexp_replace(coalesce(cpf, data ->> 'cpf', ''), '\D', '', 'g'));
create index if not exists idx_operadores_lgpd_aceite_data on public.operadores (lgpd_aceite_data);
