-- Update RLS policies to handle status filtering for conversations and messages

-- Update conversations RLS policies to filter by status
DROP POLICY IF EXISTS "Users can view conversations they're part of" ON conversations;
CREATE POLICY "Users can view conversations they're part of" 
ON conversations 
FOR SELECT 
USING (
  status = 'active' AND (
    (auth.uid() = fan_id) OR 
    (auth.uid() = creator_id) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'owner'::app_role])
    ))
  )
);

-- Update messages RLS policies to filter by status
DROP POLICY IF EXISTS "Users can view messages in their conversations" ON messages;
CREATE POLICY "Users can view messages in their conversations" 
ON messages 
FOR SELECT 
USING (
  status = 'active' AND (
    (EXISTS (
      SELECT 1 FROM conversations c 
      WHERE c.id = messages.conversation_id 
      AND c.status = 'active'
      AND ((c.fan_id = auth.uid()) OR (c.creator_id = auth.uid()))
    )) OR 
    (EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = ANY (ARRAY['admin'::app_role, 'owner'::app_role])
    ))
  )
);

-- Update messages insert policy to ensure status is set correctly
DROP POLICY IF EXISTS "Users can create messages in their conversations" ON messages;
CREATE POLICY "Users can create messages in their conversations" 
ON messages 
FOR INSERT 
WITH CHECK (
  auth.uid() = sender_id AND 
  status = 'active' AND
  (EXISTS (
    SELECT 1 FROM conversations c 
    WHERE c.id = messages.conversation_id 
    AND c.status = 'active'
    AND ((c.fan_id = auth.uid()) OR (c.creator_id = auth.uid()))
  ))
);

-- Create policy for conversations insert with status check
DROP POLICY IF EXISTS "Fans can create conversations with creators" ON conversations;
CREATE POLICY "Fans can create conversations with creators" 
ON conversations 
FOR INSERT 
WITH CHECK (
  auth.uid() = fan_id AND 
  status = 'active' AND
  (EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = conversations.creator_id 
    AND ur.role = ANY (ARRAY['owner'::app_role, 'creator'::app_role, 'superadmin'::app_role, 'admin'::app_role])
  ))
);

-- Update the cleanup expired users function to also clean up conversations
CREATE OR REPLACE FUNCTION public.permanently_delete_expired_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_user_ids uuid[];
  user_id uuid;
  deletion_count integer := 0;
  conversations_deleted integer := 0;
BEGIN
  -- Get users whose deletion period has expired
  SELECT array_agg(p.id)
  INTO expired_user_ids
  FROM profiles p
  JOIN pending_deletions pd ON p.id = pd.user_id
  WHERE p.deletion_status = 'pending_deletion'
    AND pd.scheduled_for <= now()
    AND pd.restored_at IS NULL;

  IF expired_user_ids IS NULL THEN
    RETURN json_build_object(
      'success', true,
      'deleted_count', 0,
      'conversations_deleted', 0,
      'message', 'No expired users found'
    );
  END IF;

  -- Process each expired user
  FOREACH user_id IN ARRAY expired_user_ids
  LOOP
    -- Delete expired conversations and messages for this user
    DELETE FROM messages 
    WHERE status = 'pending_deletion' 
    AND conversation_id IN (
      SELECT id FROM conversations 
      WHERE (fan_id = user_id OR creator_id = user_id)
      AND status = 'pending_deletion' 
      AND deletion_scheduled_for <= now()
    );
    
    DELETE FROM conversations 
    WHERE (fan_id = user_id OR creator_id = user_id)
    AND status = 'pending_deletion' 
    AND deletion_scheduled_for <= now();

    GET DIAGNOSTICS conversations_deleted = conversations_deleted + ROW_COUNT;

    -- Anonymize audit logs (keep for compliance but remove personal info)
    UPDATE audit_logs 
    SET 
      user_id = NULL,
      metadata = CASE 
        WHEN metadata IS NOT NULL THEN 
          metadata || jsonb_build_object('anonymized_at', now())
        ELSE 
          jsonb_build_object('anonymized_at', now())
      END
    WHERE user_id = user_id;

    -- Delete user's content files from storage and database
    DELETE FROM content_files WHERE creator_id = user_id;
    DELETE FROM files WHERE creator_id = user_id;

    -- Delete user purchases and negotiations
    DELETE FROM purchases WHERE buyer_id = user_id OR seller_id = user_id;
    DELETE FROM negotiations WHERE buyer_id = user_id OR seller_id = user_id;

    -- Delete user's file folders
    DELETE FROM file_folders WHERE creator_id = user_id;

    -- Delete user's upload sessions
    DELETE FROM upload_sessions WHERE user_id = user_id;

    -- Delete user roles
    DELETE FROM user_roles WHERE user_id = user_id;

    -- Delete the profile completely (not just mark as deleted)
    DELETE FROM profiles WHERE id = user_id;

    -- Mark pending deletion as completed
    UPDATE pending_deletions 
    SET updated_at = now()
    WHERE user_id = user_id AND restored_at IS NULL;

    deletion_count := deletion_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'deleted_count', deletion_count,
    'conversations_deleted', conversations_deleted,
    'message', format('Permanently deleted %s users and %s conversations - auth cleanup needed', deletion_count, conversations_deleted),
    'auth_cleanup_needed', true,
    'deleted_user_ids', expired_user_ids
  );
END;
$$;