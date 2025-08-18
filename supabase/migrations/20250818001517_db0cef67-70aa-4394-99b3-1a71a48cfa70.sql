-- Update content_files table for enhanced upload system
ALTER TABLE public.content_files 
ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS mime_type TEXT,
ADD COLUMN IF NOT EXISTS original_filename TEXT,
ADD COLUMN IF NOT EXISTS watermark_data JSONB;

-- Create file_folders table for custom tagging system
CREATE TABLE IF NOT EXISTS public.file_folders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3B82F6',
  creator_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on file_folders
ALTER TABLE public.file_folders ENABLE ROW LEVEL SECURITY;

-- Create policies for file_folders
CREATE POLICY "Users can manage their own folders" 
ON public.file_folders 
FOR ALL 
USING (creator_id = auth.uid());

-- Create upload_sessions table for tracking batch uploads
CREATE TABLE IF NOT EXISTS public.upload_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  total_files INTEGER NOT NULL DEFAULT 0,
  processed_files INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on upload_sessions
ALTER TABLE public.upload_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for upload_sessions
CREATE POLICY "Users can manage their own upload sessions" 
ON public.upload_sessions 
FOR ALL 
USING (user_id = auth.uid());

-- Update files table for enhanced metadata
ALTER TABLE public.files 
ADD COLUMN IF NOT EXISTS processing_status TEXT DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS thumbnail_generated BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS watermark_applied BOOLEAN DEFAULT FALSE;

-- Add trigger for updated_at on new tables
CREATE TRIGGER update_file_folders_updated_at
BEFORE UPDATE ON public.file_folders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_upload_sessions_updated_at
BEFORE UPDATE ON public.upload_sessions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();