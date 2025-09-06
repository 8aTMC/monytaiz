-- Create performance analytics tables
CREATE TABLE public.video_performance_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  load_time_ms INTEGER NOT NULL,
  buffer_events INTEGER DEFAULT 0,
  quality_switches INTEGER DEFAULT 0,
  initial_quality TEXT NOT NULL,
  final_quality TEXT NOT NULL,
  watch_duration_seconds INTEGER DEFAULT 0,
  completion_percentage NUMERIC(5,2) DEFAULT 0,
  network_quality TEXT DEFAULT 'unknown',
  cache_hit BOOLEAN DEFAULT false,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.user_behavior_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  media_id UUID,
  interaction_data JSONB DEFAULT '{}',
  timestamp_ms BIGINT NOT NULL,
  page_url TEXT,
  device_info JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.system_health_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  metric_type TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  metric_unit TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.performance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium',
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  resolved BOOLEAN DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.video_performance_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_behavior_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_health_metrics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.performance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for video_performance_metrics
CREATE POLICY "Management can manage video performance metrics"
ON public.video_performance_metrics
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
));

-- RLS Policies for user_behavior_analytics
CREATE POLICY "Management can manage user behavior analytics"
ON public.user_behavior_analytics
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
));

-- RLS Policies for system_health_metrics
CREATE POLICY "Management can manage system health metrics"
ON public.system_health_metrics
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
));

-- RLS Policies for performance_alerts
CREATE POLICY "Management can manage performance alerts"
ON public.performance_alerts
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
));

-- Create indexes for better performance
CREATE INDEX idx_video_performance_metrics_media_id ON public.video_performance_metrics(media_id);
CREATE INDEX idx_video_performance_metrics_user_id ON public.video_performance_metrics(user_id);
CREATE INDEX idx_video_performance_metrics_created_at ON public.video_performance_metrics(created_at);

CREATE INDEX idx_user_behavior_analytics_user_id ON public.user_behavior_analytics(user_id);
CREATE INDEX idx_user_behavior_analytics_event_type ON public.user_behavior_analytics(event_type);
CREATE INDEX idx_user_behavior_analytics_created_at ON public.user_behavior_analytics(created_at);

CREATE INDEX idx_system_health_metrics_type_recorded ON public.system_health_metrics(metric_type, recorded_at);
CREATE INDEX idx_performance_alerts_resolved ON public.performance_alerts(resolved, created_at);

-- Create function to get performance analytics
CREATE OR REPLACE FUNCTION public.get_performance_analytics(
  p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NULL,
  p_media_id UUID DEFAULT NULL
)
RETURNS TABLE(
  date_period DATE,
  avg_load_time_ms NUMERIC,
  total_views BIGINT,
  buffer_events_total BIGINT,
  quality_switches_total BIGINT,
  avg_watch_duration NUMERIC,
  cache_hit_rate NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Default to last 30 days if no date range provided
  IF p_start_date IS NULL THEN
    p_start_date := now() - interval '30 days';
  END IF;
  
  IF p_end_date IS NULL THEN
    p_end_date := now();
  END IF;
  
  RETURN QUERY
  SELECT 
    DATE(vpm.created_at) as date_period,
    ROUND(AVG(vpm.load_time_ms), 2) as avg_load_time_ms,
    COUNT(*) as total_views,
    SUM(vpm.buffer_events) as buffer_events_total,
    SUM(vpm.quality_switches) as quality_switches_total,
    ROUND(AVG(vpm.watch_duration_seconds), 2) as avg_watch_duration,
    ROUND(AVG(CASE WHEN vpm.cache_hit THEN 1.0 ELSE 0.0 END) * 100, 2) as cache_hit_rate
  FROM public.video_performance_metrics vpm
  WHERE vpm.created_at >= p_start_date
    AND vpm.created_at <= p_end_date
    AND (p_media_id IS NULL OR vpm.media_id = p_media_id)
  GROUP BY DATE(vpm.created_at)
  ORDER BY DATE(vpm.created_at);
END;
$function$;