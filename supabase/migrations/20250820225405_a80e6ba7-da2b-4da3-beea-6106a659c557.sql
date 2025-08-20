-- Create typing_indicators table for real-time typing status
CREATE TABLE IF NOT EXISTS public.typing_indicators (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_typing BOOLEAN NOT NULL DEFAULT false,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(conversation_id, user_id)
);

-- Enable RLS
ALTER TABLE public.typing_indicators ENABLE ROW LEVEL SECURITY;

-- Create policies for typing_indicators
CREATE POLICY "Users can view typing indicators for their conversations"
ON public.typing_indicators
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.conversations c
    WHERE c.id = conversation_id
    AND (c.fan_id = auth.uid() OR c.creator_id = auth.uid())
  )
  OR
  EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role IN ('admin', 'owner', 'superadmin')
  )
);

CREATE POLICY "Users can update their own typing status"
ON public.typing_indicators
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own typing status"
ON public.typing_indicators
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own typing status"
ON public.typing_indicators
FOR DELETE
USING (auth.uid() = user_id);

-- Add table to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.typing_indicators;

-- Set replica identity for realtime updates
ALTER TABLE public.typing_indicators REPLICA IDENTITY FULL;

-- Create function to automatically clean up old typing indicators
CREATE OR REPLACE FUNCTION public.cleanup_typing_indicators()
RETURNS trigger AS $$
BEGIN
  -- Clean up typing indicators older than 30 seconds
  DELETE FROM public.typing_indicators 
  WHERE updated_at < NOW() - INTERVAL '30 seconds';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to clean up old typing indicators periodically
DROP TRIGGER IF EXISTS cleanup_typing_indicators_trigger ON public.typing_indicators;
CREATE TRIGGER cleanup_typing_indicators_trigger
  AFTER INSERT OR UPDATE ON public.typing_indicators
  FOR EACH STATEMENT
  EXECUTE FUNCTION public.cleanup_typing_indicators();

-- Create function to update typing status
CREATE OR REPLACE FUNCTION public.update_typing_status(
  p_conversation_id UUID,
  p_is_typing BOOLEAN
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;