#!/bin/bash

# A more robust and verbose script to restart the Node.js backend

PORT=3012

echo "--- Step 1: Checking for existing process on port $PORT ---"
PID=$(lsof -t -i :$PORT 2>/dev/null)

if [ -n "$PID" ]; then
  echo "Process found with PID: $PID. Attempting to stop it."
  kill -9 $PID
  echo "Kill command sent."
else
  echo "No process found on port $PORT. Continuing."
fi
echo "--- Step 1 complete ---"
echo ""

# --- This check is removed, as start-podman.sh already handles it ---
# It's better to run start-podman.sh manually if needed.

echo "--- Step 2: Starting backend server in the background ---"
cd backend

# A more reliable way to start in the background and capture logs
nohup npm start > ../backend-server.log 2>&1 &

echo "Server start command has been issued."
echo "The server is now running in the background."
echo "--- Step 2 complete ---"
echo ""
echo "You can check the server's output and any errors in the backend-server.log file."
echo "To see live logs, run: tail -f backend-server.log"
