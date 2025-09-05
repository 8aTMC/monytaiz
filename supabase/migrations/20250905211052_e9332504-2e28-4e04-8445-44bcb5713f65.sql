-- Add quality_info column to simple_media table to store quality variants
ALTER TABLE simple_media 
ADD COLUMN quality_info JSONB DEFAULT '{}';

-- Create quality_metadata table for detailed quality tracking
CREATE TABLE quality_metadata (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id UUID NOT NULL REFERENCES simple_media(id) ON DELETE CASCADE,
  quality TEXT NOT NULL, -- '360p', '480p', '720p', '1080p', etc.
  width INTEGER,
  height INTEGER,
  bitrate_kbps INTEGER,
  file_size_bytes BIGINT,
  storage_path TEXT NOT NULL,
  processing_time_seconds INTEGER,
  compression_ratio NUMERIC(5,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(media_id, quality)
);

-- Enable RLS on quality_metadata table
ALTER TABLE quality_metadata ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for quality_metadata (same access as simple_media)
CREATE POLICY "Management can manage quality metadata" 
ON quality_metadata 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
  )
);

CREATE POLICY "Fans can view quality metadata for processed media" 
ON quality_metadata 
FOR SELECT 
USING (
  EXISTS (
    SELECT 1 FROM simple_media sm 
    WHERE sm.id = quality_metadata.media_id 
    AND sm.processing_status = 'processed'
  ) 
  AND EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role = 'fan'
  )
);

-- Add indexes for performance
CREATE INDEX idx_simple_media_quality_info ON simple_media USING GIN (quality_info);
CREATE INDEX idx_quality_metadata_media_id ON quality_metadata (media_id);
CREATE INDEX idx_quality_metadata_quality ON quality_metadata (quality);
CREATE INDEX idx_quality_metadata_media_quality ON quality_metadata (media_id, quality);

-- Add trigger for quality_metadata updated_at
CREATE TRIGGER update_quality_metadata_updated_at
  BEFORE UPDATE ON quality_metadata
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Add comment for documentation
COMMENT ON COLUMN simple_media.quality_info IS 'JSON object storing available quality variants: {"360p": {"width": 640, "height": 360, "path": "..."}, ...}';
COMMENT ON TABLE quality_metadata IS 'Detailed metadata for each quality variant of media files';