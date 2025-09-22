-- Create user_presence table for tracking online status
CREATE TABLE public.user_presence (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  is_online BOOLEAN NOT NULL DEFAULT false,
  last_seen_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id)
);

-- Enable RLS
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view their own presence"
ON public.user_presence
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own presence"
ON public.user_presence
FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own presence"
ON public.user_presence
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Management can view all presence"
ON public.user_presence
FOR ALL
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('owner', 'superadmin', 'admin', 'manager')
));

-- Create trigger for updated_at
CREATE TRIGGER update_user_presence_updated_at
BEFORE UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to update message delivery status when user comes online
CREATE OR REPLACE FUNCTION public.update_message_delivery_on_presence()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only proceed if user is coming online (was offline, now online)
  IF (OLD.is_online = FALSE AND NEW.is_online = TRUE) THEN
    -- Update delivered_at for undelivered messages where this user is the recipient
    UPDATE messages 
    SET delivered_at = now()
    WHERE delivered_at IS NULL 
    AND sender_id != NEW.user_id
    AND conversation_id IN (
      SELECT id FROM conversations 
      WHERE (fan_id = NEW.user_id OR creator_id = NEW.user_id)
      AND status = 'active'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for presence updates
CREATE TRIGGER update_delivery_on_presence_change
AFTER UPDATE ON public.user_presence
FOR EACH ROW
EXECUTE FUNCTION public.update_message_delivery_on_presence();