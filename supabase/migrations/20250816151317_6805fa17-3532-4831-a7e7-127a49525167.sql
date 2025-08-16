-- Fix function search path issues
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name'
  );
  
  -- Assign default fan role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan');
  
  RETURN NEW;
END;
$$;

-- Add missing RLS policies for permissions and role_permissions tables
CREATE POLICY "Permissions are viewable by authenticated users" ON public.permissions FOR SELECT TO authenticated USING (true);

CREATE POLICY "Role permissions are viewable by authenticated users" ON public.role_permissions FOR SELECT TO authenticated USING (true);