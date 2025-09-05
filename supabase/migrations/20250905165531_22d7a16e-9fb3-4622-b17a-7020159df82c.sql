-- Create function to get actual date range for media analytics data
CREATE OR REPLACE FUNCTION public.get_media_analytics_date_range(p_media_id uuid)
RETURNS TABLE(min_date timestamp with time zone, max_date timestamp with time zone, total_days integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT 
    MIN(ma.created_at) as min_date,
    MAX(ma.created_at) as max_date,
    COALESCE(EXTRACT(days FROM (MAX(ma.created_at) - MIN(ma.created_at)))::integer, 0) as total_days
  FROM public.media_analytics ma
  WHERE ma.media_id = p_media_id;
END;
$function$