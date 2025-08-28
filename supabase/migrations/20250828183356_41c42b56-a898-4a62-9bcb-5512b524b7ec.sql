-- Create a security definer function to securely access AI jobs ready data
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
SECURITY DEFINER
SET search_path = public
AS $$
  -- Only allow management roles to access this data
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
  WHERE aj.status = 'pending'
  AND (
    auth.uid() IS NULL -- Allow system operations
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      WHERE ur.user_id = auth.uid()
      AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
    )
  )
  ORDER BY aj.created_at;
$$;

-- Drop the insecure view and replace with secure function access
DROP VIEW IF EXISTS public.ai_jobs_ready;

-- Create a more secure view that uses the security definer function
CREATE VIEW public.ai_jobs_ready_secure AS
SELECT * FROM public.get_ai_jobs_ready();

-- Grant execute permission only to authenticated users
REVOKE ALL ON FUNCTION public.get_ai_jobs_ready() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_ai_jobs_ready() TO authenticated;

-- Add audit log entry
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
    'description', 'Replaced insecure ai_jobs_ready view with secure function-based access',
    'changes', ARRAY['Dropped insecure view', 'Created security definer function', 'Added proper access controls']
  )
);