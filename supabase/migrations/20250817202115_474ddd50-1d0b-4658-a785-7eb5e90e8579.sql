-- Add soft deletion fields to profiles table
ALTER TABLE public.profiles 
ADD COLUMN deletion_status text DEFAULT 'active' CHECK (deletion_status IN ('active', 'pending_deletion', 'deleted')),
ADD COLUMN deletion_requested_at timestamp with time zone,
ADD COLUMN deletion_requested_by uuid,
ADD COLUMN deletion_scheduled_for timestamp with time zone,
ADD COLUMN deleted_at timestamp with time zone;

-- Create pending_deletions table to track deletion requests
CREATE TABLE public.pending_deletions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  requested_at timestamp with time zone NOT NULL DEFAULT now(),
  scheduled_for timestamp with time zone NOT NULL DEFAULT (now() + interval '30 days'),
  reason text,
  admin_notes text,
  is_self_requested boolean NOT NULL DEFAULT false,
  restored_at timestamp with time zone,
  restored_by uuid,
  restored_reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on pending_deletions
ALTER TABLE public.pending_deletions ENABLE ROW LEVEL SECURITY;

-- Create policies for pending_deletions table
CREATE POLICY "Admins can manage all deletion requests" 
ON public.pending_deletions 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'owner')
  )
);

CREATE POLICY "Users can view their own deletion requests" 
ON public.pending_deletions 
FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can create their own deletion requests" 
ON public.pending_deletions 
FOR INSERT 
WITH CHECK (user_id = auth.uid() AND is_self_requested = true);

-- Create function to initiate user deletion
CREATE OR REPLACE FUNCTION public.initiate_user_deletion(
  target_user_id uuid,
  deletion_reason text DEFAULT NULL,
  is_self_delete boolean DEFAULT false
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id uuid := auth.uid();
  scheduled_deletion_date timestamp with time zone;
  deletion_record_id uuid;
BEGIN
  -- Check if user can perform this action
  IF is_self_delete THEN
    -- User deleting their own account
    IF requesting_user_id != target_user_id THEN
      RAISE EXCEPTION 'Users can only delete their own accounts';
    END IF;
  ELSE
    -- Admin deleting another user's account
    IF NOT EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = requesting_user_id 
      AND ur.role IN ('admin', 'owner')
    ) THEN
      RAISE EXCEPTION 'Only admins can delete other users accounts';
    END IF;
  END IF;

  -- Check if user is already pending deletion
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_user_id 
    AND deletion_status = 'pending_deletion'
  ) THEN
    RAISE EXCEPTION 'User is already pending deletion';
  END IF;

  -- Calculate scheduled deletion date (30 days from now)
  scheduled_deletion_date := now() + interval '30 days';

  -- Update profile to pending deletion status
  UPDATE profiles 
  SET 
    deletion_status = 'pending_deletion',
    deletion_requested_at = now(),
    deletion_requested_by = requesting_user_id,
    deletion_scheduled_for = scheduled_deletion_date,
    updated_at = now()
  WHERE id = target_user_id;

  -- Create pending deletion record
  INSERT INTO pending_deletions (
    user_id,
    requested_by,
    scheduled_for,
    reason,
    is_self_requested
  ) VALUES (
    target_user_id,
    requesting_user_id,
    scheduled_deletion_date,
    deletion_reason,
    is_self_delete
  ) RETURNING id INTO deletion_record_id;

  -- Mark all user's content as pending deletion
  UPDATE content_files 
  SET is_active = false, updated_at = now()
  WHERE creator_id = target_user_id;

  UPDATE files 
  SET is_active = false, updated_at = now()
  WHERE creator_id = target_user_id;

  -- Add audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    requesting_user_id,
    CASE WHEN is_self_delete THEN 'user_self_deletion_initiated' ELSE 'user_deletion_initiated' END,
    'user',
    target_user_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'scheduled_for', scheduled_deletion_date,
      'reason', deletion_reason,
      'is_self_requested', is_self_delete
    )
  );

  RETURN json_build_object(
    'success', true,
    'deletion_id', deletion_record_id,
    'scheduled_for', scheduled_deletion_date,
    'message', 'User deletion initiated successfully'
  );
