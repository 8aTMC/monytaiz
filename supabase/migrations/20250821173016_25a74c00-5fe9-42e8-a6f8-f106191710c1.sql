-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Schedule the AI worker to run every 10 seconds
-- This will check for pending AI jobs and process them
SELECT cron.schedule(
  'ai-worker-job',
  '*/10 * * * * *', -- every 10 seconds  
  $$
  SELECT
    net.http_post(
      url := 'https://alzyzfjzwvofmjccirjq.supabase.co/functions/v1/ai-worker-cron',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := '{"timestamp": "' || now() || '"}'::jsonb
    ) as request_id;
  $$
);