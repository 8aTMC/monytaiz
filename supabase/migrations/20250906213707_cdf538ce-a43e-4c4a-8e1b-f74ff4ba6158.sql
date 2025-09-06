-- Create processing jobs table for server fallback tracking
CREATE TABLE IF NOT EXISTS public.processing_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  media_id UUID NOT NULL,
  job_type TEXT NOT NULL DEFAULT 'heic_conversion',
  status TEXT NOT NULL DEFAULT 'pending',
  input_path TEXT NOT NULL,
  output_path TEXT,
  preview_path TEXT,
  error_message TEXT,
  processing_metadata JSONB DEFAULT '{}',
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.processing_jobs ENABLE ROW LEVEL SECURITY;

-- Create policies for processing jobs
CREATE POLICY "Management can manage processing jobs" 
ON public.processing_jobs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager', 'chatter')
));

-- Add processing telemetry to simple_media
ALTER TABLE public.simple_media 
ADD COLUMN IF NOT EXISTS processing_path TEXT DEFAULT 'direct_upload',
ADD COLUMN IF NOT EXISTS optimization_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS client_processing_time_ms INTEGER,
ADD COLUMN IF NOT EXISTS server_fallback_reason TEXT;

-- Create trigger for updated_at
CREATE TRIGGER update_processing_jobs_updated_at
BEFORE UPDATE ON public.processing_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();