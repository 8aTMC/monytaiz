-- Fix security issues from previous migration

-- Drop and recreate the view without SECURITY DEFINER (it was implicit)
DROP VIEW IF EXISTS ai_jobs_ready;
CREATE VIEW ai_jobs_ready AS
SELECT * FROM ai_jobs WHERE status = 'pending' ORDER BY created_at ASC;

-- Update functions to set search_path for security
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';

-- Update the timestamp function with proper search_path
CREATE OR REPLACE FUNCTION update_ai_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public';