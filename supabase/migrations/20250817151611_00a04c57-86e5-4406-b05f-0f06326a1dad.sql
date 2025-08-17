-- Create fan categories enum
CREATE TYPE public.fan_category AS ENUM ('husband', 'boyfriend', 'supporter', 'friend', 'fan');

-- Add fan_category column to profiles table
ALTER TABLE public.profiles 
ADD COLUMN fan_category fan_category DEFAULT 'fan'::fan_category;

-- Create an index for better performance on fan category queries
CREATE INDEX idx_profiles_fan_category ON public.profiles(fan_category);