-- Add only missing RLS policies for ai_jobs table

-- Check if UPDATE policy exists, if not create it
DO $$
BEGIN
  -- Add UPDATE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_jobs' 
    AND cmd = 'UPDATE'
  ) THEN
    EXECUTE '
      CREATE POLICY "Management and system can update AI jobs" 
      ON public.ai_jobs 
      FOR UPDATE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = ANY (ARRAY[''owner''::app_role, ''superadmin''::app_role, ''admin''::app_role, ''manager''::app_role])
        )
        OR auth.uid() IS NULL
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = ANY (ARRAY[''owner''::app_role, ''superadmin''::app_role, ''admin''::app_role, ''manager''::app_role])
        )
        OR auth.uid() IS NULL
      )';
  END IF;

  -- Add INSERT policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_jobs' 
    AND cmd = 'INSERT'
  ) THEN
    EXECUTE '
      CREATE POLICY "Management and system can create AI jobs" 
      ON public.ai_jobs 
      FOR INSERT 
      TO authenticated
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = ANY (ARRAY[''owner''::app_role, ''superadmin''::app_role, ''admin''::app_role, ''manager''::app_role])
        )
        OR auth.uid() IS NULL
      )';
  END IF;

  -- Add DELETE policy if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' 
    AND tablename = 'ai_jobs' 
    AND cmd = 'DELETE'
  ) THEN
    EXECUTE '
      CREATE POLICY "Management can delete AI jobs" 
      ON public.ai_jobs 
      FOR DELETE 
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM user_roles ur 
          WHERE ur.user_id = auth.uid() 
          AND ur.role = ANY (ARRAY[''owner''::app_role, ''superadmin''::app_role, ''admin''::app_role])
        )
      )';
  END IF;
END $$;

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'rls_policies_secured',
  'table',
  NULL,
  jsonb_build_object(
    'table_name', 'ai_jobs',
    'security_fix', 'Ensured comprehensive RLS policies exist for all operations',
    'impact', 'Secured AI jobs table while maintaining functionality'
  )
);