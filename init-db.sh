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
  echo "Running database migrations and seeding..."

  # Add unique constraint on name if not exists
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  DO \$\$
  BEGIN
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'unique_name'
    ) THEN
      ALTER TABLE family_users ADD CONSTRAINT unique_name UNIQUE (name);
      RAISE NOTICE 'Added unique_name constraint';
    ELSE
      RAISE NOTICE 'unique_name constraint already exists';
    END IF;
  END
  \$\$;
  "

  # Insert default_user (technical fallback for missing images)
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  INSERT INTO family_users (id, name, picture_data, email, availability, created_at, updated_at)
  SELECT gen_random_uuid(), 'default_user', NULL, NULL, 
    '{}',
    NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM family_users WHERE name = 'default_user');
  "

  # Seed default profile image for default_user if image file is present
  if [ -f "/docker-entrypoint-initdb.d/default-profile.jpg" ]; then
    echo "Seeding default profile image for default_user..."
    PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
      UPDATE family_users
      SET picture_data = pg_read_binary_file('/docker-entrypoint-initdb.d/default-profile.jpg')
      WHERE name = 'default_user' AND picture_data IS NULL;
    "
    echo "Image seeded successfully."
  else
    echo "Default profile image not found at /docker-entrypoint-initdb.d/default-profile.jpg"
  fi

  # Insert Justin (actual family member with schedule)
  PGPASSWORD="$POSTGRES_PASSWORD" psql -h "$POSTGRES_HOST" -p "$POSTGRES_PORT" -U "$POSTGRES_USER" -d "$POSTGRES_DB" -c "
  INSERT INTO family_users (id, name, picture_data, email, availability, created_at, updated_at)
  SELECT gen_random_uuid(), 'Justin', NULL, NULL, 
    '{\"Sun\": [17,18,19,20,21], \"Mon\": [17,18,19,20,21], \"Tue\": [17,18,19,20,21], \"Wed\": [17,18,19,20,21], \"Thu\": [17,18,19,20,21], \"Fri\": [17,18,19,20,21], \"Sat\": [17,18,19,20,21]}',
    NOW(), NOW()
  WHERE NOT EXISTS (SELECT 1 FROM family_users WHERE name = 'Justin');
  "

  echo "✅ Database migrations and seeding complete."
  echo "   - default_user: Technical fallback for missing profile images"
  echo "   - Justin: Family member with 5-10PM availability schedule"
fi  # Close the if-else block for db_ready check

echo "🚀 Starting Bill's Phone signaling server..."