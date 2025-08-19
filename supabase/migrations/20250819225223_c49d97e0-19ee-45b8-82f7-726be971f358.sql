-- Fix search path for critical security functions
CREATE OR REPLACE FUNCTION public.user_has_permission(_user_id uuid, _permission text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 
    FROM user_roles ur
    JOIN role_permissions rp ON ur.role = rp.role
    JOIN permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = _user_id 
    AND p.name = _permission
  )
$function$;

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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$function$;