-- Add email column to profiles table
ALTER TABLE public.profiles ADD COLUMN email text;

-- Update the handle_new_user function to store email in profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, username, display_name, email, is_undeletable, provider)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.email,  -- Store email from auth.users
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

-- Create a function to backfill emails for existing users (run this manually if needed)
-- This function would need to be called from an Edge Function with service role access
CREATE OR REPLACE FUNCTION public.sync_user_emails()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- This function serves as a template for syncing emails
  -- It would need to be called from a server-side function with access to auth.users
  RETURN 'Email sync function created. Run from Edge Function with service role access.';
END;
$function$;