-- Create user_blocks table for blocking functionality
CREATE TABLE public.user_blocks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  blocker_id UUID NOT NULL,
  blocked_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(blocker_id, blocked_id)
);

-- Create user_restrictions table for restricting functionality  
CREATE TABLE public.user_restrictions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restrictor_id UUID NOT NULL,
  restricted_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restrictor_id, restricted_id)
);

-- Create user_notes table for admin notes on users
CREATE TABLE public.user_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  admin_id UUID NOT NULL,
  user_id UUID NOT NULL,
  notes TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_restrictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_notes ENABLE ROW LEVEL SECURITY;

-- RLS policies for user_blocks
CREATE POLICY "Admins can manage all blocks" 
ON public.user_blocks 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'owner')
));

CREATE POLICY "Users can view blocks involving them" 
ON public.user_blocks 
FOR SELECT 
USING (blocker_id = auth.uid() OR blocked_id = auth.uid());

-- RLS policies for user_restrictions
CREATE POLICY "Admins can manage all restrictions" 
ON public.user_restrictions 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'owner')
));

CREATE POLICY "Users can view restrictions involving them" 
ON public.user_restrictions 
FOR SELECT 
USING (restrictor_id = auth.uid() OR restricted_id = auth.uid());

-- RLS policies for user_notes
CREATE POLICY "Admins can manage all user notes" 
ON public.user_notes 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM user_roles ur 
  WHERE ur.user_id = auth.uid() 
  AND ur.role IN ('admin', 'owner')
));

-- Add triggers for updated_at timestamps
CREATE TRIGGER update_user_blocks_updated_at
BEFORE UPDATE ON public.user_blocks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_restrictions_updated_at
BEFORE UPDATE ON public.user_restrictions
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_user_notes_updated_at
BEFORE UPDATE ON public.user_notes
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create helper functions
CREATE OR REPLACE FUNCTION public.is_user_blocked(_blocker_id uuid, _blocked_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_blocks
    WHERE blocker_id = _blocker_id AND blocked_id = _blocked_id
  )
$function$;

CREATE OR REPLACE FUNCTION public.is_user_restricted(_restrictor_id uuid, _restricted_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM user_restrictions
    WHERE restrictor_id = _restrictor_id AND restricted_id = _restricted_id
  )
$function$;