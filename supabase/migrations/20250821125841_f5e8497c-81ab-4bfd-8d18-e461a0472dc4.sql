-- Create edge function trigger for AI auto-responses
-- This will automatically call an edge function when a new message is inserted
-- to handle AI responses independently of the UI

CREATE OR REPLACE FUNCTION public.trigger_ai_response()
RETURNS TRIGGER AS $$
DECLARE
  fan_message boolean;
  conversation_record record;
BEGIN
  -- Only process INSERT events for active messages
  IF TG_OP = 'INSERT' AND NEW.status = 'active' THEN
    
    -- Get conversation details to check if this is a fan message to a creator
    SELECT c.*, p.id as fan_profile_id
    INTO conversation_record
    FROM conversations c
    JOIN profiles p ON c.fan_id = p.id  
    WHERE c.id = NEW.conversation_id;
    
    -- Check if this message is from a fan (sender is fan_id in conversation)
    fan_message := (NEW.sender_id = conversation_record.fan_id);
    
    -- Only trigger AI for fan messages (not creator messages)
    IF fan_message THEN
      -- Call edge function asynchronously to handle AI response
      -- This runs independently of any UI being open
      PERFORM net.http_post(
        url := current_setting('app.supabase_url') || '/functions/v1/xai-chat-assistant',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
        ),
        body := jsonb_build_object(
          'creatorId', conversation_record.creator_id,
          'conversationId', NEW.conversation_id,
          'fanId', conversation_record.fan_id,
          'messageText', NEW.content,
          'messageId', NEW.id
        )
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;