-- Enable Row Level Security on ai_jobs_ready table
ALTER TABLE public.ai_jobs_ready ENABLE ROW LEVEL SECURITY;

-- Create policy to allow management roles to view AI jobs ready data
CREATE POLICY "Management can view AI jobs ready data" 
ON public.ai_jobs_ready 
FOR SELECT 
USING (EXISTS (
  SELECT 1
  FROM user_roles ur
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
));

-- Create policy to allow system operations (INSERT/UPDATE) for AI processing
-- This allows the AI worker functions to process jobs
CREATE POLICY "System can manage AI jobs ready data" 
ON public.ai_jobs_ready 
FOR ALL 
USING (auth.uid() IS NULL OR EXISTS (
  SELECT 1
  FROM user_roles ur
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
));

-- Add audit logging for security compliance
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  metadata
) VALUES (
  auth.uid(),
  'security_policy_created',
  'ai_jobs_ready_table',
  jsonb_build_object(
    'description', 'Added RLS policies to secure AI job queue data',
    'policies_created', ARRAY['Management can view AI jobs ready data', 'System can manage AI jobs ready data']
  )
);