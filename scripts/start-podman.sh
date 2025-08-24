#!/bin/bash

# Start the Podman containers
podman-compose up -d

echo "PostgreSQL container is starting..."
echo "Waiting for the database to become available..."

# --- Improved Health Check ---
# This loop will try to connect every second for up to 30 seconds.
for i in {1..30}; do
    # pg_isready quietly checks if the database is ready for connections
    if podman exec -it notes-postgres pg_isready -U notesapp_user -d notesapp -q; then
        echo "PostgreSQL is ready!"
        break
    fi
    echo "Waiting for PostgreSQL... ($i/30)"
    sleep 1
done

# Final check to confirm the container is running
if podman ps | grep -q notes-postgres; then
    echo "PostgreSQL container is now running."
else
    echo "Error: PostgreSQL container failed to start."
fi

