-- Fix security warning: Add search_path to track_username_change function
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
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;