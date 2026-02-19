-- Enable required extensions
create extension if not exists pg_cron;
create extension if not exists pg_net;
-- Store your project URL and anon key in Vault before enabling the schedule:
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<YOUR_ANON_OR_SERVICE_KEY>', 'publishable_key');
-- Adjust the cron expression as desired. This schedules every hour at minute 5.

-- Drop any existing schedule with the same name to avoid duplicates
do $$
begin
  perform cron.unschedule('invoke-jobs-cron-hourly');
exception when others then
  -- ignore if it didn't exist
  null;
end;$$;
select cron.schedule(
  'invoke-jobs-cron-hourly',
  '5 * * * *',
  $$
  select
    net.http_post(
      (
        select decrypted_secret from vault.decrypted_secrets where name = 'project_url'
      ) || '/functions/v1/jobs-cron',
      headers := jsonb_build_object(
        'Content-type', 'application/json',
        'Authorization', 'Bearer ' || (
          select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'
        )
      ),
      body := jsonb_build_object(
        'defaultQueries', array['Software Engineer','Frontend Developer','Full Stack Developer'],
        'location', 'Remote',
        'limitPerQuery', 15
      )
    ) as request_id;
  $$
);
