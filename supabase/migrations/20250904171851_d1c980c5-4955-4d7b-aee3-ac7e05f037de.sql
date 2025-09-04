-- Add revenue tracking column to simple_media table
ALTER TABLE public.simple_media 
ADD COLUMN revenue_generated_cents INTEGER DEFAULT 0;