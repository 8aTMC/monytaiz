-- Create username history table to track last 10 usernames per user
CREATE TABLE public.username_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  old_username TEXT NOT NULL,
  new_username TEXT NOT NULL,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.username_history ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Admins can view all username history" 
ON public.username_history 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'owner')
));

CREATE POLICY "Users can view their own username history" 
ON public.username_history 
FOR SELECT 
USING (user_id = auth.uid());

-- Create function to track username changes and maintain only last 10 entries
CREATE OR REPLACE FUNCTION public.track_username_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track if username actually changed
  IF OLD.username IS DISTINCT FROM NEW.username THEN
    -- Insert the change record
    INSERT INTO public.username_history (user_id, old_username, new_username)
    VALUES (NEW.id, COALESCE(OLD.username, ''), COALESCE(NEW.username, ''));
    
    -- Keep only last 10 entries per user
    DELETE FROM public.username_history 
    WHERE user_id = NEW.id 
    AND id NOT IN (
      SELECT id FROM public.username_history 
      WHERE user_id = NEW.id 
      ORDER BY changed_at DESC 
      LIMIT 10
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger on profiles table to track username changes
CREATE TRIGGER track_username_changes
  AFTER UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.track_username_change();