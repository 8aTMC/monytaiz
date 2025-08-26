-- Revert content bucket to private for security
UPDATE storage.buckets 
SET public = false 
WHERE id = 'content';

-- Create function to generate secure signed URLs with access control
CREATE OR REPLACE FUNCTION public.get_secure_media_url(media_path text, expires_in_seconds integer DEFAULT 3600)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  media_record record;
  has_access boolean := false;
  signed_url text;
BEGIN
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object('error', 'Authentication required');
  END IF;

  -- Get media record from path
  SELECT m.* INTO media_record 
  FROM media m 
  WHERE m.storage_path = media_path 
  LIMIT 1;

  -- If not found in media table, try content_files
  IF NOT FOUND THEN
    SELECT cf.file_path as storage_path, cf.creator_id, cf.id 
    INTO media_record 
    FROM content_files cf 
    WHERE cf.file_path = media_path 
    LIMIT 1;
  END IF;

  -- Check access permissions
  -- 1. User is management (owner, superadmin, admin, manager, chatter)
  IF EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = current_user_id 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  ) THEN
    has_access := true;
  
  -- 2. User has been granted access to this media
  ELSIF EXISTS (
    SELECT 1 FROM fan_media_grants fmg 
    WHERE fmg.fan_id = current_user_id 
    AND (fmg.media_id::text = media_record.id::text OR fmg.media_id IS NULL)
  ) THEN
    has_access := true;
  
  -- 3. User has purchased access to this content
  ELSIF EXISTS (
    SELECT 1 FROM purchases p 
    WHERE p.buyer_id = current_user_id 
    AND p.content_id::text = media_record.id::text 
    AND p.status = 'completed'
  ) THEN
    has_access := true;
  END IF;

  -- Return error if no access
  IF NOT has_access THEN
    RETURN json_build_object('error', 'Access denied');
  END IF;

  -- Return success with path (signed URL generation will be handled by edge function)
  RETURN json_build_object(
    'success', true,
    'path', media_path,
    'expires_in', expires_in_seconds
  );
END;
$$;