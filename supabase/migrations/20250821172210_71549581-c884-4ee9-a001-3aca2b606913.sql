-- Create AI jobs queue table for server-side processing
CREATE TABLE IF NOT EXISTS ai_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL,                  -- the triggering fan message
  conversation_id UUID NOT NULL,
  creator_id UUID NOT NULL,
  fan_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',    -- pending | processing | succeeded | failed
  tries INT NOT NULL DEFAULT 0,
  last_error TEXT,
  result_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Exactly once: only one job per message
CREATE UNIQUE INDEX IF NOT EXISTS ai_jobs_message_id_key ON ai_jobs(message_id);

-- Index for worker queries
CREATE INDEX IF NOT EXISTS ai_jobs_status_created_idx ON ai_jobs(status, created_at) WHERE status = 'pending';

-- Conversation lock to prevent flooding
CREATE INDEX IF NOT EXISTS ai_jobs_conversation_processing_idx ON ai_jobs(conversation_id) WHERE status IN ('pending', 'processing');

-- Helper view for the worker
CREATE OR REPLACE VIEW ai_jobs_ready AS
SELECT * FROM ai_jobs WHERE status = 'pending' ORDER BY created_at ASC;

-- Drop the old trigger if it exists
DROP TRIGGER IF EXISTS messages_ai_trigger ON messages;

-- Create updated trigger function for enqueuing AI jobs
CREATE OR REPLACE FUNCTION ai_enqueue_job() 
RETURNS TRIGGER AS $$
DECLARE
  is_fan_role BOOLEAN;
  creator_user_id UUID;
BEGIN
  -- Only process active messages
  IF NEW.status != 'active' OR NEW.is_system_message = true THEN
    RETURN NEW;
  END IF;
  
  -- Get conversation details
  SELECT creator_id INTO creator_user_id
  FROM conversations 
  WHERE id = NEW.conversation_id AND status = 'active';
  
  IF creator_user_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Check if sender is a fan (not the creator)
  is_fan_role := (NEW.sender_id != creator_user_id);
  
  -- Only enqueue jobs for fan messages
  IF is_fan_role THEN
    -- Check if there's already a pending/processing job for this conversation
    -- This prevents flooding
    IF EXISTS (
      SELECT 1 FROM ai_jobs 
      WHERE conversation_id = NEW.conversation_id 
      AND status IN ('pending', 'processing')
    ) THEN
      -- Don't enqueue if there's already work in progress
      RETURN NEW;
    END IF;
    
    -- Check AI settings to see if auto-response is enabled
    IF EXISTS (
      SELECT 1 FROM ai_conversation_settings acs
      WHERE acs.conversation_id = NEW.conversation_id 
      AND acs.is_ai_enabled = true 
      AND acs.auto_response_enabled = true
    ) THEN
      -- Enqueue the job
      INSERT INTO ai_jobs(message_id, conversation_id, creator_id, fan_id)
      VALUES (NEW.id, NEW.conversation_id, creator_user_id, NEW.sender_id)
      ON CONFLICT (message_id) DO NOTHING;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
CREATE TRIGGER messages_ai_enqueue_trigger 
AFTER INSERT ON messages
FOR EACH ROW 
EXECUTE FUNCTION ai_enqueue_job();

-- Add RLS policies for ai_jobs table
ALTER TABLE ai_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management can view AI jobs" ON ai_jobs
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
  )
);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ai_jobs_updated_at_trigger
BEFORE UPDATE ON ai_jobs
FOR EACH ROW
EXECUTE FUNCTION update_ai_jobs_updated_at();