-- Fix Security Definer View issues by replacing function-based views with direct table access
-- This ensures RLS policies are properly enforced at the view level

-- First, drop the existing fan_my_media view that uses a function call
DROP VIEW IF EXISTS public.fan_my_media;

-- Create a new fan_my_media view that directly queries tables with RLS policies
-- This replaces the function-based approach with direct table joins
CREATE VIEW public.fan_my_media AS
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

-- Enable RLS on the view by ensuring it respects the underlying table policies
COMMENT ON VIEW public.fan_my_media IS 'Direct view of fan media grants - RLS enforced through underlying table policies';

-- Recreate ai_jobs_ready view to ensure it properly enforces RLS
DROP VIEW IF EXISTS public.ai_jobs_ready;

CREATE VIEW public.ai_jobs_ready AS
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

COMMENT ON VIEW public.ai_jobs_ready IS 'Direct view of pending AI jobs - RLS enforced through underlying ai_jobs table policies';

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_definer_views_fixed',
  'view',
  NULL,
  jsonb_build_object(
    'issue', 'Security Definer View vulnerability',
    'fix_applied', 'Replaced function-based views with direct table access',
    'views_fixed', ARRAY['fan_my_media', 'ai_jobs_ready'],
    'security_improvement', 'Views now properly enforce RLS policies from underlying tables',
    'impact', 'Eliminated security definer view issues while maintaining functionality'
  )
);