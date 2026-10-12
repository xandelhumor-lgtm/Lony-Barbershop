-- =====================================================================
-- Agendamentos automáticos (pg_cron + pg_net)
--
-- ANTES de rodar, guarde dois segredos no Vault (SQL Editor):
--   select vault.create_secret('https://<PROJECT_REF>.supabase.co', 'project_url');
--   select vault.create_secret('<mesmo valor de CRON_SECRET da Edge Function>', 'cron_secret');
-- =====================================================================
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remove versões antigas (idempotente)
do $$
begin
  perform cron.unschedule(jobname) from cron.job
   where jobname in ('lone-send-reminders', 'lone-generate-slots', 'lone-complete-bookings');
end $$;

-- 1) A cada 15 minutos: lembrete por e-mail 1 hora antes do horário
select cron.schedule(
  'lone-send-reminders',
  '*/15 * * * *',
  $$
  select net.http_post(
    url     := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body    := '{}'::jsonb,
    timeout_milliseconds := 20000
  );
  $$
);

-- 2) Todo dia 03:05 (UTC): mantém sempre 21 dias de agenda aberta
select cron.schedule(
  'lone-generate-slots',
  '5 3 * * *',
  $$ select public.generate_slots(current_date, current_date + 21); $$
);

-- 3) A cada hora: marca como concluídos os atendimentos que já terminaram
select cron.schedule(
  'lone-complete-bookings',
  '0 * * * *',
  $$
  update public.bookings b set status = 'concluido'
    from public.time_slots s
   where s.id = b.slot_id and b.status = 'confirmado' and s.ends_at < now();
  $$
);
