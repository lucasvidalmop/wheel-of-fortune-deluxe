SELECT cron.unschedule('process-email-queue');
SELECT cron.schedule(
  'process-email-queue',
  '*/10 * * * *',
  $$
  SELECT net.http_post(
    url:='https://zrijrsntmmzyykuqjbno.supabase.co/functions/v1/process-email-queue',
    headers:='{"Content-Type": "application/json", "apikey": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyaWpyc250bW16eXlrdXFqYm5vIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwMTIwMzksImV4cCI6MjA5MDU4ODAzOX0.AMxJ0DjIsWSf6UF9UEAbThj5Y0LvOtFJ6S2u72Ll4f4"}'::jsonb,
    body:=concat('{"time": "', now(), '"}')::jsonb
  );
  $$
);