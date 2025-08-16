-- Add admin-specific permissions
INSERT INTO public.permissions (name, description) VALUES
('manage_platform', 'Full platform management access'),
('assign_roles', 'Assign roles to users'),
('delete_users', 'Delete user accounts'),
('view_all_content', 'View all content regardless of permissions'),
('manage_all_negotiations', 'Manage all user negotiations'),
('system_analytics', 'Access system-wide analytics');

-- Assign all permissions to admin role
INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'admin', id FROM public.permissions;

-- Add undeletable flag to profiles table
ALTER TABLE public.profiles ADD COLUMN is_undeletable BOOLEAN DEFAULT FALSE;

-- Create function to prevent deletion of undeletable accounts
CREATE OR REPLACE FUNCTION public.prevent_undeletable_deletion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.is_undeletable = TRUE THEN
    RAISE EXCEPTION 'Cannot delete undeletable admin account';
  END IF;
  RETURN OLD;
END;
$$;

-- Create trigger to prevent deletion
CREATE TRIGGER prevent_undeletable_user_deletion
  BEFORE DELETE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_undeletable_deletion();

-- Update RLS policies to allow admins full access
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can update all profiles" ON public.profiles FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can manage all content" ON public.content_files FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can view all purchases" ON public.purchases FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can view all negotiations" ON public.negotiations FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

CREATE POLICY "Admins can view all audit logs" ON public.audit_logs FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'admin'
  )
);

-- Update the handle_new_user function to assign admin role for the specific email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, is_undeletable)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name',
    CASE WHEN NEW.email = 'admin@8atmc.com' THEN TRUE ELSE FALSE END
  );
  
  -- Assign admin role to the specific admin email, fan role to others
  IF NEW.email = 'admin@8atmc.com' THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'fan');
  END IF;
  
  RETURN NEW;
END;
$$;