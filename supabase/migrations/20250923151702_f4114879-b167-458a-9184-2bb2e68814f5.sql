-- Update get_user_conversations to include has_ai_active field
DROP FUNCTION IF EXISTS public.get_user_conversations(uuid, boolean);

CREATE OR REPLACE FUNCTION public.get_user_conversations(user_id uuid, is_creator_param boolean)
 RETURNS TABLE(id uuid, fan_id uuid, creator_id uuid, status text, is_active boolean, last_message_at timestamp with time zone, latest_message_content text, latest_message_sender_id uuid, unread_count bigint, created_at timestamp with time zone, updated_at timestamp with time zone, partner_username text, partner_display_name text, partner_fan_category fan_category, partner_avatar_url text, has_ai_active boolean)
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
    CASE 
      WHEN is_creator_param THEN p.username
      ELSE creator_profile.username 
    END as partner_username,
    CASE 
      WHEN is_creator_param THEN p.display_name
      ELSE creator_profile.display_name 
    END as partner_display_name,
    CASE 
      WHEN is_creator_param THEN p.fan_category
      ELSE creator_profile.fan_category 
    END as partner_fan_category,
    CASE 
      WHEN is_creator_param THEN p.avatar_url
      ELSE creator_profile.avatar_url 
    END as partner_avatar_url,
    COALESCE(acs.is_ai_enabled, false) as has_ai_active
  FROM conversations c
  LEFT JOIN profiles p ON c.fan_id = p.id
  LEFT JOIN profiles creator_profile ON c.creator_id = creator_profile.id
  LEFT JOIN ai_conversation_settings acs ON c.id = acs.conversation_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) as count
    FROM messages
    WHERE conversation_id = c.id 
      AND status = 'active'
      AND sender_id = CASE 
        WHEN is_creator_param THEN c.fan_id 
        ELSE c.creator_id 
      END
      AND read_by_recipient = false
  ) unread_messages ON true
  WHERE c.is_active = true
    AND CASE 
      WHEN is_creator_param THEN c.creator_id = user_id
      ELSE c.fan_id = user_id 
    END
  ORDER BY c.last_message_at DESC;
$function$;