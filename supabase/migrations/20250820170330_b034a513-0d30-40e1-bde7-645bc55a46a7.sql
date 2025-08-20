-- Fix security warnings by setting proper search_path for functions
CREATE OR REPLACE FUNCTION update_conversation_on_message()
RETURNS TRIGGER AS $$
BEGIN
  -- Update conversation with latest message info and increment unread count for recipient
  UPDATE conversations 
  SET 
    last_message_at = NEW.created_at,
    latest_message_content = NEW.content,
    latest_message_sender_id = NEW.sender_id,
    unread_count = CASE 
      WHEN NEW.sender_id = fan_id THEN unread_count + 1 
      WHEN NEW.sender_id = creator_id THEN unread_count + 1 
      ELSE unread_count 
    END,
    updated_at = now()
  WHERE id = NEW.conversation_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION mark_conversation_as_read(conv_id uuid, reader_user_id uuid)
RETURNS void AS $$
BEGIN
  -- Mark all unread messages as read for this user
  UPDATE messages 
  SET 
    read_by_recipient = true,
    read_at = now()
  WHERE conversation_id = conv_id 
    AND sender_id != reader_user_id 
    AND read_by_recipient = false;
    
  -- Reset unread count for this conversation
  UPDATE conversations 
  SET unread_count = 0
  WHERE id = conv_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';

CREATE OR REPLACE FUNCTION mark_message_delivered(message_id uuid)
RETURNS void AS $$
BEGIN
  UPDATE messages 
  SET delivered_at = now()
  WHERE id = message_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = 'public';