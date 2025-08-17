-- Create helper functions for hierarchical permissions
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id 
    AND p.name = _permission
  )
$$;

CREATE OR REPLACE FUNCTION public.user_can_manage_role(_user_id uuid, _target_role app_role)
RETURNS boolean  
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur1
    WHERE ur1.user_id = _user_id
    AND ur1.role_level < (
      SELECT MIN(role_level) 
      FROM user_roles ur2 
      WHERE ur2.role = _target_role
    )
  ) OR public.user_has_permission(_user_id, 'manage_all_users')
$$;