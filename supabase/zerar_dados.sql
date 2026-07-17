-- ZERAR DADOS DO APP EXSERGIA SEM APAGAR A ESTRUTURA
-- Rode este arquivo quando quiser limpar os dados de teste.
-- NÃO apaga usuários do Supabase Auth.

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

insert into public.admin_access (id, data) values
  ('email:nascimentoerick446@gmail.com', '{"tipo":"email","valor":"nascimentoerick446@gmail.com","ativo":true}'::jsonb),
  ('email:exsergiacel7234@gmail.com', '{"tipo":"email","valor":"exsergiacel7234@gmail.com","ativo":true}'::jsonb),
  ('email:rosangela@exsergia.eng.br', '{"tipo":"email","valor":"rosangela@exsergia.eng.br","ativo":true}'::jsonb)
on conflict (id) do update set data = excluded.data;
