-- AGENDADOR: chama a Edge Function notify-overdue periodicamente.
-- Antes de rodar, configure no banco:
--   alter database postgres set app.settings.supabase_url = 'https://SEU-PROJETO.supabase.co';
--   alter database postgres set app.settings.cron_secret = 'MESMO_VALOR_DO_SECRET_CRON_SECRET';

create extension if not exists pg_cron;
create extension if not exists pg_net;

do $$
declare
  supabase_url text := nullif(current_setting('app.settings.supabase_url', true), '');
  cron_secret text := nullif(current_setting('app.settings.cron_secret', true), '');
  function_url text;
begin
  if supabase_url is null or cron_secret is null then
    raise notice 'Agendamento notify-overdue ignorado: configure app.settings.supabase_url e app.settings.cron_secret e rode esta migration novamente.';
    return;
  end if;

  function_url := rtrim(supabase_url, '/') || '/functions/v1/notify-overdue';

  perform cron.unschedule('notify-overdue')
  where exists (select 1 from cron.job where jobname = 'notify-overdue');

  perform cron.schedule(
    'notify-overdue',
    '0 */6 * * *',
    format(
      $job$
      select net.http_post(
        url := %L,
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', %L
        ),
        body := '{}'::jsonb
      );
      $job$,
      function_url,
      cron_secret
    )
  );
end $$;
