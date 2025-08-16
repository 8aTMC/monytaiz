-- Add admin role to the enum (this needs to be in its own transaction)
ALTER TYPE public.app_role ADD VALUE 'admin';