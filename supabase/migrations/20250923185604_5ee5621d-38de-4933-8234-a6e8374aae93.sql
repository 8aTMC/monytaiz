-- Create tables for PPV messaging system

-- Table to link messages to files/media
CREATE TABLE IF NOT EXISTS public.message_file_attachments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  message_id UUID NOT NULL,
  media_id UUID NOT NULL,
  media_table TEXT NOT NULL DEFAULT 'simple_media', -- Can be 'simple_media', 'files', or 'content_files'
  file_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table to track which files fans can access
CREATE TABLE IF NOT EXISTS public.fan_file_access (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID NOT NULL,
  media_id UUID NOT NULL,
  media_table TEXT NOT NULL DEFAULT 'simple_media',
  access_type TEXT NOT NULL DEFAULT 'granted', -- 'granted', 'purchased', 'revoked'
  granted_by UUID NOT NULL, -- Who granted access (admin/creator)
  granted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revoked_at TIMESTAMP WITH TIME ZONE NULL,
  message_id UUID NULL, -- Link to message that granted access
  price_paid_cents INTEGER DEFAULT 0,
  expires_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for PPV transactions
CREATE TABLE IF NOT EXISTS public.ppv_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  buyer_id UUID NOT NULL,
  seller_id UUID NOT NULL,
  message_id UUID NOT NULL,
  total_amount_cents INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
  payment_method TEXT DEFAULT 'demo', -- For now just demo
  processed_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for tracking purchase analytics per fan
CREATE TABLE IF NOT EXISTS public.fan_purchase_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  fan_id UUID NOT NULL,
  total_spent_cents INTEGER NOT NULL DEFAULT 0,
  total_purchases INTEGER NOT NULL DEFAULT 0,
  average_purchase_cents INTEGER NOT NULL DEFAULT 0,
  max_purchase_cents INTEGER NOT NULL DEFAULT 0,
  first_purchase_at TIMESTAMP WITH TIME ZONE NULL,
  last_purchase_at TIMESTAMP WITH TIME ZONE NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(fan_id)
);

-- Add columns to messages table for PPV functionality
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS has_attachments BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS is_ppv BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS ppv_price_cents INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS attachment_count INTEGER DEFAULT 0;

-- Enable RLS on new tables
ALTER TABLE public.message_file_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_file_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ppv_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fan_purchase_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_file_attachments
CREATE POLICY "Management can manage message attachments" 
ON public.message_file_attachments 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role])
));

-- RLS Policies for fan_file_access
CREATE POLICY "Fans can view their own file access" 
ON public.fan_file_access 
FOR SELECT 
USING (fan_id = auth.uid());

CREATE POLICY "Management can manage fan file access" 
ON public.fan_file_access 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role])
));

-- RLS Policies for ppv_transactions
CREATE POLICY "Users can view their own PPV transactions" 
ON public.ppv_transactions 
FOR SELECT 
USING (buyer_id = auth.uid() OR seller_id = auth.uid());

CREATE POLICY "Fans can create PPV purchases" 
ON public.ppv_transactions 
FOR INSERT 
WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Management can manage PPV transactions" 
ON public.ppv_transactions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
));

-- RLS Policies for fan_purchase_analytics
CREATE POLICY "Fans can view their own analytics" 
ON public.fan_purchase_analytics 
FOR SELECT 
USING (fan_id = auth.uid());

CREATE POLICY "Management can manage fan analytics" 
ON public.fan_purchase_analytics 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role])
));

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_file_attachments_message_id ON public.message_file_attachments(message_id);
CREATE INDEX IF NOT EXISTS idx_message_file_attachments_media_id ON public.message_file_attachments(media_id);
CREATE INDEX IF NOT EXISTS idx_fan_file_access_fan_id ON public.fan_file_access(fan_id);
CREATE INDEX IF NOT EXISTS idx_fan_file_access_media_id ON public.fan_file_access(media_id);
CREATE INDEX IF NOT EXISTS idx_ppv_transactions_buyer_id ON public.ppv_transactions(buyer_id);
CREATE INDEX IF NOT EXISTS idx_ppv_transactions_message_id ON public.ppv_transactions(message_id);

-- Triggers for updated_at
CREATE TRIGGER update_message_file_attachments_updated_at
  BEFORE UPDATE ON public.message_file_attachments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fan_file_access_updated_at
  BEFORE UPDATE ON public.fan_file_access
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_ppv_transactions_updated_at
  BEFORE UPDATE ON public.ppv_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fan_purchase_analytics_updated_at
  BEFORE UPDATE ON public.fan_purchase_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();