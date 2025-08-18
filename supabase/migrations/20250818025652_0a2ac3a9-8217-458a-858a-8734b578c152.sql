-- Update role levels to establish proper hierarchy
-- Owner should be the highest level (lowest number = highest authority)
UPDATE user_roles SET role_level = 0 WHERE role = 'owner';
UPDATE user_roles SET role_level = 1 WHERE role = 'superadmin';
UPDATE user_roles SET role_level = 2 WHERE role = 'admin';
UPDATE user_roles SET role_level = 3 WHERE role = 'manager';
UPDATE user_roles SET role_level = 4 WHERE role = 'moderator';
UPDATE user_roles SET role_level = 5 WHERE role = 'chatter';
UPDATE user_roles SET role_level = 6 WHERE role = 'agency';
UPDATE user_roles SET role_level = 7 WHERE role = 'creator';
UPDATE user_roles SET role_level = 8 WHERE role = 'fan';

-- Create a constraint to ensure only one owner exists
CREATE UNIQUE INDEX CONCURRENTLY idx_single_owner ON user_roles (role) WHERE role = 'owner';

-- Add all permissions to owner role if not already present
INSERT INTO role_permissions (role, permission_id)
SELECT 'owner'::app_role, p.id
FROM permissions p
WHERE NOT EXISTS (
    SELECT 1 FROM role_permissions rp 
    WHERE rp.role = 'owner'::app_role AND rp.permission_id = p.id
);

-- Create a function to ensure owner gets all new permissions automatically
CREATE OR REPLACE FUNCTION ensure_owner_permissions()
RETURNS TRIGGER AS $$
BEGIN
    -- Automatically assign new permissions to owner role
    INSERT INTO role_permissions (role, permission_id)
    VALUES ('owner'::app_role, NEW.id);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to auto-assign permissions to owner
DROP TRIGGER IF EXISTS auto_assign_owner_permissions ON permissions;
CREATE TRIGGER auto_assign_owner_permissions
    AFTER INSERT ON permissions
    FOR EACH ROW
    EXECUTE FUNCTION ensure_owner_permissions();

-- Update the user_can_manage_role function to properly handle owner hierarchy
CREATE OR REPLACE FUNCTION public.user_can_manage_role(_user_id uuid, _target_role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  -- Owner can manage any role
  SELECT EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = _user_id AND ur.role = 'owner'::app_role
  ) OR EXISTS (
    -- Other roles can only manage roles with higher level numbers (lower authority)
    SELECT 1 
    FROM user_roles ur1
    WHERE ur1.user_id = _user_id
    AND ur1.role_level < (
      SELECT MIN(role_level) 
      FROM user_roles ur2 
      WHERE ur2.role = _target_role
    )
  )
$function$;