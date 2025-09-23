-- Update get_management_conversations function to include fan avatar URL
CREATE OR REPLACE FUNCTION public.get_management_conversations()
 RETURNS TABLE(id uuid, fan_id uuid, creator_id uuid, status text, is_active boolean, last_message_at timestamp with time zone, latest_message_content text, latest_message_sender_id uuid, unread_count bigint, created_at timestamp with time zone, updated_at timestamp with time zone, fan_username text, fan_display_name text, fan_category fan_category, fan_avatar_url text, last_message_content text, last_message_sender_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    p.avatar_url as fan_avatar_url,
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
$function$;