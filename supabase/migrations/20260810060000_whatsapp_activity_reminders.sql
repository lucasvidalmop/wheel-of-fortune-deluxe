-- Lembretes periodicos da meta de grupo do Sorteio WhatsApp: a cada X horas,
-- se a meta coletiva ainda nao foi atingida, o proprio numero que monitora
-- o grupo manda uma mensagem la dentro avisando quantas mensagens faltam.

alter table public.whatsapp_activity_events
  add column if not exists reminder_interval_hours numeric not null default 0,
  add column if not exists reminder_signup_url text not null default '',
  add column if not exists last_reminder_sent_at timestamptz;

-- Dispara a cada 5 minutos; a function decide, por evento, se ja passou o
-- intervalo configurado (reminder_interval_hours) desde o ultimo lembrete.
select cron.unschedule('whatsapp-activity-reminder') where exists (
  select 1 from cron.job where jobname = 'whatsapp-activity-reminder'
);

select cron.schedule(
  'whatsapp-activity-reminder',
  '*/5 * * * *',
  $$
  select net.http_post(
    url:='https://emkjtsgoavvkccucerda.supabase.co/functions/v1/whatsapp-activity-reminder',
    headers:='{"Content-Type": "application/json"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);
