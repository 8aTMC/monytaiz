-- Fix security issue: Function Search Path Mutable
-- Update cleanup function with proper security settings
CREATE OR REPLACE FUNCTION public.cleanup_typing_indicators()
RETURNS trigger 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  -- Clean up typing indicators older than 30 seconds
  DELETE FROM public.typing_indicators 
  WHERE updated_at < NOW() - INTERVAL '30 seconds';
  RETURN NULL;
END;
$$;

-- Update typing status function with proper security settings  
CREATE OR REPLACE FUNCTION public.update_typing_status(
  p_conversation_id UUID,
  p_is_typing BOOLEAN
)
RETURNS void 
LANGUAGE plpgsql 
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.typing_indicators (conversation_id, user_id, is_typing, updated_at)
  VALUES (p_conversation_id, auth.uid(), p_is_typing, now())
  ON CONFLICT (conversation_id, user_id)
  DO UPDATE SET 
    is_typing = EXCLUDED.is_typing,
    updated_at = EXCLUDED.updated_at;
    
  -- If user stopped typing, remove the record
  IF NOT p_is_typing THEN
    DELETE FROM public.typing_indicators 
    WHERE conversation_id = p_conversation_id 
    AND user_id = auth.uid();
  END IF;
END;
$$;