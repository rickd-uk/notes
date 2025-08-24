-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Create categories table
CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    icon VARCHAR(10),
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create notes table
CREATE TABLE IF NOT EXISTS notes (
    id SERIAL PRIMARY KEY,
    content TEXT,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create index for faster queries
CREATE INDEX idx_notes_user_id ON notes (user_id);
CREATE INDEX idx_notes_category_id ON notes (category_id);
CREATE INDEX idx_categories_user_id ON categories (user_id);

-- Grant permissions to the app user
GRANT ALL PRIVILEGES ON TABLE users TO notesapp_user;
GRANT ALL PRIVILEGES ON TABLE categories TO notesapp_user;
GRANT ALL PRIVILEGES ON TABLE notes TO notesapp_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO notesapp_user;

