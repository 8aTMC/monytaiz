-- Fix remaining Security Definer View issues

-- Check if get_ai_jobs_ready function exists and fix it
DO $$
BEGIN
    -- Drop any existing function that might be causing issues
    DROP FUNCTION IF EXISTS public.get_ai_jobs_ready() CASCADE;
    
    -- The ai_jobs_ready view should be a simple view without SECURITY DEFINER
    -- Recreate it to rely on RLS policies from ai_jobs table
    DROP VIEW IF EXISTS public.ai_jobs_ready CASCADE;
    
    -- Create a simple view that relies on RLS policies
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
    
    -- Grant appropriate permissions
    GRANT SELECT ON public.ai_jobs_ready TO authenticated;
    
    -- Add audit log entry
    INSERT INTO audit_logs (
      user_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) VALUES (
      auth.uid(),
      'security_definer_view_fixed',
      'view',
      NULL,
      jsonb_build_object(
        'view_name', 'ai_jobs_ready',
        'security_fix', 'removed any SECURITY DEFINER dependencies, now relies on RLS policies',
        'impact', 'improved security by enforcing proper access control'
      )
    );
    
END $$;