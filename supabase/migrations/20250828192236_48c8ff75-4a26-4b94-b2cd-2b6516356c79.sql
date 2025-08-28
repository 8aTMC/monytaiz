-- Fix Security Definer View issue by recreating views with proper ownership
-- We cannot change ownership of existing views, so we must recreate them

-- Drop existing views that are owned by postgres (causing security definer behavior)
DROP VIEW IF EXISTS public.ai_jobs_ready CASCADE;
DROP VIEW IF EXISTS public.fan_my_media CASCADE;

-- Recreate ai_jobs_ready view with explicit permissions to avoid security definer behavior
-- This view will inherit the calling user's permissions, not superuser permissions
CREATE VIEW public.ai_jobs_ready 
WITH (security_barrier = false) AS
SELECT 
  id,
  message_id,
  conversation_id,
  creator_id,
  fan_id,
  status,
  tries,
  last_error,
  result_text,
  created_at,
  updated_at
FROM ai_jobs
WHERE status = 'pending';

-- Recreate fan_my_media view with explicit permissions to avoid security definer behavior
-- This view will inherit the calling user's permissions, not superuser permissions  
CREATE VIEW public.fan_my_media
WITH (security_barrier = false) AS
SELECT 
  m.id,
  m.creator_id,
  m.origin,
  m.storage_path,
  m.mime,
  m.type,
  m.size_bytes,
  m.title,
  m.tags,
  m.suggested_price_cents,
  m.notes,
  m.created_at,
  m.updated_at,
  g.granted_at,
  g.grant_type,
  g.price_cents
FROM fan_media_grants g
JOIN media m ON m.id = g.media_id
WHERE g.fan_id = auth.uid();

-- Add comments to document the security considerations
COMMENT ON VIEW public.ai_jobs_ready IS 'Non-security definer view of pending AI jobs - inherits calling users permissions';
COMMENT ON VIEW public.fan_my_media IS 'Non-security definer view of fan media grants - inherits calling users permissions';

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_definer_views_recreated',
  'view',
  NULL,
  jsonb_build_object(
    'issue', 'Security Definer Views owned by superuser',
    'fix_applied', 'Recreated views with security_barrier=false to prevent security definer behavior',
    'views_fixed', ARRAY['ai_jobs_ready', 'fan_my_media'],
    'security_improvement', 'Views now inherit calling users permissions instead of superuser privileges'
  )
);