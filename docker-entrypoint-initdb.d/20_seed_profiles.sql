INSERT INTO family_users (name, email)
VALUES ('default_user', NULL)
ON CONFLICT (name) DO NOTHING;
