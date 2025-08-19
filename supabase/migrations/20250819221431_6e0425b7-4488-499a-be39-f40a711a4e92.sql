-- Create immediate fan deletion function that completely removes a fan user
CREATE OR REPLACE FUNCTION public.immediately_delete_fan_user(target_user_id uuid, admin_reason text DEFAULT NULL::text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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

  -- Check if user exists and is a fan
  IF NOT EXISTS (
    SELECT 1 FROM profiles p
    JOIN user_roles ur ON p.id = ur.user_id 
    WHERE p.id = target_user_id 
    AND ur.role = 'fan'
  ) THEN
    RAISE EXCEPTION 'User does not exist or is not a fan';
  END IF;

  -- Delete user's content files
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

  -- Delete messages and conversations
  DELETE FROM messages WHERE sender_id = target_user_id;
  DELETE FROM conversations WHERE fan_id = target_user_id OR creator_id = target_user_id;

  -- Delete user notes
  DELETE FROM user_notes WHERE user_id = target_user_id;

  -- Delete any pending deletion records
  DELETE FROM pending_deletions WHERE user_id = target_user_id;

  -- Delete the profile completely
  DELETE FROM profiles WHERE id = target_user_id;

  -- Add audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    requesting_user_id,
    'immediate_fan_deletion_completed',
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
    'message', 'Fan user permanently deleted immediately',
    'auth_cleanup_needed', true
  );
END;
$function$;