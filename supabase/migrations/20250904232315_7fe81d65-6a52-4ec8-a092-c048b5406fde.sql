-- Create media analytics table for tracking individual send/purchase events
CREATE TABLE public.media_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL REFERENCES public.simple_media(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('sent', 'purchased')),
  amount_cents INTEGER DEFAULT 0,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_analytics ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Management can view all media analytics" 
ON public.media_analytics 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role])
));

CREATE POLICY "Management can insert media analytics" 
ON public.media_analytics 
FOR INSERT 
WITH CHECK (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role = ANY(ARRAY['owner'::app_role, 'superadmin'::app_role, 'admin'::app_role, 'manager'::app_role, 'chatter'::app_role])
));

-- Create indexes for performance
CREATE INDEX idx_media_analytics_media_id ON public.media_analytics(media_id);
CREATE INDEX idx_media_analytics_created_at ON public.media_analytics(created_at);
CREATE INDEX idx_media_analytics_event_type ON public.media_analytics(event_type);

-- Create function to get media analytics for a specific media item and time period
CREATE OR REPLACE FUNCTION public.get_media_analytics(
  p_media_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  date_period DATE,
  sent_count BIGINT,
  purchased_count BIGINT,
  revenue_cents BIGINT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- If no date range specified, use all time
  IF p_start_date IS NULL THEN
    p_start_date := '1900-01-01'::TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF p_end_date IS NULL THEN
    p_end_date := now();
  END IF;
  
  RETURN QUERY
  SELECT 
    DATE(ma.created_at) as date_period,
    COALESCE(SUM(CASE WHEN ma.event_type = 'sent' THEN 1 ELSE 0 END), 0) as sent_count,
    COALESCE(SUM(CASE WHEN ma.event_type = 'purchased' THEN 1 ELSE 0 END), 0) as purchased_count,
    COALESCE(SUM(CASE WHEN ma.event_type = 'purchased' THEN ma.amount_cents ELSE 0 END), 0) as revenue_cents
  FROM public.media_analytics ma
  WHERE ma.media_id = p_media_id
    AND ma.created_at >= p_start_date
    AND ma.created_at <= p_end_date
  GROUP BY DATE(ma.created_at)
  ORDER BY DATE(ma.created_at);
END;
$$;

-- Create function to get media statistics summary
CREATE OR REPLACE FUNCTION public.get_media_stats(
  p_media_id UUID,
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL
)
RETURNS TABLE(
  total_sent BIGINT,
  total_purchased BIGINT,
  total_revenue_cents BIGINT,
  conversion_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  sent_total BIGINT := 0;
  purchased_total BIGINT := 0;
  revenue_total BIGINT := 0;
  rate NUMERIC := 0;
BEGIN
  -- If no date range specified, use all time
  IF p_start_date IS NULL THEN
    p_start_date := '1900-01-01'::TIMESTAMP WITH TIME ZONE;
  END IF;
  
  IF p_end_date IS NULL THEN
    p_end_date := now();
  END IF;
  
  -- Get totals
  SELECT 
    COALESCE(SUM(CASE WHEN ma.event_type = 'sent' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ma.event_type = 'purchased' THEN 1 ELSE 0 END), 0),
    COALESCE(SUM(CASE WHEN ma.event_type = 'purchased' THEN ma.amount_cents ELSE 0 END), 0)
  INTO sent_total, purchased_total, revenue_total
  FROM public.media_analytics ma
  WHERE ma.media_id = p_media_id
    AND ma.created_at >= p_start_date
    AND ma.created_at <= p_end_date;
  
  -- Calculate conversion rate
  IF sent_total > 0 THEN
    rate := ROUND((purchased_total::NUMERIC / sent_total::NUMERIC) * 100, 2);
  END IF;
  
  RETURN QUERY SELECT sent_total, purchased_total, revenue_total, rate;
END;
$$;

-- Add trigger to update updated_at timestamp
CREATE TRIGGER update_media_analytics_updated_at
  BEFORE UPDATE ON public.media_analytics
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();