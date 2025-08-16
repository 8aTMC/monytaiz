-- First, let's check and fix the user roles policies to prevent infinite recursion
-- Drop the problematic policies that cause infinite recursion
DROP POLICY IF EXISTS "Creators can manage roles" ON public.user_roles;

-- Create a proper security definer function to check roles without recursion
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create better policies using the security definer function
CREATE POLICY "Admins can manage all user roles" 
ON public.user_roles 
FOR ALL 
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Update the user creation trigger to only assign fan role
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
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
    FALSE  -- Never make new users undeletable
  );
  
  -- All new sign-ups get fan role ONLY (no more auto-admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan'::app_role);
  
  RETURN NEW;
END;
$$;