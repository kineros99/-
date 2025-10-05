-- users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL
);

-- lojas table
CREATE TABLE IF NOT EXISTS lojas (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    nome TEXT NOT NULL,
    endereco TEXT,
    telefone TEXT,
    website TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    bairro TEXT,
    categoria TEXT
);