-- Add pending email functionality to profiles table
ALTER TABLE public.profiles 
ADD COLUMN pending_email text,
ADD COLUMN pending_email_token text,
ADD COLUMN pending_email_requested_at timestamp with time zone;