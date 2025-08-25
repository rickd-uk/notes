#!/bin/bash

# A single script to manage the entire Simple Notes development environment.
#
# USAGE:
#   ./scripts/manage.sh start   - Starts the database and backend server.
#   ./scripts/manage.sh stop    - Stops the database and backend server.
#   ./scripts/manage.sh restart - Restarts the entire application.
#   ./scripts/manage.sh status  - Checks the status of all components.
#   ./scripts/manage.sh logs    - Shows the live logs from the backend server.

# --- Configuration ---
DB_CONTAINER_NAME="notes-postgres"
BACKEND_PORT=3012

# --- Helper Functions ---
fn_start_database() {
    echo "--- Checking database container... ---"
    if ! podman ps | grep -q "$DB_CONTAINER_NAME"; then
        echo "Container '$DB_CONTAINER_NAME' is not running. Starting it now..."
        podman-compose up -d
        
        echo "Waiting for the database to become available..."
        for i in {1..30}; do
            if podman exec -it "$DB_CONTAINER_NAME" pg_isready -U notesapp_user -d notesapp -q; then
                echo "✅ PostgreSQL is ready!"
                return 0
            fi
            echo "Waiting for PostgreSQL... ($i/30)"
            sleep 1
        done
        echo "❌ ERROR: Database did not become ready in time."
        return 1
    else
        echo "✅ Container '$DB_CONTAINER_NAME' is already running."
    fi
}

fn_stop_database() {
    echo "--- Stopping database container... ---"
    if podman ps | grep -q "$DB_CONTAINER_NAME"; then
        podman stop "$DB_CONTAINER_NAME"
        podman rm "$DB_CONTAINER_NAME"
        echo "✅ Container stopped and removed."
    else
        echo "Container is not running."
    fi
}

fn_start_backend() {
    echo "--- Starting backend server... ---"
    PID=$(lsof -t -i :$BACKEND_PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "Process found on port $BACKEND_PORT (PID: $PID). Stopping it."
        kill -9 "$PID"
    fi
    
    cd backend
    nohup npm start > ../backend-server.log 2>&1 &
    cd ..
    echo "✅ Backend server started in the background."
    echo "   You can view logs with: ./scripts/manage.sh logs"
}

fn_stop_backend() {
    echo "--- Stopping backend server... ---"
    PID=$(lsof -t -i :$BACKEND_PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "Process found on port $BACKEND_PORT (PID: $PID). Stopping it."
        kill -9 "$PID"
        echo "✅ Backend server stopped."
    else
        echo "No backend process found running."
    fi
}

# --- Main Command Logic ---
case "$1" in
    start)
        fn_start_database
        fn_start_backend
        echo "🚀 Application started!"
        ;;
    stop)
        fn_stop_backend
        fn_stop_database
        echo "🛑 Application stopped."
        ;;
    restart)
        fn_stop_backend
        fn_stop_database
        echo ""
        fn_start_database
        fn_start_backend
        echo "🚀 Application restarted!"
        ;;
    status)
        echo "--- Container Status ---"
        podman ps --filter "name=$DB_CONTAINER_NAME"
        echo ""
        echo "--- Backend Status ---"
        if lsof -t -i :$BACKEND_PORT > /dev/null; then
            echo "✅ Node.js server is RUNNING."
        else
            echo "❌ Node.js server is STOPPED."
        fi
        ;;
    logs)
        echo "--- Displaying backend logs (Press Ctrl+C to exit) ---"
        tail -f backend-server.log
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac

