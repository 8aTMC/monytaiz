-- Create media_collaborators join table for canonical collaborator mapping
CREATE TABLE IF NOT EXISTS public.media_collaborators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  media_id uuid NOT NULL,
  media_table text NOT NULL CHECK (media_table IN ('media','simple_media','content_files')),
  collaborator_id uuid NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
  creator_id uuid NOT NULL,
  assigned_by uuid,
  source text NOT NULL DEFAULT 'auto',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (media_table, media_id, collaborator_id)
);

-- Enable RLS
ALTER TABLE public.media_collaborators ENABLE ROW LEVEL SECURITY;

-- RLS: Management can manage mappings
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'media_collaborators' AND policyname = 'Management can manage media collaborators'
  ) THEN
    CREATE POLICY "Management can manage media collaborators"
    ON public.media_collaborators
    FOR ALL
    USING (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = ANY (ARRAY['owner'::app_role,'superadmin'::app_role,'admin'::app_role,'manager'::app_role,'chatter'::app_role])
      )
    )
    WITH CHECK (
      EXISTS (
        SELECT 1 FROM public.user_roles ur
        WHERE ur.user_id = auth.uid()
          AND ur.role = ANY (ARRAY['owner'::app_role,'superadmin'::app_role,'admin'::app_role,'manager'::app_role,'chatter'::app_role])
      )
    );
  END IF;
END $$;

-- Helpful indexes
CREATE INDEX IF NOT EXISTS idx_media_collaborators_media ON public.media_collaborators (media_table, media_id);
CREATE INDEX IF NOT EXISTS idx_media_collaborators_collab ON public.media_collaborators (collaborator_id);
CREATE INDEX IF NOT EXISTS idx_media_collaborators_creator ON public.media_collaborators (creator_id);

-- Updated at trigger
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'update_media_collaborators_updated_at'
  ) THEN
    CREATE TRIGGER update_media_collaborators_updated_at
    BEFORE UPDATE ON public.media_collaborators
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;

-- Backfill from simple_media mentions -> collaborators (by username/name)
INSERT INTO public.media_collaborators (media_id, media_table, collaborator_id, creator_id, assigned_by, source)
SELECT sm.id, 'simple_media', c.id, sm.creator_id, sm.creator_id, 'auto'
FROM public.simple_media sm
JOIN public.collaborators c ON c.creator_id = sm.creator_id
WHERE EXISTS (
  SELECT 1 FROM unnest(COALESCE(sm.mentions, ARRAY[]::text[])) AS m(val)
  WHERE lower(replace(val,'@','')) IN (lower(c.username), lower(c.name))
)
ON CONFLICT DO NOTHING;

-- Backfill from simple_media tags
INSERT INTO public.media_collaborators (media_id, media_table, collaborator_id, creator_id, assigned_by, source)
SELECT sm.id, 'simple_media', c.id, sm.creator_id, sm.creator_id, 'auto'
FROM public.simple_media sm
JOIN public.collaborators c ON c.creator_id = sm.creator_id
WHERE EXISTS (
  SELECT 1 FROM unnest(COALESCE(sm.tags, ARRAY[]::text[])) AS t(val)
  WHERE lower(replace(val,'@','')) IN (lower(c.username), lower(c.name))
)
ON CONFLICT DO NOTHING;

-- Backfill from media.tags
INSERT INTO public.media_collaborators (media_id, media_table, collaborator_id, creator_id, assigned_by, source)
SELECT m.id, 'media', c.id, m.creator_id, m.creator_id, 'auto'
FROM public.media m
JOIN public.collaborators c ON c.creator_id = m.creator_id
WHERE EXISTS (
  SELECT 1 FROM unnest(COALESCE(m.tags, ARRAY[]::text[])) AS t(val)
  WHERE lower(replace(val,'@','')) IN (lower(c.username), lower(c.name))
)
ON CONFLICT DO NOTHING;

-- Backfill from content_files.tags (active files only)
INSERT INTO public.media_collaborators (media_id, media_table, collaborator_id, creator_id, assigned_by, source)
SELECT cf.id, 'content_files', c.id, cf.creator_id, cf.creator_id, 'auto'
FROM public.content_files cf
JOIN public.collaborators c ON c.creator_id = cf.creator_id
WHERE cf.is_active = true
  AND EXISTS (
    SELECT 1 FROM unnest(COALESCE(cf.tags, ARRAY[]::text[])) AS t(val)
    WHERE lower(replace(val,'@','')) IN (lower(c.username), lower(c.name))
  )
ON CONFLICT DO NOTHING;
