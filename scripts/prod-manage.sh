#!/bin/bash

# A single script to manage the Simple Notes application in a production environment.
#
# USAGE:
#   ./scripts/manage.sh start   - Starts the database and the backend server with PM2.
#   ./scripts/manage.sh stop    - Stops the database and the backend server.
#   ./scripts/manage.sh restart - Restarts the entire application.
#   ./scripts/manage.sh status  - Checks the status of the container and PM2 process.
#   ./scripts/manage.sh logs    - Shows the live logs from the backend server via PM2.

# --- Configuration ---
DB_CONTAINER_NAME="notes-postgres"
APP_NAME="notes" # The name for your application in PM2

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
        podman-compose down
        echo "✅ Container stopped."
    else
        echo "Container is not running."
    fi
}

fn_start_backend() {
    echo "--- Starting backend server with PM2... ---"
    # Navigate to the backend directory to run pm2
    cd backend
    pm2 start index.js --name "$APP_NAME"
    cd ..
    echo "✅ Backend server is now managed by PM2."
}

fn_stop_backend() {
    echo "--- Stopping backend server via PM2... ---"
    pm2 stop "$APP_NAME"
    pm2 delete "$APP_NAME"
    echo "✅ Backend server stopped and removed from PM2."
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
        echo "--- Restarting application... ---"
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
        echo "--- Backend Application Status (PM2) ---"
        pm2 list
        ;;
    logs)
        echo "--- Displaying backend logs from PM2 (Press Ctrl+C to exit) ---"
        pm2 logs "$APP_NAME"
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|status|logs}"
        exit 1
        ;;
esac

