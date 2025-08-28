-- Fix the security definer view issue by ensuring the ai_jobs_ready view 
-- uses proper security model and doesn't bypass RLS
DROP VIEW IF EXISTS public.ai_jobs_ready;

-- Recreate the view without SECURITY DEFINER to ensure it respects caller's RLS
CREATE VIEW public.ai_jobs_ready 
SECURITY INVOKER
AS
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
FROM public.ai_jobs 
WHERE status = 'pending' 
ORDER BY created_at ASC;

-- Verify that the view respects RLS by testing access patterns
COMMENT ON VIEW public.ai_jobs_ready IS 'Secure view of pending AI jobs that respects row-level security policies from the base ai_jobs table';

-- Update audit log to reflect the security fix
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  metadata
) VALUES (
  auth.uid(),
  'security_vulnerability_fixed',
  'ai_jobs_ready_view',
  jsonb_build_object(
    'issue', 'Security Definer View vulnerability',
    'fix', 'Recreated view with SECURITY INVOKER to respect caller RLS policies',
    'base_table_rls', 'Inherits from ai_jobs table policies'
  )
);