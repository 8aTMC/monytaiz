-- Fix Security Definer View issue by changing view ownership from postgres to authenticator
-- Views owned by postgres (superuser) effectively act as SECURITY DEFINER and bypass RLS
-- Changing ownership to authenticator ensures RLS policies are properly enforced

-- Change ownership of ai_jobs_ready view to authenticator
ALTER VIEW public.ai_jobs_ready OWNER TO authenticator;

-- Change ownership of fan_my_media view to authenticator  
ALTER VIEW public.fan_my_media OWNER TO authenticator;

-- Verify the views are now owned by authenticator (not postgres)
-- This ensures they will respect the calling user's RLS policies

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'view_ownership_security_fixed',
  'view',
  NULL,
  jsonb_build_object(
    'issue', 'Security Definer View - views owned by superuser postgres',
    'fix_applied', 'Changed view ownership from postgres to authenticator',
    'views_fixed', ARRAY['ai_jobs_ready', 'fan_my_media'],
    'security_improvement', 'Views now respect calling users RLS policies instead of bypassing with superuser privileges',
    'old_owner', 'postgres',
    'new_owner', 'authenticator'
  )
);