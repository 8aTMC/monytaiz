-- First, add 'owner' role to the app_role enum if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'app_role' AND typcategory = 'E') THEN
        CREATE TYPE app_role AS ENUM ('fan', 'chatter', 'manager', 'admin', 'superadmin', 'creator', 'agency', 'moderator', 'owner');
    ELSE
        -- Check if 'owner' already exists in the enum
        IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'owner' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')) THEN
            ALTER TYPE app_role ADD VALUE 'owner';
        END IF;
    END IF;
END $$;

-- Update the user's role from admin to owner
UPDATE user_roles 
SET role = 'owner'::app_role 
WHERE user_id = 'ff395f9e-2cdb-436c-a928-ab82efe24d67' 
AND role = 'admin'::app_role;