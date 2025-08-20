-- Clean up role_permissions table first
DELETE FROM role_permissions 
WHERE role IN ('creator', 'agency', 'manager');

-- Now create the new enums and update tables
CREATE TYPE fan_category_new AS ENUM (
    'husbands',
    'boyfriends', 
    'supporters',
    'friends',
    'general_fans'
);

CREATE TYPE app_role_new AS ENUM (
    'owner',
    'superadmin', 
    'admin',
    'moderator',
    'chatter',
    'fan'
);

-- Update profiles table fan_category
ALTER TABLE profiles 
ADD COLUMN fan_category_temp fan_category_new DEFAULT 'general_fans';

UPDATE profiles 
SET fan_category_temp = CASE 
    WHEN fan_category::text = 'husband' THEN 'husbands'::fan_category_new
    WHEN fan_category::text = 'boyfriend' THEN 'boyfriends'::fan_category_new  
    WHEN fan_category::text = 'supporter' THEN 'supporters'::fan_category_new
    WHEN fan_category::text = 'friend' THEN 'friends'::fan_category_new
    WHEN fan_category::text = 'fan' THEN 'general_fans'::fan_category_new
    ELSE 'general_fans'::fan_category_new
END;

-- Update user_roles table
ALTER TABLE user_roles 
ADD COLUMN role_temp app_role_new;

UPDATE user_roles 
SET role_temp = role::text::app_role_new;

-- Update role_permissions table
ALTER TABLE role_permissions
ADD COLUMN role_temp app_role_new;

UPDATE role_permissions
SET role_temp = role::text::app_role_new;

-- Replace old columns with new ones
ALTER TABLE profiles DROP COLUMN fan_category;
ALTER TABLE profiles RENAME COLUMN fan_category_temp TO fan_category;

ALTER TABLE user_roles DROP COLUMN role;
ALTER TABLE user_roles RENAME COLUMN role_temp TO role;

ALTER TABLE role_permissions DROP COLUMN role;
ALTER TABLE role_permissions RENAME COLUMN role_temp TO role;

-- Drop old enums and rename new ones
DROP TYPE fan_category;
DROP TYPE app_role;
ALTER TYPE fan_category_new RENAME TO fan_category;
ALTER TYPE app_role_new RENAME TO app_role;