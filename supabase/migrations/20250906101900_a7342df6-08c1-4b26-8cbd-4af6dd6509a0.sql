-- Create general_settings table for app-wide settings
CREATE TABLE public.general_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  expanded_dark_logo_url TEXT,
  expanded_light_logo_url TEXT,
  collapsed_dark_logo_url TEXT,
  collapsed_light_logo_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE public.general_settings ENABLE ROW LEVEL SECURITY;

-- Create policies for admin-only access
CREATE POLICY "Management can manage general settings" 
ON public.general_settings 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin')
));

-- Create storage bucket for logos
INSERT INTO storage.buckets (id, name, public) VALUES ('logos', 'logos', true);

-- Create storage policies for logo uploads
CREATE POLICY "Logo images are publicly accessible" 
ON storage.objects 
FOR SELECT 
USING (bucket_id = 'logos');

CREATE POLICY "Admins can upload logos" 
ON storage.objects 
FOR INSERT 
WITH CHECK (bucket_id = 'logos' AND EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin')
));

CREATE POLICY "Admins can update logos" 
ON storage.objects 
FOR UPDATE 
USING (bucket_id = 'logos' AND EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin')
));

CREATE POLICY "Admins can delete logos" 
ON storage.objects 
FOR DELETE 
USING (bucket_id = 'logos' AND EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin')
));

-- Create trigger for updating timestamps
CREATE TRIGGER update_general_settings_updated_at
BEFORE UPDATE ON public.general_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();