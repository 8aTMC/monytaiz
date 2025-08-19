-- Update the user creation trigger to handle Google users and verification scenarios
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  is_google_provider boolean;
  temp_username_val text;
  existing_profile profiles%ROWTYPE;
BEGIN
  -- Check if this is a Google provider
  is_google_provider := (
    NEW.raw_user_meta_data ->> 'iss' = 'https://accounts.google.com' 
    OR NEW.raw_user_meta_data ->> 'provider_id' IS NOT NULL
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
  
  -- Generate temp username if this is a Google user without complete data
  IF is_google_provider AND (
    NEW.raw_user_meta_data ->> 'username' IS NULL OR 
    NEW.raw_user_meta_data ->> 'display_name' IS NULL
  ) THEN
    temp_username_val := generate_temp_username();
  ELSE
    temp_username_val := NEW.raw_user_meta_data ->> 'username';
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
    NEW.raw_user_meta_data ->> 'display_name',
    NEW.email,
    NEW.email_confirmed_at IS NOT NULL OR is_google_provider,
    FALSE,
    CASE 
      WHEN is_google_provider THEN 'google'
      ELSE 'email'
    END,
    CASE 
      WHEN is_google_provider AND (
        NEW.raw_user_meta_data ->> 'username' IS NULL OR 
        NEW.raw_user_meta_data ->> 'display_name' IS NULL
      ) THEN false
      ELSE true
    END,
    is_google_provider,
    CASE 
      WHEN is_google_provider AND (
        NEW.raw_user_meta_data ->> 'username' IS NULL OR 
        NEW.raw_user_meta_data ->> 'display_name' IS NULL
      ) THEN true
      ELSE false
    END
  );
  
  -- All new sign-ups get fan role ONLY
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan'::app_role);
  
  RETURN NEW;
END;
$$;