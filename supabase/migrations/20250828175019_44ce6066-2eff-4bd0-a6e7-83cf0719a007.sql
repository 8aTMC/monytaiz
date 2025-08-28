-- Create new simplified media table
CREATE TABLE IF NOT EXISTS public.simple_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  original_filename TEXT NOT NULL,
  title TEXT,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  
  -- File metadata
  mime_type TEXT NOT NULL,
  original_size_bytes BIGINT NOT NULL,
  optimized_size_bytes BIGINT,
  
  -- Processing paths
  original_path TEXT NOT NULL, -- incoming/{temp-id}
  processed_path TEXT, -- processed/{file-id}.webp
  thumbnail_path TEXT, -- processed/thumbs/{file-id}.webp
  
  -- Processing status
  processing_status TEXT DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
  processing_error TEXT,
  
  -- Media properties
  media_type TEXT NOT NULL CHECK (media_type IN ('image', 'video', 'audio')),
  width INTEGER,
  height INTEGER,
  duration_seconds INTEGER,
  
  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  processed_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.simple_media ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Management can manage all media"
ON public.simple_media FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

CREATE POLICY "Fans can view processed media"
ON public.simple_media FOR SELECT
USING (
  processing_status = 'processed' AND (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'fan'
    )
  )
);

-- Indexes for performance
CREATE INDEX idx_simple_media_creator_id ON public.simple_media(creator_id);
CREATE INDEX idx_simple_media_processing_status ON public.simple_media(processing_status);
CREATE INDEX idx_simple_media_media_type ON public.simple_media(media_type);
CREATE INDEX idx_simple_media_created_at ON public.simple_media(created_at DESC);

-- Update trigger
CREATE TRIGGER update_simple_media_updated_at
  BEFORE UPDATE ON public.simple_media
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();