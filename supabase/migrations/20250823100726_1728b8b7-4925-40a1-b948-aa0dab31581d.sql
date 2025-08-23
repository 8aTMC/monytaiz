-- Create function to assign initial owner role for bootstrapping
CREATE OR REPLACE FUNCTION public.assign_initial_owner_role()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  current_user_id uuid := auth.uid();
  existing_owners_count integer;
BEGIN
  -- Check if there are already any owners
  SELECT COUNT(*) INTO existing_owners_count
  FROM user_roles 
  WHERE role = 'owner';
  
  -- Only allow this if there are no existing owners (bootstrap scenario)
  IF existing_owners_count > 0 THEN
    RETURN json_build_object(
      'success', false,
      'message', 'Owner role already exists. Cannot assign additional owners through this function.'
    );
  END IF;
  
  -- Check if user is authenticated
  IF current_user_id IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'message', 'User must be authenticated'
    );
  END IF;
  
  -- Assign owner role
  INSERT INTO user_roles (user_id, role, assigned_by, role_level)
  VALUES (current_user_id, 'owner', current_user_id, 1)
  ON CONFLICT (user_id, role) DO NOTHING;
  
  RETURN json_build_object(
    'success', true,
    'message', 'Owner role assigned successfully'
  );
END;
$$;