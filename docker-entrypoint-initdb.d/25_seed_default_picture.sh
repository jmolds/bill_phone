#!/bin/bash
set -e

IMG_PATH="/docker-entrypoint-initdb.d/default-profile.jpg"

# Debugging output
echo "POSTGRES_DB: $POSTGRES_DB"
echo "POSTGRES_USER: $POSTGRES_USER"
echo "Checking for image at $IMG_PATH"

if [ -f "$IMG_PATH" ]; then
  echo "Seeding default profile image for default_user..."
  psql "$POSTGRES_DB" "$POSTGRES_USER" <<EOF
  UPDATE family_users
  SET picture_data = pg_read_binary_file('$IMG_PATH')
  WHERE name = 'default_user';
EOF
  if [ $? -eq 0 ]; then
    echo "Image seeded successfully."
  else
    echo "Error seeding image!"
  fi
else
  echo "Default profile image not found at $IMG_PATH"
fi
