-- Update the immediately_delete_user function to remove references to non-existent chat tables
CREATE OR REPLACE FUNCTION public.immediately_delete_user(target_user_id uuid, admin_reason text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  requesting_user_id uuid := auth.uid();
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = requesting_user_id 
    AND ur.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Only admins can immediately delete users';
  END IF;

  -- Check if user exists and is pending deletion
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_user_id 
    AND deletion_status = 'pending_deletion'
  ) THEN
    RAISE EXCEPTION 'User is not pending deletion or does not exist';
  END IF;

  -- Anonymize audit logs (keep for compliance but remove personal info)
  UPDATE audit_logs 
  SET 
    user_id = NULL,
    metadata = CASE 
      WHEN metadata IS NOT NULL THEN 
        metadata || jsonb_build_object('anonymized_at', now(), 'immediate_deletion_reason', admin_reason)
      ELSE 
        jsonb_build_object('anonymized_at', now(), 'immediate_deletion_reason', admin_reason)
    END
  WHERE user_id = target_user_id;

  -- Delete user's content files from storage and database
  DELETE FROM content_files WHERE creator_id = target_user_id;
  DELETE FROM files WHERE creator_id = target_user_id;

  -- Delete user purchases and negotiations
  DELETE FROM purchases WHERE buyer_id = target_user_id OR seller_id = target_user_id;
  DELETE FROM negotiations WHERE buyer_id = target_user_id OR seller_id = target_user_id;

  -- Delete user's file folders
  DELETE FROM file_folders WHERE creator_id = target_user_id;

  -- Delete user's upload sessions
  DELETE FROM upload_sessions WHERE user_id = target_user_id;

  -- Delete user roles
  DELETE FROM user_roles WHERE user_id = target_user_id;

  -- Mark profile as permanently deleted and clear personal data
  UPDATE profiles 
  SET 
    deletion_status = 'deleted',
    deleted_at = now(),
    username = NULL,
    display_name = 'Deleted User',
    bio = NULL,
    avatar_url = NULL,
    banner_url = NULL,
    updated_at = now()
  WHERE id = target_user_id;

  -- Mark pending deletion as completed
  UPDATE pending_deletions 
  SET updated_at = now()
  WHERE user_id = target_user_id AND restored_at IS NULL;

  -- Add audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    requesting_user_id,
    'immediate_user_deletion_completed',
    'user',
    target_user_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'deleted_by', requesting_user_id,
      'immediate_deletion_reason', admin_reason
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'User permanently deleted immediately'
  );
END;
$$;

-- Update the permanently_delete_expired_users function to remove references to non-existent chat tables
CREATE OR REPLACE FUNCTION public.permanently_delete_expired_users()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  expired_user_ids uuid[];
  user_id uuid;
  deletion_count integer := 0;
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
      'message', 'No expired users found'
    );
  END IF;

  -- Process each expired user
  FOREACH user_id IN ARRAY expired_user_ids
  LOOP
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

    -- Mark profile as permanently deleted and clear personal data
    UPDATE profiles 
    SET 
      deletion_status = 'deleted',
      deleted_at = now(),
      username = NULL,
      display_name = 'Deleted User',
      bio = NULL,
      avatar_url = NULL,
      banner_url = NULL,
      updated_at = now()
    WHERE id = user_id;

    -- Mark pending deletion as completed
    UPDATE pending_deletions 
    SET updated_at = now()
    WHERE user_id = user_id AND restored_at IS NULL;

    deletion_count := deletion_count + 1;
  END LOOP;

  RETURN json_build_object(
    'success', true,
    'deleted_count', deletion_count,
    'message', format('Permanently deleted %s users', deletion_count)
  );
END;
$$;