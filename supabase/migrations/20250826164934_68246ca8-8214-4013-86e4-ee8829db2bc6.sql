-- Create media table for fast image loading with transforms and placeholders
CREATE TABLE public.media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  path text NOT NULL,
  mime text,
  size_bytes bigint,
  width int,
  height int,
  tiny_placeholder text,
  type text NOT NULL CHECK (type IN ('image', 'video', 'audio')),
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
CREATE INDEX idx_media_bucket_path ON public.media (bucket, path);
CREATE INDEX idx_media_creator_id ON public.media (creator_id);
CREATE INDEX idx_media_type ON public.media (type);
CREATE INDEX idx_media_created_at ON public.media (created_at DESC);