END;
$$;

-- Create function to restore user from pending deletion
CREATE OR REPLACE FUNCTION public.restore_user_from_deletion(
  target_user_id uuid,
  restoration_reason text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requesting_user_id uuid := auth.uid();
  deletion_record_id uuid;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = requesting_user_id 
    AND ur.role IN ('admin', 'owner')
  ) THEN
    RAISE EXCEPTION 'Only admins can restore users from deletion';
  END IF;

  -- Check if user is actually pending deletion
  IF NOT EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = target_user_id 
    AND deletion_status = 'pending_deletion'
  ) THEN
    RAISE EXCEPTION 'User is not pending deletion';
  END IF;

  -- Get the pending deletion record
  SELECT id INTO deletion_record_id
  FROM pending_deletions 
  WHERE user_id = target_user_id 
  AND restored_at IS NULL;

  IF deletion_record_id IS NULL THEN
    RAISE EXCEPTION 'No pending deletion record found';
  END IF;

  -- Restore profile status
  UPDATE profiles 
  SET 
    deletion_status = 'active',
    deletion_requested_at = NULL,
    deletion_requested_by = NULL,
    deletion_scheduled_for = NULL,
    updated_at = now()
  WHERE id = target_user_id;

  -- Mark pending deletion as restored
  UPDATE pending_deletions 
  SET 
    restored_at = now(),
    restored_by = requesting_user_id,
    restored_reason = restoration_reason,
    updated_at = now()
  WHERE id = deletion_record_id;

  -- Restore user's content
  UPDATE content_files 
  SET is_active = true, updated_at = now()
  WHERE creator_id = target_user_id;

  UPDATE files 
  SET is_active = true, updated_at = now()
  WHERE creator_id = target_user_id;

  -- Add audit log entry
  INSERT INTO audit_logs (
    user_id,
    action,
    resource_type,
    resource_id,
    metadata
  ) VALUES (
    requesting_user_id,
    'user_restoration_completed',
    'user',
    target_user_id,
    jsonb_build_object(
      'target_user_id', target_user_id,
      'restoration_reason', restoration_reason,
      'restored_by', requesting_user_id
    )
  );

  RETURN json_build_object(
    'success', true,
    'message', 'User restored successfully'
  );
END;
$$;

-- Create function to permanently delete expired users
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

-- Update RLS policies for profiles to account for deletion status
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

CREATE POLICY "Active profiles are viewable by everyone" 
ON public.profiles 
FOR SELECT 
USING (deletion_status = 'active');

CREATE POLICY "Admins can view all profiles including deleted" 
ON public.profiles 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('admin', 'owner')
  )
);

-- Prevent login for users pending deletion by updating the handle_new_user function
CREATE OR REPLACE FUNCTION public.check_user_deletion_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Check if user is pending deletion or deleted
  IF EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = NEW.id 
    AND deletion_status IN ('pending_deletion', 'deleted')
  ) THEN
    RAISE EXCEPTION 'Account is scheduled for deletion and cannot be accessed';
  END IF;
  
  RETURN NEW;
END;
$$;

-- Add trigger to check deletion status on auth events
-- Note: This would ideally be on auth.users but we can't modify that table
-- Instead, we'll handle this in the application layer

-- Create indexes for performance
CREATE INDEX idx_profiles_deletion_status ON public.profiles(deletion_status);
CREATE INDEX idx_pending_deletions_scheduled_for ON public.pending_deletions(scheduled_for);
CREATE INDEX idx_pending_deletions_user_id ON public.pending_deletions(user_id);

-- Add trigger for updating timestamps
CREATE TRIGGER update_pending_deletions_updated_at
  BEFORE UPDATE ON public.pending_deletions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();