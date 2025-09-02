-- Create collaborators table
CREATE TABLE public.collaborators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  profile_picture_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create saved_tags table
CREATE TABLE public.saved_tags (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  creator_id UUID NOT NULL,
  tag_name TEXT NOT NULL,
  usage_count INTEGER NOT NULL DEFAULT 1,
  last_used_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_tags ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for collaborators
CREATE POLICY "Management can manage collaborators" 
ON public.collaborators 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
));

-- Create RLS policies for saved_tags
CREATE POLICY "Management can manage saved tags" 
ON public.saved_tags 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
));

-- Create update triggers
CREATE TRIGGER update_collaborators_updated_at
BEFORE UPDATE ON public.collaborators
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create index for performance
CREATE INDEX idx_collaborators_creator_id ON public.collaborators(creator_id);
CREATE INDEX idx_saved_tags_creator_id ON public.saved_tags(creator_id);
CREATE INDEX idx_saved_tags_usage ON public.saved_tags(creator_id, last_used_at DESC);