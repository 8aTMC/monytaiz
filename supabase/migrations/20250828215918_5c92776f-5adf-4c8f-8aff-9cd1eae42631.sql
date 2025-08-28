-- Add new metadata fields to simple_media table
ALTER TABLE public.simple_media
ADD COLUMN IF NOT EXISTS mentions text[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS suggested_price_cents integer DEFAULT 0;

-- Update the description column to have a 300 character limit
ALTER TABLE public.simple_media 
ALTER COLUMN description TYPE varchar(300);