-- Create enum types for roles and permissions
CREATE TYPE public.app_role AS ENUM ('fan', 'creator', 'chatter', 'agency', 'moderator');
CREATE TYPE public.content_type AS ENUM ('image', 'video', 'audio', 'document', 'pack');
CREATE TYPE public.negotiation_status AS ENUM ('pending', 'accepted', 'rejected', 'countered', 'expired');
CREATE TYPE public.purchase_status AS ENUM ('pending', 'completed', 'cancelled', 'refunded');

-- Users table extension with profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE,
  display_name TEXT,
  bio TEXT,
  avatar_url TEXT,
  banner_url TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RBAC Tables
CREATE TABLE public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission_id UUID REFERENCES public.permissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(role, permission_id)
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  assigned_by UUID REFERENCES public.profiles(id),
  assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, role)
);

-- Content Management
CREATE TABLE public.content_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_size BIGINT,
  content_type content_type NOT NULL,
  base_price DECIMAL(10,2) NOT NULL DEFAULT 0,
  is_pack BOOLEAN DEFAULT FALSE,
  pack_id UUID REFERENCES public.content_files(id),
  thumbnail_url TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Purchases
CREATE TABLE public.purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content_id UUID REFERENCES public.content_files(id) ON DELETE CASCADE NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status purchase_status DEFAULT 'pending',
  negotiation_id UUID,
  purchased_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE
);

-- Negotiations
CREATE TABLE public.negotiations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id UUID REFERENCES public.content_files(id) ON DELETE CASCADE NOT NULL,
  buyer_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  seller_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  original_price DECIMAL(10,2) NOT NULL,
  proposed_price DECIMAL(10,2) NOT NULL,
  current_price DECIMAL(10,2) NOT NULL,
  status negotiation_status DEFAULT 'pending',
  last_offer_by UUID REFERENCES public.profiles(id) NOT NULL,
  message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);

-- Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id),
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id UUID,
  metadata JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.content_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negotiations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Insert default permissions
INSERT INTO public.permissions (name, description) VALUES
('view_content', 'View content files'),
('purchase_content', 'Purchase content'),
('upload_content', 'Upload content files'),
('manage_users', 'Manage user accounts'),
('view_analytics', 'View platform analytics'),
('moderate_content', 'Moderate content and users'),
('negotiate_price', 'Negotiate content prices'),
('manage_negotiations', 'Manage all negotiations');

-- Assign permissions to roles
INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'fan', id FROM public.permissions WHERE name IN ('view_content', 'purchase_content', 'negotiate_price');

INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'creator', id FROM public.permissions WHERE name IN ('view_content', 'upload_content', 'view_analytics', 'manage_negotiations');

INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'chatter', id FROM public.permissions WHERE name IN ('view_content');

INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'agency', id FROM public.permissions WHERE name IN ('view_analytics');

INSERT INTO public.role_permissions (role, permission_id) 
SELECT 'moderator', id FROM public.permissions WHERE name IN ('view_content', 'moderate_content');

-- RLS Policies
-- Profiles
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- User roles  
CREATE POLICY "Users can view their own roles" ON public.user_roles FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Creators can manage roles" ON public.user_roles FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.user_roles ur 
    WHERE ur.user_id = auth.uid() AND ur.role = 'creator'
  )
);

-- Content files
CREATE POLICY "Content is viewable by everyone" ON public.content_files FOR SELECT USING (is_active = true);
CREATE POLICY "Creators can manage their content" ON public.content_files FOR ALL USING (creator_id = auth.uid());

-- Purchases
CREATE POLICY "Users can view their purchases" ON public.purchases FOR SELECT USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);
CREATE POLICY "Users can create purchases" ON public.purchases FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Negotiations
CREATE POLICY "Users can view their negotiations" ON public.negotiations FOR SELECT USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);
CREATE POLICY "Users can create negotiations" ON public.negotiations FOR INSERT WITH CHECK (buyer_id = auth.uid());
CREATE POLICY "Users can update their negotiations" ON public.negotiations FOR UPDATE USING (
  buyer_id = auth.uid() OR seller_id = auth.uid()
);

-- Audit logs
CREATE POLICY "Users can view their own audit logs" ON public.audit_logs FOR SELECT USING (user_id = auth.uid());

-- Functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_content_files_updated_at BEFORE UPDATE ON public.content_files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_negotiations_updated_at BEFORE UPDATE ON public.negotiations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, username, display_name)
  VALUES (
    NEW.id,
    NEW.raw_user_meta_data ->> 'username',
    NEW.raw_user_meta_data ->> 'display_name'
  );
  
  -- Assign default fan role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'fan');
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Storage buckets
INSERT INTO storage.buckets (id, name, public) VALUES ('content', 'content', false);
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);
INSERT INTO storage.buckets (id, name, public) VALUES ('banners', 'banners', true);

-- Storage policies
CREATE POLICY "Content is accessible to purchasers" ON storage.objects FOR SELECT USING (
  bucket_id = 'content' AND (
    EXISTS (
      SELECT 1 FROM public.purchases p
      JOIN public.content_files cf ON cf.id = p.content_id
      WHERE p.buyer_id = auth.uid() 
      AND p.status = 'completed'
      AND cf.file_path = name
    ) OR
    EXISTS (
      SELECT 1 FROM public.content_files cf
      WHERE cf.creator_id = auth.uid()
      AND cf.file_path = name
    )
  )
);

CREATE POLICY "Creators can upload content" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'content' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Avatar images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
CREATE POLICY "Users can upload their own avatar" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Banner images are publicly accessible" ON storage.objects FOR SELECT USING (bucket_id = 'banners');
CREATE POLICY "Users can upload their own banner" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'banners' AND auth.uid()::text = (storage.foldername(name))[1]
);