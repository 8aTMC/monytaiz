-- Step 1: Clean up user roles first
UPDATE user_roles 
SET role = 'owner'::app_role 
WHERE role = 'creator'::app_role;

UPDATE user_roles 
SET role = 'admin'::app_role 
WHERE role IN ('agency'::app_role, 'manager'::app_role);

-- Step 2: Update role hierarchy levels
UPDATE user_roles SET role_level = CASE
    WHEN role = 'owner' THEN 1
    WHEN role = 'superadmin' THEN 2  
    WHEN role = 'admin' THEN 3
    WHEN role = 'moderator' THEN 4
    WHEN role = 'chatter' THEN 5
    WHEN role = 'fan' THEN 6
    ELSE 6
END;