-- Create a creator profile table for the main model/creator that fans interact with
CREATE TABLE public.creator_profile (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  display_name TEXT NOT NULL,
  username TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  website_url TEXT,
  social_links JSONB DEFAULT '{}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);

-- Enable RLS
ALTER TABLE public.creator_profile ENABLE ROW LEVEL SECURITY;

-- Create policies for creator profile
CREATE POLICY "Management can manage creator profile" 
ON public.creator_profile 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM user_roles ur 
    WHERE ur.user_id = auth.uid() 
    AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
  )
);

CREATE POLICY "Authenticated users can view active creator profile" 
ON public.creator_profile 
FOR SELECT 
USING (is_active = true AND auth.uid() IS NOT NULL);

-- Create function to update updated_at
CREATE TRIGGER update_creator_profile_updated_at
BEFORE UPDATE ON public.creator_profile
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();