-- Update the handle_new_user function to only create fan accounts
-- Admin accounts will be created through admin dashboard
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, is_undeletable)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name',
    FALSE  -- No more automatic undeletable accounts
  );
  
  -- All new sign-ups get fan role only
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan');
  
  RETURN NEW;
END;
$$;