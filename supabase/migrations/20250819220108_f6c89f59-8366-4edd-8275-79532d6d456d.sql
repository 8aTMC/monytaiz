-- Fix Chris Evans' record to mark him as completed
UPDATE profiles 
SET 
  signup_completed = true,
  temp_username = false,
  updated_at = now()
WHERE email = 'flor@8atmc.com' AND provider = 'google';