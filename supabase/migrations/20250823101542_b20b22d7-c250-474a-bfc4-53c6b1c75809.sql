-- Add owner role for the current user (Monytaiz)
INSERT INTO user_roles (user_id, role, assigned_by, role_level)
VALUES ('ff395f9e-2cdb-436c-a928-ab82efe24d67', 'owner', 'ff395f9e-2cdb-436c-a928-ab82efe24d67', 1)
ON CONFLICT (user_id, role) DO NOTHING;