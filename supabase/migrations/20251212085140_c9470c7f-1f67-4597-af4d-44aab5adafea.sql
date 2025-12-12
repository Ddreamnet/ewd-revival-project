-- Schedule daily cleanup of expired lesson overrides at 01:00 AM
SELECT cron.schedule(
  'cleanup-lesson-overrides-daily',
  '0 1 * * *',
  $$
  SELECT net.http_post(
    url:='https://hwwpbtcgppzuscbvjkde.supabase.co/functions/v1/cleanup-lesson-overrides',
    headers:='{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh3d3BidGNncHB6dXNjYnZqa2RlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MDg3ODMsImV4cCI6MjA3MDE4NDc4M30.JGRXEpY7HI4CfRJnKqlYLCDovBbZUzkEp8Jx0Jr2NYw"}'::jsonb,
    body:='{}'::jsonb
  ) as request_id;
  $$
);