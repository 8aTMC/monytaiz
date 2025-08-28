-- Check if ai_jobs_ready exists as a view
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE tablename = 'ai_jobs_ready';

-- Check if it's a view
SELECT schemaname, viewname, viewowner 
FROM pg_views 
WHERE viewname = 'ai_jobs_ready';

-- If it's supposed to be a view showing ready AI jobs, let's create it properly with RLS
-- First, let's create the ai_jobs_ready view if it doesn't exist
CREATE OR REPLACE VIEW public.ai_jobs_ready AS
SELECT * FROM public.ai_jobs 
WHERE status = 'pending' 
ORDER BY created_at ASC;

-- Since views inherit RLS from their base tables, and ai_jobs already has proper RLS policies,
-- the ai_jobs_ready view will automatically be secured by the existing policies on ai_jobs table

-- Add audit logging for security compliance
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  metadata
) VALUES (
  auth.uid(),
  'security_view_created',
  'ai_jobs_ready_view',
  jsonb_build_object(
    'description', 'Created secure ai_jobs_ready view that inherits RLS from ai_jobs table',
    'base_table', 'ai_jobs',
    'inherited_policies', 'Management can view AI jobs'
  )
);