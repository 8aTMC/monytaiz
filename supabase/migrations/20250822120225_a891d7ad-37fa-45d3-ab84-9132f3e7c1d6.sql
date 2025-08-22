-- Physical original media (one row per uploaded asset)
CREATE TABLE IF NOT EXISTS media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  origin TEXT NOT NULL CHECK (origin IN ('upload','story','livestream','message')),
  storage_path TEXT NOT NULL UNIQUE,
  mime TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('image','video','audio','document')),
  size_bytes BIGINT NOT NULL,
  sha256 TEXT,
  title TEXT,
  tags TEXT[] DEFAULT '{}',
  suggested_price_cents INTEGER DEFAULT 0,
  notes TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Custom folders (virtual collections)
CREATE TABLE IF NOT EXISTS collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  system BOOLEAN NOT NULL DEFAULT false,
  system_key TEXT UNIQUE,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Links: a media can appear in many custom folders without duplication
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id UUID REFERENCES collections(id) ON DELETE CASCADE,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  added_by UUID NOT NULL,
  added_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (collection_id, media_id)
);

-- Grants (what a fan has access to: purchases or free sends)
CREATE TABLE IF NOT EXISTS fan_media_grants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL,
  fan_id UUID NOT NULL,
  media_id UUID REFERENCES media(id) ON DELETE CASCADE,
  grant_type TEXT NOT NULL CHECK (grant_type IN ('purchase','free')),
  price_cents INTEGER DEFAULT 0,
  granted_by UUID,
  granted_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (fan_id, media_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_media_creator_origin_type_created 
  ON media(creator_id, origin, type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_collection_items_collection 
  ON collection_items(collection_id);
CREATE INDEX IF NOT EXISTS idx_fan_media_grants_fan_creator 
  ON fan_media_grants(fan_id, creator_id, granted_at DESC);
CREATE INDEX IF NOT EXISTS idx_collections_creator 
  ON collections(creator_id, system, created_at DESC);

-- Enable RLS on all tables
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE fan_media_grants ENABLE ROW LEVEL SECURITY;

-- RLS Policies for management roles (creator access)
CREATE POLICY "Management can manage media" ON media
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
    )
  );

CREATE POLICY "Management can manage collections" ON collections
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
    )
  );

CREATE POLICY "Management can manage collection items" ON collection_items
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
    )
  );

CREATE POLICY "Management can manage fan grants" ON fan_media_grants
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
    )
  );

-- RLS Policy for fans to access their granted media
CREATE POLICY "Fans can view their granted media" ON fan_media_grants
  FOR SELECT USING (
    fan_id = auth.uid() AND 
    EXISTS (
      SELECT 1 FROM user_roles ur 
      WHERE ur.user_id = auth.uid() 
      AND ur.role = 'fan'
    )
  );

-- Create view for fan media access
CREATE OR REPLACE VIEW fan_my_media AS
  SELECT 
    m.*,
    g.granted_at,
    g.grant_type,
    g.price_cents
  FROM fan_media_grants g
  JOIN media m ON m.id = g.media_id
  WHERE g.fan_id = auth.uid();

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_media_updated_at 
  BEFORE UPDATE ON media 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_collections_updated_at 
  BEFORE UPDATE ON collections 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert system collections for reference (not used for membership)
INSERT INTO collections (creator_id, name, system, system_key, created_by) 
SELECT 
  ur.user_id,
  'All Files',
  true,
  'all',
  ur.user_id
FROM user_roles ur 
WHERE ur.role IN ('owner', 'superadmin', 'admin') 
ON CONFLICT (system_key) DO NOTHING;

INSERT INTO collections (creator_id, name, system, system_key, created_by) 
SELECT 
  ur.user_id,
  'Stories',
  true,
  'stories', 
  ur.user_id
FROM user_roles ur 
WHERE ur.role IN ('owner', 'superadmin', 'admin')
ON CONFLICT (system_key) DO NOTHING;

INSERT INTO collections (creator_id, name, system, system_key, created_by) 
SELECT 
  ur.user_id,
  'LiveStreams',
  true,
  'livestreams',
  ur.user_id
FROM user_roles ur 
WHERE ur.role IN ('owner', 'superadmin', 'admin')
ON CONFLICT (system_key) DO NOTHING;

INSERT INTO collections (creator_id, name, system, system_key, created_by) 
SELECT 
  ur.user_id,
  'Messages',
  true,
  'messages',
  ur.user_id
FROM user_roles ur 
WHERE ur.role IN ('owner', 'superadmin', 'admin')
ON CONFLICT (system_key) DO NOTHING;