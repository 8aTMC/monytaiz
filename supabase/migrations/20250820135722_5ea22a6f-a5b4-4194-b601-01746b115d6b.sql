-- Fix the permanently delete expired users function with correct syntax

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
  temp_count integer := 0;
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

    GET DIAGNOSTICS temp_count = ROW_COUNT;
    conversations_deleted := conversations_deleted + temp_count;

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