-- Update fan categories to the correct hierarchy
-- Create completely new enums to avoid PostgreSQL enum limitations

-- Create new fan_category enum with correct values
CREATE TYPE fan_category_corrected AS ENUM (
    'husbands',
    'boyfriends', 
    'supporters',
    'friends',
    'general_fans'
);

-- Create new app_role enum with only the correct management roles
CREATE TYPE app_role_corrected AS ENUM (
    'owner',
    'superadmin', 
    'admin',
    'moderator',
    'chatter',
    'fan'
);

-- Update profiles table to use new fan_category enum
ALTER TABLE profiles 
ADD COLUMN fan_category_new fan_category_corrected DEFAULT 'general_fans';

-- Convert existing data
UPDATE profiles 
SET fan_category_new = CASE 
    WHEN fan_category::text = 'husband' THEN 'husbands'::fan_category_corrected
    WHEN fan_category::text = 'boyfriend' THEN 'boyfriends'::fan_category_corrected  
    WHEN fan_category::text = 'supporter' THEN 'supporters'::fan_category_corrected
    WHEN fan_category::text = 'friend' THEN 'friends'::fan_category_corrected
    WHEN fan_category::text = 'fan' THEN 'general_fans'::fan_category_corrected
    ELSE 'general_fans'::fan_category_corrected
END;

-- Drop old column and rename new one
ALTER TABLE profiles DROP COLUMN fan_category;
ALTER TABLE profiles RENAME COLUMN fan_category_new TO fan_category;

-- Update user_roles table to use new app_role enum
ALTER TABLE user_roles 
ADD COLUMN role_new app_role_corrected;

-- Convert existing data
UPDATE user_roles 
SET role_new = role::text::app_role_corrected;

-- Update role_permissions table
ALTER TABLE role_permissions
ADD COLUMN role_new app_role_corrected;

UPDATE role_permissions
SET role_new = role::text::app_role_corrected;

-- Drop old columns and rename new ones
ALTER TABLE user_roles DROP COLUMN role;
ALTER TABLE user_roles RENAME COLUMN role_new TO role;

ALTER TABLE role_permissions DROP COLUMN role;
ALTER TABLE role_permissions RENAME COLUMN role_new TO role;

-- Drop old enums and rename new ones
DROP TYPE fan_category;
DROP TYPE app_role;
ALTER TYPE fan_category_corrected RENAME TO fan_category;
ALTER TYPE app_role_corrected RENAME TO app_role;

-- Add audit log
INSERT INTO audit_logs (
    user_id, action, resource_type, metadata
) VALUES (
    NULL, 'platform_structure_corrected', 'system',
    jsonb_build_object(
        'description', 'Corrected platform structure with proper user types',
        'management_roles', ARRAY['owner', 'superadmin', 'admin', 'moderator', 'chatter'],
        'fan_categories', ARRAY['husbands', 'boyfriends', 'supporters', 'friends', 'general_fans'],
        'removed_roles', ARRAY['creator', 'agency', 'manager']
    )
);