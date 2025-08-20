-- Create or update the trigger to update conversation timestamps when messages are added
CREATE OR REPLACE FUNCTION public.update_conversation_timestamp()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Update the conversation's last_message_at when a new message is added
  UPDATE conversations 
  SET 
    last_message_at = NEW.created_at,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_conversation_on_message ON messages;

-- Create trigger that fires after INSERT on messages
CREATE TRIGGER update_conversation_on_message
  AFTER INSERT ON messages
  FOR EACH ROW
  EXECUTE FUNCTION update_conversation_timestamp();