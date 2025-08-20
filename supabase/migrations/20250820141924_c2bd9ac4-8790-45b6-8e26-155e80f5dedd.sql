-- Function to ensure all fans have conversations with creators/management
CREATE OR REPLACE FUNCTION public.ensure_fan_conversations()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  management_user_id UUID;
  conversation_id UUID;
BEGIN
  -- Only process when a user gets the 'fan' role
  IF NEW.role = 'fan' THEN
    -- Get the primary creator/management user (owner, superadmin, admin, creator)
    SELECT ur.user_id INTO management_user_id
    FROM user_roles ur
    WHERE ur.role IN ('owner', 'superadmin', 'admin', 'creator')
    ORDER BY 
      CASE ur.role 
        WHEN 'owner' THEN 1
        WHEN 'superadmin' THEN 2  
        WHEN 'admin' THEN 3
        WHEN 'creator' THEN 4
      END
    LIMIT 1;

    -- Only proceed if we found a management user
    IF management_user_id IS NOT NULL THEN
      -- Check if conversation already exists
      SELECT id INTO conversation_id
      FROM conversations 
      WHERE fan_id = NEW.user_id 
      AND creator_id = management_user_id 
      AND status = 'active';
      
      -- Create conversation if it doesn't exist
      IF conversation_id IS NULL THEN
        INSERT INTO conversations (fan_id, creator_id, status)
        VALUES (NEW.user_id, management_user_id, 'active')
        RETURNING id INTO conversation_id;
        
        -- Send welcome message
        INSERT INTO messages (conversation_id, sender_id, content, is_system_message, status)
        VALUES (
          conversation_id, 
          management_user_id, 
          'Welcome! Thanks for joining us. Feel free to reach out if you have any questions or need assistance. We''re here to help!',
          TRUE, 
          'active'
        );
        
        -- Update conversation last message timestamp
        UPDATE conversations 
        SET last_message_at = NOW(), updated_at = NOW()
        WHERE id = conversation_id;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to auto-create conversations when users get fan role
DROP TRIGGER IF EXISTS ensure_fan_conversations_trigger ON user_roles;
CREATE TRIGGER ensure_fan_conversations_trigger
  AFTER INSERT ON user_roles
  FOR EACH ROW
  EXECUTE FUNCTION ensure_fan_conversations();

-- Function to create conversations for all existing fans
CREATE OR REPLACE FUNCTION public.create_conversations_for_existing_fans()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  management_user_id UUID;
  fan_record RECORD;
  conversation_id UUID;
  created_count INTEGER := 0;
BEGIN
  -- Get the primary creator/management user
  SELECT ur.user_id INTO management_user_id
  FROM user_roles ur
  WHERE ur.role IN ('owner', 'superadmin', 'admin', 'creator')
  ORDER BY 
    CASE ur.role 
      WHEN 'owner' THEN 1
      WHEN 'superadmin' THEN 2  
      WHEN 'admin' THEN 3
      WHEN 'creator' THEN 4
    END
  LIMIT 1;

  IF management_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'No management user found'
    );
  END IF;

  -- Loop through all fans who don't have conversations with the management user
  FOR fan_record IN 
    SELECT ur.user_id as fan_id
    FROM user_roles ur
    LEFT JOIN profiles p ON ur.user_id = p.id
    WHERE ur.role = 'fan' 
    AND p.deletion_status = 'active'
    AND NOT EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.fan_id = ur.user_id 
      AND c.creator_id = management_user_id 
      AND c.status = 'active'
    )
  LOOP
    -- Create conversation
    INSERT INTO conversations (fan_id, creator_id, status)
    VALUES (fan_record.fan_id, management_user_id, 'active')
    RETURNING id INTO conversation_id;
    
    -- Send welcome message
    INSERT INTO messages (conversation_id, sender_id, content, is_system_message, status)
    VALUES (
      conversation_id, 
      management_user_id, 
      'Welcome! Thanks for joining us. Feel free to reach out if you have any questions or need assistance. We''re here to help!',
      TRUE, 
      'active'
    );
    
    -- Update conversation last message timestamp
    UPDATE conversations 
    SET last_message_at = NOW(), updated_at = NOW()
    WHERE id = conversation_id;
    
    created_count := created_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'created_count', created_count,
    'message', format('Created %s conversations for existing fans', created_count)
  );
END;
$$;

-- Run the function to create conversations for all existing fans
SELECT create_conversations_for_existing_fans();