-- Fix missing RLS policies for ai_jobs table
-- The ai_jobs table needs comprehensive policies for all operations

-- Add INSERT policy (for creating new AI jobs)
CREATE POLICY "Management can create AI jobs" 
ON public.ai_jobs 
FOR INSERT 
TO authenticated
WITH CHECK (
  -- Only management can create AI jobs
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
  )
  -- Also allow system operations (edge functions)
  OR auth.uid() IS NULL
);

-- Add UPDATE policy (for processing AI jobs - needed by dequeue_ai_job function)
CREATE POLICY "Management and system can update AI jobs" 
ON public.ai_jobs 
FOR UPDATE 
TO authenticated
USING (
  -- Management can update any AI job
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
  )
  -- Also allow system operations (edge functions)
  OR auth.uid() IS NULL
)
WITH CHECK (
  -- Same conditions for the updated data
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
  )
  OR auth.uid() IS NULL
);

-- Add DELETE policy (for cleanup operations)
CREATE POLICY "Management can delete AI jobs" 
ON public.ai_jobs 
FOR DELETE 
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role])
  )
);

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'rls_policies_added',
  'table',
  NULL,
  jsonb_build_object(
    'table_name', 'ai_jobs',
    'policies_added', ARRAY['INSERT', 'UPDATE', 'DELETE'],
    'security_fix', 'Added comprehensive RLS policies for all operations',
    'impact', 'Secured AI jobs table while maintaining functionality for edge functions'
  )
);