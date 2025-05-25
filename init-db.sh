#!/bin/bash
# Important: don't exit on error since we need to ensure the server starts
set +e

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL..."
sleep 10  # Give PostgreSQL time to start

# Try to connect - IMPORTANT: use -h with host flag to force TCP/IP connection
db_ready=false
for i in {1..30}; do
  if PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "SELECT 1;" >/dev/null 2>&1; then
    echo "PostgreSQL is ready!"
    db_ready=true
    break
  fi
  echo "Waiting for PostgreSQL... (attempt $i)"
  sleep 2
done

# Only run migrations if database is ready
if [ "$db_ready" = false ]; then
  echo "WARNING: Could not connect to PostgreSQL after waiting. Will still start the server."
  echo "You'll need to manually run migrations later."
  # Don't exit - continue to server start
else

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
fi  # Close the if-else block for db_ready check
