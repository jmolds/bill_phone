#!/bin/bash
set -e

# Wait for PostgreSQL to be ready
until pg_isready -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER"; do
  echo "Waiting for PostgreSQL..."
  sleep 2
done

# Add unique constraint on name if not exists
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'unique_name'
  ) THEN
    ALTER TABLE family_users ADD CONSTRAINT unique_name UNIQUE (name);
  END IF;
END
$$;
"

# Insert default Justin row if not exists
psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
INSERT INTO family_users (id, name, picture_url, email, availability, created_at, updated_at)
SELECT gen_random_uuid(), 'Justin', NULL, NULL, 
  '{"Sun": [17,18,19,20,21], "Mon": [17,18,19,20,21], "Tue": [17,18,19,20,21], "Wed": [17,18,19,20,21], "Thu": [17,18,19,20,21], "Fri": [17,18,19,20,21], "Sat": [17,18,19,20,21]}',
  NOW(), NOW()
WHERE NOT EXISTS (SELECT 1 FROM family_users WHERE name = 'Justin');
"
echo "DB migrations and seed complete."
