-- Update the user_roles RLS policy to allow owners to manage all user roles
DROP POLICY IF EXISTS "Admins can manage all user roles" ON user_roles;

CREATE POLICY "Admins and owners can manage all user roles" 
ON user_roles 
FOR ALL 
USING (
  has_role(auth.uid(), 'admin'::app_role) OR 
  has_role(auth.uid(), 'owner'::app_role)
);