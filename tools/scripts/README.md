# Database Scripts Documentation

## Overview

This directory contains scripts for initializing and seeding the Neon PostgreSQL database.

## File Structure

```
/Users/eros/Desktop/encarregado/
├── .env                              # Database connection string
├── tools/
│   ├── data/
│   │   └── lojas_data.json          # JSON file with all lojas data (SOURCE OF TRUTH)
│   ├── scripts/
│   │   ├── init_and_seed.js         # Main initialization + seeding script
│   │   └── create_tables.sql        # SQL for table creation (legacy)
│   └── seeds/
│       └── seed_from_array.sql      # SQL seeding script (legacy)
├── netlify/
│   └── functions/
│       ├── init_db.js               # Netlify function to create tables
│       └── seed_lojas.js            # Netlify function to seed data from JSON
```

## Data Source

**PRIMARY DATA SOURCE:** `/Users/eros/Desktop/encarregado/tools/data/lojas_data.json`

This JSON file contains all the lojas information including:
- nome (name)
- endereco (address)
- telefone (phone)
- website
- latitude
- longitude
- bairro (neighborhood)
- categoria (category)

### Adding New Lojas

To add new lojas to the database, simply edit the `lojas_data.json` file and add new entries:

```json
{
  "nome": "Nova Loja",
  "endereco": "Rua Exemplo 123, Rio de Janeiro",
  "telefone": "(21) 1234-5678",
  "website": "www.novaloja.com.br",
  "latitude": -22.9068,
  "longitude": -43.1729,
  "bairro": "Centro",
  "categoria": "Loja de materiais de construção"
}
```

Then run the seeding script again (see below).

## Usage

### Option 1: Using npm scripts (RECOMMENDED)

From the project root `/Users/eros/Desktop/encarregado/`:

```bash
# Initialize tables and seed data
npm run db:init
```

### Option 2: Using Node.js directly

```bash
# Initialize and seed
node /Users/eros/Desktop/encarregado/tools/scripts/init_and_seed.js

# OR from project root
node tools/scripts/init_and_seed.js
```

### Option 3: Using Netlify Functions

Start the dev server:
```bash
npm run dev
```

Then in another terminal:

```bash
# Create tables
curl http://localhost:8888/.netlify/functions/init_db

# Seed data
curl http://localhost:8888/.netlify/functions/seed_lojas
```

## What the Scripts Do

### `init_and_seed.js`

This is the main script that performs three steps:

1. **Creates Tables**: Ensures `users` and `lojas` tables exist in the database
2. **Creates Import User**: Creates the `import_zonasul` user (merchant role)
3. **Seeds Data**: Reads `/Users/eros/Desktop/encarregado/tools/data/lojas_data.json` and inserts all lojas

The script is **idempotent** - you can run it multiple times safely. It uses:
- `CREATE TABLE IF NOT EXISTS` for tables
- `ON CONFLICT DO NOTHING` for data insertion

### Tables Created

#### `users` table
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL
);
```

#### `lojas` table
```sql
CREATE TABLE lojas (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  telefone TEXT,
  website TEXT,
  latitude NUMERIC NOT NULL,
  longitude NUMERIC NOT NULL,
  bairro TEXT,
  categoria TEXT
);
```

## Environment Variables

Ensure your `.env` file at `/Users/eros/Desktop/encarregado/.env` contains:

```
NETLIFY_DATABASE_URL=postgresql://neondb_owner:npg_8DG1cIxTyVNq@ep-icy-king-adgak0k0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

## Troubleshooting

### Script can't find data file

The script uses the absolute path:
```
/Users/eros/Desktop/encarregado/tools/data/lojas_data.json
```

Make sure this file exists.

### Database connection error

- Verify the `.env` file exists and contains `NETLIFY_DATABASE_URL`
- Check that the Neon database is accessible
- Ensure `@netlify/neon` package is installed: `npm install`

### Duplicate entries

The scripts use `ON CONFLICT DO NOTHING` which means:
- Running the script multiple times is safe
- Existing lojas won't be duplicated
- Only new lojas will be inserted

## Legacy Files

The following files are kept for reference but are NOT used by the current system:

- `tools/scripts/create_tables.sql` - SQL table creation (legacy)
- `tools/seeds/seed_from_array.sql` - SQL with embedded data (legacy)
- `tools/data/array_lojas_zonaSul.txt` - Old data format (legacy)

The new system uses `lojas_data.json` as the single source of truth.
