-- Extend media table for optimized media pipeline
ALTER TABLE public.media 
ADD COLUMN IF NOT EXISTS renditions JSONB DEFAULT '{}',  -- {"video_1080": "path", "video_720": "path"}
ADD COLUMN IF NOT EXISTS original_path TEXT,             -- temporary path to original in content/incoming/
ADD COLUMN IF NOT EXISTS processing_status TEXT CHECK (processing_status IN ('queued','processing','done','needs_processing','error')) DEFAULT 'processing';

-- Update RLS to handle both original and processed paths
UPDATE public.media SET processing_status = 'done' WHERE processing_status IS NULL;