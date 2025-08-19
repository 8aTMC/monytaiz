-- Update the handle_new_user function to ensure it stores email properly
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