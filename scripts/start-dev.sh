#!/bin/bash

# A more robust and verbose script to start the entire development environment.

echo "--- 🚀 Starting Simple Notes Development Environment ---"
echo ""

# --- Step 1: Ensure Database Container is Running ---
echo "--- Checking PostgreSQL container status (with a 10-second timeout)... ---"

# Use 'timeout' to prevent the command from hanging indefinitely
if ! timeout 10s podman ps | grep -q notes-postgres; then
  # The 'if' condition can be true for two reasons:
  # 1. The container is not running.
  # 2. The 'podman ps' command timed out.

  # We check the exit code to see if it timed out.
  if [ $? -eq 124 ]; then
    echo "❌ ERROR: 'podman ps' command timed out after 10 seconds."
    echo "Your Podman service might be unresponsive. Please check 'podman info'."
    exit 1
  else
    echo "Container 'notes-postgres' is not running. Starting it now..."
    ./scripts/start-podman.sh
    # Check if start-podman.sh was successful
    if [ $? -ne 0 ]; then
        echo "❌ ERROR: ./scripts/start-podman.sh failed to execute correctly."
        exit 1
    fi
  fi
else
  echo "✅ Container 'notes-postgres' is already running."
fi
echo "--- Database check complete. ---"
echo ""


# --- Step 2: Restart the Node.js Backend Server ---
echo "--- Restarting Node.js backend... ---"
./scripts/restart-node.sh
if [ $? -ne 0 ]; then
    echo "❌ ERROR: ./scripts/restart-node.sh failed to execute correctly."
    exit 1
fi
echo "--- Backend restart command issued. ---"
echo ""

echo "✅ Environment is ready! Your app should be available at http://localhost:3012"
echo "You can monitor the backend logs with: tail -f backend-server.log"

