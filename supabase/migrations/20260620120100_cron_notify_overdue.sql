-- AGENDADOR: chama a Edge Function notify-overdue periodicamente.
-- Requer que a função notify-overdue já esteja deployada e os secrets configurados.
-- Substitua __CRON_SECRET__ pelo mesmo valor definido no secret CRON_SECRET da função.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove agendamento anterior (se existir) antes de recriar.
select cron.unschedule('notify-overdue')
where exists (select 1 from cron.job where jobname = 'notify-overdue');

-- Roda de 6 em 6 horas (UTC 00:00, 06:00, 12:00, 18:00 = BRT 21h, 03h, 09h, 15h).
select cron.schedule(
  'notify-overdue',
  '0 */6 * * *',
  $$
  select net.http_post(
    url := 'https://krbimgxlnyucldfxkvdy.supabase.co/functions/v1/notify-overdue',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', '__CRON_SECRET__'
    ),
    body := '{}'::jsonb
  );
  $$
);
