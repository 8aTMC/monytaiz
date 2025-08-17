-- Set role hierarchy levels
UPDATE user_roles SET role_level = CASE 
    WHEN role = 'owner' THEN 1
    WHEN role = 'superadmin' THEN 2
    WHEN role = 'admin' THEN 3
    WHEN role = 'manager' THEN 4
    WHEN role = 'chatter' THEN 5
    WHEN role = 'creator' THEN 3  -- Same level as admin
    WHEN role = 'moderator' THEN 4  -- Same level as manager
    WHEN role = 'fan' THEN 6
    ELSE 6
END;