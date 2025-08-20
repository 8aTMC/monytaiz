-- Update the user role system to match the correct structure

-- First, let's update any users with roles that will be removed
-- Move any 'creator' role users to 'owner' role (assuming they are the main creator)
UPDATE user_roles 
SET role = 'owner'::app_role 
WHERE role = 'creator'::app_role;

-- Remove agency and manager roles (move to admin if needed)
UPDATE user_roles 
SET role = 'admin'::app_role 
WHERE role IN ('agency'::app_role, 'manager'::app_role);

-- Update fan_category enum to use plural forms and correct naming
ALTER TYPE fan_category RENAME TO fan_category_old;

CREATE TYPE fan_category AS ENUM (
    'husbands',
    'boyfriends', 
    'supporters',
    'friends',
    'general_fans'
);

-- Update profiles table to use new fan_category
ALTER TABLE profiles 
ALTER COLUMN fan_category DROP DEFAULT;

-- Convert existing categories to new format
UPDATE profiles 
SET fan_category = CASE 
    WHEN fan_category::text = 'husband' THEN 'husbands'::fan_category
    WHEN fan_category::text = 'boyfriend' THEN 'boyfriends'::fan_category  
    WHEN fan_category::text = 'supporter' THEN 'supporters'::fan_category
    WHEN fan_category::text = 'friend' THEN 'friends'::fan_category
    WHEN fan_category::text = 'fan' THEN 'general_fans'::fan_category
    ELSE 'general_fans'::fan_category
END;

-- Set new default
ALTER TABLE profiles 
ALTER COLUMN fan_category SET DEFAULT 'general_fans'::fan_category;

-- Drop old enum
DROP TYPE fan_category_old;

-- Update app_role enum to remove unwanted roles
-- First create new enum with correct roles
ALTER TYPE app_role RENAME TO app_role_old;

CREATE TYPE app_role AS ENUM (
    'owner',
    'superadmin', 
    'admin',
    'moderator',
    'chatter',
    'fan'
);

-- Update user_roles table to use new enum
ALTER TABLE user_roles 
ALTER COLUMN role TYPE app_role USING role::text::app_role;

-- Update role_permissions table to use new enum  
ALTER TABLE role_permissions
ALTER COLUMN role TYPE app_role USING role::text::app_role;

-- Drop old enum
DROP TYPE app_role_old;

-- Clean up any orphaned role_permissions for removed roles
DELETE FROM role_permissions 
WHERE role NOT IN ('owner', 'superadmin', 'admin', 'moderator', 'chatter', 'fan');

-- Update role levels to reflect new hierarchy
UPDATE user_roles SET role_level = CASE
    WHEN role = 'owner' THEN 1
    WHEN role = 'superadmin' THEN 2  
    WHEN role = 'admin' THEN 3
    WHEN role = 'moderator' THEN 4
    WHEN role = 'chatter' THEN 5
    WHEN role = 'fan' THEN 6
    ELSE 6
END;

-- Add audit log for this change
INSERT INTO audit_logs (
    user_id,
    action, 
    resource_type,
    metadata
) VALUES (
    NULL,
    'system_role_restructure',
    'system',
    jsonb_build_object(
        'description', 'Restructured user roles and fan categories per platform requirements',
        'removed_roles', ARRAY['creator', 'agency', 'manager'],
        'new_fan_categories', ARRAY['husbands', 'boyfriends', 'supporters', 'friends', 'general_fans']
    )
);