-- Final attempt to fix Security Definer View issue by replacing views with table-valued functions
-- Since we cannot control view ownership in Supabase, we'll replace them with functions that respect RLS

-- Drop the problematic views entirely
DROP VIEW IF EXISTS public.ai_jobs_ready CASCADE;
DROP VIEW IF EXISTS public.fan_my_media CASCADE;

-- Create table-valued functions instead of views to avoid security definer issues
-- These functions will execute with the calling user's permissions, not elevated privileges

-- Replace ai_jobs_ready view with a function
CREATE OR REPLACE FUNCTION public.get_ai_jobs_ready()
RETURNS TABLE(
  id uuid,
  message_id uuid,
  conversation_id uuid,
  creator_id uuid,
  fan_id uuid,
  status text,
  tries integer,
  last_error text,
  result_text text,
  created_at timestamp with time zone,
  updated_at timestamp with time zone
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    aj.id,
    aj.message_id,
    aj.conversation_id,
    aj.creator_id,
    aj.fan_id,
    aj.status,
    aj.tries,
    aj.last_error,
    aj.result_text,
    aj.created_at,
    aj.updated_at
  FROM ai_jobs aj
  WHERE aj.status = 'pending';
$$;

-- Replace fan_my_media view with the existing get_fan_my_media function (already exists and works correctly)
-- No need to recreate it since it already uses proper RLS policies

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.get_ai_jobs_ready() TO authenticated;

-- Add comments to document the change
COMMENT ON FUNCTION public.get_ai_jobs_ready() IS 'Replacement for ai_jobs_ready view - returns pending AI jobs with proper RLS enforcement';

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_definer_views_replaced_with_functions',
  'function',
  NULL,
  jsonb_build_object(
    'issue', 'Security Definer Views could not be fixed due to postgres ownership',
    'fix_applied', 'Replaced problematic views with table-valued functions',
    'views_removed', ARRAY['ai_jobs_ready', 'fan_my_media'],
    'functions_available', ARRAY['get_ai_jobs_ready', 'get_fan_my_media'],
    'security_improvement', 'Functions execute with calling users permissions and respect RLS policies'
  )
);