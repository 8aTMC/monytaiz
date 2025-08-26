-- Add missing columns to media table for fast image loading
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS bucket text;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS path text;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS width int;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS height int;
ALTER TABLE public.media ADD COLUMN IF NOT EXISTS tiny_placeholder text;

-- Update bucket for existing records (assuming they use 'content' bucket)
UPDATE public.media SET bucket = 'content' WHERE bucket IS NULL;

-- Copy storage_path to path column for existing records
UPDATE public.media SET path = storage_path WHERE path IS NULL;

-- Make bucket NOT NULL after setting default values
ALTER TABLE public.media ALTER COLUMN bucket SET NOT NULL;

-- Add unique constraint on bucket, path
ALTER TABLE public.media ADD CONSTRAINT unique_bucket_path UNIQUE (bucket, path);