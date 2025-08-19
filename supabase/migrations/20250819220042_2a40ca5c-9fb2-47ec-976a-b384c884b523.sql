-- Fix the handle_new_user function to properly handle Google users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  is_google_provider boolean;
  temp_username_val text;
  existing_profile profiles%ROWTYPE;
  should_complete_signup boolean;
BEGIN
  -- Check if this is a Google provider
  is_google_provider := (
    NEW.raw_user_meta_data ->> 'iss' = 'https://accounts.google.com' 
    OR NEW.raw_user_meta_data ->> 'provider_id' IS NOT NULL
    OR NEW.app_metadata ->> 'provider' = 'google'
  );
  
  -- Check if profile already exists with this email
  SELECT * INTO existing_profile
  FROM profiles 
  WHERE email = NEW.email;
  
  -- If profile exists and this is Google login, update verification status
  IF existing_profile.id IS NOT NULL AND is_google_provider THEN
    UPDATE profiles 
    SET 
      email_confirmed = true,
      google_verified = true,
      updated_at = now()
    WHERE email = NEW.email;
    
    -- Don't insert a new profile, just return
    RETURN NEW;
  END IF;
  
  -- For Google users, check if they have complete profile data
  should_complete_signup := NOT is_google_provider OR (
    NEW.raw_user_meta_data ->> 'full_name' IS NOT NULL AND
    NEW.raw_user_meta_data ->> 'name' IS NOT NULL
  );
  
  -- Generate temp username if this is a Google user without complete data
  IF is_google_provider AND NOT should_complete_signup THEN
    temp_username_val := generate_temp_username();
  ELSE
    temp_username_val := COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      NEW.raw_user_meta_data ->> 'preferred_username',
      split_part(NEW.email, '@', 1)
    );
  END IF;
  
  -- Insert new profile
  INSERT INTO public.profiles (
    id, 
    username, 
    display_name, 
    email, 
    email_confirmed, 
    is_undeletable, 
    provider,
    signup_completed,
    google_verified,
    temp_username
  )
  VALUES (
    NEW.id,
    temp_username_val,
    COALESCE(
      NEW.raw_user_meta_data ->> 'full_name',
      NEW.raw_user_meta_data ->> 'name',
      split_part(NEW.email, '@', 1)
    ),
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL OR is_google_provider,
    FALSE,
    CASE 
      WHEN is_google_provider THEN 'google'
      ELSE 'email'
    END,
    should_complete_signup, -- This will be true for Google users with complete data
    is_google_provider,
    NOT should_complete_signup -- This will be true only if signup is not complete
  );
  
  -- All new sign-ups get fan role ONLY
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan'::app_role);
  
  RETURN NEW;
END;
$$;