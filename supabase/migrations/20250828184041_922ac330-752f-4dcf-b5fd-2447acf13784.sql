-- Fix the remaining Security Definer View issue with dequeue_ai_job function

-- Remove SECURITY DEFINER from dequeue_ai_job function
-- This function should rely on RLS policies instead of bypassing them
CREATE OR REPLACE FUNCTION public.dequeue_ai_job()
 RETURNS TABLE(id uuid, message_id uuid, conversation_id uuid, creator_id uuid, fan_id uuid, status text, tries integer, last_error text, result_text text, created_at timestamp with time zone, updated_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'public'
AS $function$
DECLARE
  job_record ai_jobs%ROWTYPE;
BEGIN
  -- Atomically claim the next pending job using FOR UPDATE SKIP LOCKED
  -- This relies on RLS policies to ensure only authorized users can access jobs
  UPDATE ai_jobs 
  SET 
    status = 'processing',
    tries = tries + 1,
    updated_at = now()
  WHERE ai_jobs.id = (
    SELECT aj.id 
    FROM ai_jobs aj
    WHERE aj.status = 'pending'
    ORDER BY aj.created_at ASC
    LIMIT 1
    FOR UPDATE SKIP LOCKED
  )
  RETURNING * INTO job_record;

  -- If no job was found, return empty result
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Return the claimed job
  id := job_record.id;
  message_id := job_record.message_id;
  conversation_id := job_record.conversation_id;
  creator_id := job_record.creator_id;
  fan_id := job_record.fan_id;
  status := job_record.status;
  tries := job_record.tries;
  last_error := job_record.last_error;
  result_text := job_record.result_text;
  created_at := job_record.created_at;
  updated_at := job_record.updated_at;

  RETURN NEXT;
END;
$function$;

-- Add audit log entry
INSERT INTO audit_logs (
  user_id,
  action,
  resource_type,
  resource_id,
  metadata
) VALUES (
  auth.uid(),
  'security_definer_function_fixed',
  'function',
  NULL,
  jsonb_build_object(
    'function_name', 'dequeue_ai_job',
    'security_fix', 'removed SECURITY DEFINER, now relies on RLS policies',
    'impact', 'improved security by enforcing proper access control',
    'table_accessed', 'ai_jobs'
  )
);