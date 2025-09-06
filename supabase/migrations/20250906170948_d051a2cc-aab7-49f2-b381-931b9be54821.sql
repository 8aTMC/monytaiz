-- Add content_hash column to simple_media table for duplicate detection
ALTER TABLE public.simple_media 
ADD COLUMN content_hash text;

-- Create index on content_hash for fast duplicate lookups
CREATE INDEX idx_simple_media_content_hash ON public.simple_media(content_hash) WHERE content_hash IS NOT NULL;

-- Create composite index for fallback duplicate detection (filename + size)
CREATE INDEX idx_simple_media_duplicate_check ON public.simple_media(original_filename, original_size_bytes) WHERE original_filename IS NOT NULL;