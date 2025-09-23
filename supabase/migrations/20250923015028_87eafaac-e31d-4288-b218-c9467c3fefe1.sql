-- Create optimized functions to get conversations with all data in single queries

-- Function for management messages (used by ManagementMessages.tsx)
CREATE OR REPLACE FUNCTION get_management_conversations()
RETURNS TABLE(
  id uuid,
  fan_id uuid,
  creator_id uuid,
  status text,
  is_active boolean,
  last_message_at timestamp with time zone,
  latest_message_content text,
  latest_message_sender_id uuid,
  unread_count bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  fan_username text,
  fan_display_name text,
  fan_category fan_category,
  last_message_content text,
  last_message_sender_id uuid
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    c.id,
    c.fan_id,
    c.creator_id,
    c.status,
    c.is_active,
    c.last_message_at,
    c.latest_message_content,
    c.latest_message_sender_id,
    COALESCE(unread_messages.count, 0) as unread_count,
    c.created_at,
    c.updated_at,
    p.username as fan_username,
    p.display_name as fan_display_name,
    p.fan_category,
    last_msg.content as last_message_content,
    last_msg.sender_id as last_message_sender_id
  FROM conversations c
  LEFT JOIN profiles p ON c.fan_id = p.id
  LEFT JOIN LATERAL (
    SELECT content, sender_id 
    FROM messages 
    WHERE conversation_id = c.id AND status = 'active'
    ORDER BY created_at DESC 
    LIMIT 1
  ) last_msg ON true
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM messages
    WHERE conversation_id = c.id 
      AND status = 'active'
      AND sender_id = c.fan_id
      AND read_by_recipient = false
  ) unread_messages ON true
  WHERE c.is_active = true
  ORDER BY c.last_message_at DESC;
$$;

-- Function for general user conversations (used by MessagesLayout.tsx)
CREATE OR REPLACE FUNCTION get_user_conversations(user_id uuid, is_creator_param boolean)
RETURNS TABLE(
  id uuid,
  fan_id uuid,
  creator_id uuid,
  status text,
  is_active boolean,
  last_message_at timestamp with time zone,
  latest_message_content text,
  latest_message_sender_id uuid,
  unread_count bigint,
  created_at timestamp with time zone,
  updated_at timestamp with time zone,
  partner_username text,
  partner_display_name text,
  partner_fan_category fan_category,
  has_ai_active boolean
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT 
    c.id,
    c.fan_id,
    c.creator_id,
    c.status,
    c.is_active,
    c.last_message_at,
    c.latest_message_content,
    c.latest_message_sender_id,
    COALESCE(unread_messages.count, 0) as unread_count,
    c.created_at,
    c.updated_at,
    p.username as partner_username,
    p.display_name as partner_display_name,
    p.fan_category as partner_fan_category,
    COALESCE(ai_settings.is_ai_enabled, false) as has_ai_active
  FROM conversations c
  LEFT JOIN profiles p ON (
    CASE 
      WHEN is_creator_param THEN p.id = c.fan_id
      ELSE p.id = c.creator_id
    END
  )
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM messages
    WHERE conversation_id = c.id 
      AND status = 'active'
      AND sender_id != user_id
      AND read_by_recipient = false
  ) unread_messages ON true
  LEFT JOIN ai_conversation_settings ai_settings ON ai_settings.conversation_id = c.id
  WHERE c.status = 'active' 
    AND (c.fan_id = user_id OR c.creator_id = user_id)
  ORDER BY c.last_message_at DESC;
$$;