-- Fix security warnings by setting proper search paths for functions

-- Update the send welcome message function
CREATE OR REPLACE FUNCTION public.send_welcome_message_to_fan()
RETURNS TRIGGER AS $$
DECLARE
  management_user_id UUID;
  conversation_id UUID;
  welcome_content TEXT;
BEGIN
  -- Only send welcome message if user just completed signup or became verified
  IF (OLD.signup_completed = FALSE AND NEW.signup_completed = TRUE) 
     OR (OLD.email_confirmed = FALSE AND NEW.email_confirmed = TRUE AND NEW.signup_completed = TRUE) THEN
    
    -- Get a management user (owner, superadmin, or admin)
    SELECT ur.user_id INTO management_user_id
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'superadmin', 'admin')
    ORDER BY 
      CASE ur.role 
        WHEN 'owner' THEN 1
        WHEN 'superadmin' THEN 2  
        WHEN 'admin' THEN 3
      END
    LIMIT 1;

    -- Only proceed if we found a management user
    IF management_user_id IS NOT NULL THEN
      -- Check if conversation already exists
      SELECT id INTO conversation_id
      FROM conversations 
      WHERE fan_id = NEW.id AND creator_id = management_user_id AND status = 'active';
      
      -- Create conversation if it doesn't exist
      IF conversation_id IS NULL THEN
        INSERT INTO conversations (fan_id, creator_id, status)
        VALUES (NEW.id, management_user_id, 'active')
        RETURNING id INTO conversation_id;
      END IF;
      
      -- Set welcome message content
      welcome_content := 'Welcome! Thanks for joining us. Feel free to reach out if you have any questions or need assistance. We''re here to help!';
      
      -- Send welcome message
      INSERT INTO messages (conversation_id, sender_id, content, is_system_message, status)
      VALUES (conversation_id, management_user_id, welcome_content, TRUE, 'active');
      
      -- Update conversation last message timestamp
      UPDATE conversations 
      SET last_message_at = NOW(), updated_at = NOW()
      WHERE id = conversation_id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the handle conversation user deletion function
CREATE OR REPLACE FUNCTION public.handle_conversation_user_deletion()
RETURNS TRIGGER AS $$
BEGIN
  -- When a user is marked for deletion, mark their conversations for deletion too
  IF NEW.deletion_status = 'pending_deletion' AND OLD.deletion_status != 'pending_deletion' THEN
    -- Mark conversations as pending deletion
    UPDATE conversations 
    SET 
      status = 'pending_deletion',
      deleted_at = NOW(),
      deletion_scheduled_for = NEW.deletion_scheduled_for,
      updated_at = NOW()
    WHERE (fan_id = NEW.id OR creator_id = NEW.id) AND status = 'active';
    
    -- Mark messages in those conversations as pending deletion
    UPDATE messages 
    SET 
      status = 'pending_deletion',
      deleted_at = NOW()
    WHERE conversation_id IN (
      SELECT id FROM conversations 
      WHERE (fan_id = NEW.id OR creator_id = NEW.id) AND status = 'pending_deletion'
    ) AND status = 'active';
  END IF;
  
  -- When a user is restored from deletion, restore their conversations too
  IF NEW.deletion_status = 'active' AND OLD.deletion_status = 'pending_deletion' THEN
    -- Restore conversations
    UPDATE conversations 
    SET 
      status = 'active',
      deleted_at = NULL,
      deletion_scheduled_for = NULL,
      updated_at = NOW()
    WHERE (fan_id = NEW.id OR creator_id = NEW.id) AND status = 'pending_deletion';
    
    -- Restore messages in those conversations
    UPDATE messages 
    SET 
      status = 'active',
      deleted_at = NULL
    WHERE conversation_id IN (
      SELECT id FROM conversations 
      WHERE (fan_id = NEW.id OR creator_id = NEW.id) AND status = 'active'
    ) AND status = 'pending_deletion';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Update the permanently delete expired conversations function
CREATE OR REPLACE FUNCTION public.permanently_delete_expired_conversations()
RETURNS JSON AS $$
DECLARE
  deleted_count INTEGER := 0;
BEGIN
  -- Delete messages from expired conversations
  DELETE FROM messages 
  WHERE status = 'pending_deletion' 
  AND conversation_id IN (
    SELECT id FROM conversations 
    WHERE status = 'pending_deletion' 
    AND deletion_scheduled_for <= NOW()
  );
  
  -- Delete expired conversations
  DELETE FROM conversations 
  WHERE status = 'pending_deletion' 
  AND deletion_scheduled_for <= NOW();
  
  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  
  RETURN json_build_object(
    'success', true,
    'deleted_conversations', deleted_count,
    'message', format('Permanently deleted %s conversations and their messages', deleted_count)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;