insert into public.admin_access (id, data) values
  ('email:rosangela@exsergia.eng.br', '{"tipo":"email","valor":"rosangela@exsergia.eng.br","ativo":true}'::jsonb)
on conflict (id) do update set data = excluded.data;
