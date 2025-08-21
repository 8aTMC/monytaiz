-- Create the dequeue function for atomic job locking
CREATE OR REPLACE FUNCTION dequeue_ai_job()
RETURNS TABLE (
  id UUID,
  message_id UUID,
  conversation_id UUID,
  creator_id UUID,
  fan_id UUID,
  status TEXT,
  tries INT,
  last_error TEXT,
  result_text TEXT,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  job_record ai_jobs%ROWTYPE;
BEGIN
  -- Atomically claim the next pending job using FOR UPDATE SKIP LOCKED
  UPDATE ai_jobs 
  SET 
    status = 'processing',
    tries = tries + 1,
    updated_at = now()
  WHERE id = (
    SELECT ai_jobs.id 
    FROM ai_jobs 
    WHERE status = 'pending'
    ORDER BY created_at ASC
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
$$;