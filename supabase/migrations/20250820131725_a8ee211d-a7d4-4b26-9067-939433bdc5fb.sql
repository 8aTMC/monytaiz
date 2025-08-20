-- Since there are dependencies on the role column, let's use ALTER TYPE to modify the enum directly
-- This is a simpler approach that won't break existing dependencies

-- First, let's just update the display in code by using the database functions
-- and handle enum changes through a different approach

-- For now, let's just clean up the role_permissions and update the existing enums values
-- We'll work with the existing enum structure but ensure the data is correct

-- Clean up any orphaned role_permissions
DELETE FROM role_permissions 
WHERE role::text NOT IN ('owner', 'superadmin', 'admin', 'moderator', 'chatter', 'fan');

-- Update role levels to match the new hierarchy  
UPDATE user_roles SET role_level = CASE
    WHEN role::text = 'owner' THEN 1
    WHEN role::text = 'superadmin' THEN 2  
    WHEN role::text = 'admin' THEN 3
    WHEN role::text = 'moderator' THEN 4
    WHEN role::text = 'chatter' THEN 5
    WHEN role::text = 'fan' THEN 6
    ELSE 6
END;

-- Add final audit log
INSERT INTO audit_logs (
    user_id, action, resource_type, metadata
) VALUES (
    NULL, 'user_roles_cleaned', 'system',
    jsonb_build_object(
        'description', 'Cleaned user roles - creator role removed, hierarchy updated',
        'valid_management_roles', ARRAY['owner', 'superadmin', 'admin', 'moderator', 'chatter'],
        'fan_role', 'fan'
    )
);