-- First, add the new enum values
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'owner';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'superadmin';
ALTER TYPE app_role ADD VALUE IF NOT EXISTS 'manager';