#!/bin/bash

# A more robust script to stop and remove the Podman container

echo "Stopping notes-postgres container..."
podman stop notes-postgres

echo "Removing notes-postgres container..."
podman rm notes-postgres

echo "Podman container stopped and removed."
