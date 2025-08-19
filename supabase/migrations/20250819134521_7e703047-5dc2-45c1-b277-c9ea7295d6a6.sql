-- Add email_confirmed column to profiles table to track email verification status
ALTER TABLE public.profiles ADD COLUMN email_confirmed boolean DEFAULT false;

-- Update the handle_new_user function to store email confirmation status
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, email, email_confirmed, is_undeletable, provider)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.email,  -- Store email from auth.users
    NEW.email_confirmed_at IS NOT NULL,  -- Store email confirmation status
    FALSE,  -- Never make new users undeletable
    CASE 
      WHEN NEW.raw_user_meta_data ->> 'iss' = 'https://accounts.google.com' THEN 'google'
      WHEN NEW.raw_user_meta_data ->> 'provider_id' IS NOT NULL THEN 'google'
      ELSE 'email'
    END
  );
  
  -- All new sign-ups get fan role ONLY (no more auto-admin)
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan'::app_role);
  
  RETURN NEW;
END;
$function$;