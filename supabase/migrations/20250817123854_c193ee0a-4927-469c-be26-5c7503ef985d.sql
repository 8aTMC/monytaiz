-- Create the main content bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public) 
VALUES ('content', 'content', false)
ON CONFLICT (id) DO NOTHING;

-- Create files metadata table
CREATE TABLE IF NOT EXISTS public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  file_path text NOT NULL, -- e.g., 'videos/user123/video.mp4'
  file_type text NOT NULL CHECK (file_type IN ('video', 'image', 'audio', 'doc')),
  original_filename text NOT NULL,
  file_size bigint,
  mime_type text,
  title text,
  description text,
  tags text[],
  fan_access_level text DEFAULT 'premium' CHECK (fan_access_level IN ('free', 'premium', 'exclusive')),
  signed_url_expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on files table
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for files table
CREATE POLICY "Creators can manage their own files" 
ON public.files 
FOR ALL 
USING (creator_id = auth.uid());

CREATE POLICY "Files are viewable by authenticated users based on access level" 
ON public.files 
FOR SELECT 
USING (
  is_active = true AND (
    creator_id = auth.uid() OR 
    fan_access_level = 'free' OR
    (fan_access_level IN ('premium', 'exclusive') AND auth.uid() IS NOT NULL)
  )
);

-- Create storage policies for content bucket
CREATE POLICY "Authenticated users can view content based on file metadata" 
ON storage.objects 
FOR SELECT 
USING (
  bucket_id = 'content' AND 
  auth.uid() IS NOT NULL AND
  EXISTS (
    SELECT 1 FROM public.files 
    WHERE file_path = name AND is_active = true
  )
);

CREATE POLICY "Users can upload to their own folder" 
ON storage.objects 
FOR INSERT 
WITH CHECK (
  bucket_id = 'content' AND 
  auth.uid() IS NOT NULL AND
  (
    name LIKE 'videos/' || auth.uid()::text || '/%' OR
    name LIKE 'images/' || auth.uid()::text || '/%' OR  
    name LIKE 'audio/' || auth.uid()::text || '/%' OR
    name LIKE 'docs/' || auth.uid()::text || '/%'
  )
);

CREATE POLICY "Users can update their own files" 
ON storage.objects 
FOR UPDATE 
USING (
  bucket_id = 'content' AND 
  auth.uid() IS NOT NULL AND
  (
    name LIKE 'videos/' || auth.uid()::text || '/%' OR
    name LIKE 'images/' || auth.uid()::text || '/%' OR  
    name LIKE 'audio/' || auth.uid()::text || '/%' OR
    name LIKE 'docs/' || auth.uid()::text || '/%'
  )
);

CREATE POLICY "Users can delete their own files" 
ON storage.objects 
FOR DELETE 
USING (
  bucket_id = 'content' AND 
  auth.uid() IS NOT NULL AND
  (
    name LIKE 'videos/' || auth.uid()::text || '/%' OR
    name LIKE 'images/' || auth.uid()::text || '/%' OR  
    name LIKE 'audio/' || auth.uid()::text || '/%' OR
    name LIKE 'docs/' || auth.uid()::text || '/%'
  )
);

-- Create trigger for updated_at
CREATE TRIGGER update_files_updated_at
  BEFORE UPDATE ON public.files
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_files_creator_id ON public.files(creator_id);
CREATE INDEX idx_files_file_type ON public.files(file_type);
CREATE INDEX idx_files_fan_access_level ON public.files(fan_access_level);
CREATE INDEX idx_files_is_active ON public.files(is_active);
CREATE INDEX idx_files_created_at ON public.files(created_at);