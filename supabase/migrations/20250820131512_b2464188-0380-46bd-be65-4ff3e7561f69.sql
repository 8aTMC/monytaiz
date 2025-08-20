-- Update the user role system to match the correct structure

-- Step 1: Update user roles first (move creator to owner, remove agency/manager)
UPDATE user_roles 
SET role = 'owner'::app_role 
WHERE role = 'creator'::app_role;

UPDATE user_roles 
SET role = 'admin'::app_role 
WHERE role IN ('agency'::app_role, 'manager'::app_role);

-- Step 2: Handle fan_category enum update with proper casting
-- First add the new enum values to existing enum
ALTER TYPE fan_category ADD VALUE IF NOT EXISTS 'husbands';
ALTER TYPE fan_category ADD VALUE IF NOT EXISTS 'boyfriends';  
ALTER TYPE fan_category ADD VALUE IF NOT EXISTS 'supporters';
ALTER TYPE fan_category ADD VALUE IF NOT EXISTS 'friends';
ALTER TYPE fan_category ADD VALUE IF NOT EXISTS 'general_fans';

-- Update existing data to use new values
UPDATE profiles 
SET fan_category = CASE 
    WHEN fan_category = 'husband'::fan_category THEN 'husbands'::fan_category
    WHEN fan_category = 'boyfriend'::fan_category THEN 'boyfriends'::fan_category  
    WHEN fan_category = 'supporter'::fan_category THEN 'supporters'::fan_category
    WHEN fan_category = 'friend'::fan_category THEN 'friends'::fan_category
    WHEN fan_category = 'fan'::fan_category THEN 'general_fans'::fan_category
    ELSE 'general_fans'::fan_category
END;

-- Step 3: Create new clean enums and replace
-- Create new fan_category enum
CREATE TYPE fan_category_new AS ENUM (
    'husbands',
    'boyfriends', 
    'supporters',
    'friends',
    'general_fans'
);

-- Update profiles table column
ALTER TABLE profiles 
ALTER COLUMN fan_category TYPE fan_category_new 
USING fan_category::text::fan_category_new;

-- Drop old enum and rename new one
DROP TYPE fan_category;
ALTER TYPE fan_category_new RENAME TO fan_category;

-- Set new default
ALTER TABLE profiles 
ALTER COLUMN fan_category SET DEFAULT 'general_fans'::fan_category;

-- Step 4: Create new app_role enum without unwanted roles
CREATE TYPE app_role_new AS ENUM (
    'owner',
    'superadmin', 
    'admin',
    'moderator',
    'chatter',
    'fan'
);

-- Update user_roles table
ALTER TABLE user_roles 
ALTER COLUMN role TYPE app_role_new 
USING role::text::app_role_new;

-- Update role_permissions table
ALTER TABLE role_permissions
ALTER COLUMN role TYPE app_role_new 
USING role::text::app_role_new;

-- Drop old enum and rename new one
DROP TYPE app_role;
ALTER TYPE app_role_new RENAME TO app_role;

-- Step 5: Update role levels for new hierarchy
UPDATE user_roles SET role_level = CASE
    WHEN role = 'owner' THEN 1
    WHEN role = 'superadmin' THEN 2  
    WHEN role = 'admin' THEN 3
    WHEN role = 'moderator' THEN 4
    WHEN role = 'chatter' THEN 5
    WHEN role = 'fan' THEN 6
    ELSE 6
END;

-- Step 6: Clean up orphaned permissions
DELETE FROM role_permissions 
WHERE role::text NOT IN ('owner', 'superadmin', 'admin', 'moderator', 'chatter', 'fan');

-- Add audit log
INSERT INTO audit_logs (
    user_id, action, resource_type, metadata
) VALUES (
    NULL, 'system_role_restructure', 'system',
    jsonb_build_object(
        'description', 'Restructured user roles and fan categories',
        'management_roles', ARRAY['owner', 'superadmin', 'admin', 'moderator', 'chatter'],
        'fan_categories', ARRAY['husbands', 'boyfriends', 'supporters', 'friends', 'general_fans']
    )
);