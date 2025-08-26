-- Create media table for fast image loading with transforms and placeholders
CREATE TABLE IF NOT EXISTS public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  tiny_placeholder text,  -- base64 data URL
  type text NOT NULL CHECK (type IN ('image', 'video', 'audio')), -- Remove document support
  title text,
  notes text,
  tags text[] DEFAULT '{}',
  suggested_price_cents integer DEFAULT 0,
  creator_id uuid NOT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (bucket, path)
);

-- Enable RLS on media table
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for media table (admin-only access)
CREATE POLICY "Management can manage media" 
ON public.media 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_bucket_path ON public.media (bucket, path);
CREATE INDEX IF NOT EXISTS idx_media_creator_id ON public.media (creator_id);
CREATE INDEX IF NOT EXISTS idx_media_type ON public.media (type);
CREATE INDEX IF NOT EXISTS idx_media_created_at ON public.media (created_at DESC);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_media_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_media_updated_at
  BEFORE UPDATE ON public.media
  FOR EACH ROW
  EXECUTE FUNCTION update_media_updated_at();