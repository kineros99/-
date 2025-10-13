# Database Setup - Complete Guide

## Summary

Your Neon PostgreSQL database is now **fully configured and working**! All tables have been created and seeded with 8 lojas from the Zona Sul region of Rio de Janeiro.

## What Was Fixed

1. ✅ **Empty .env file** - Added the Neon database connection string
2. ✅ **Data organization** - Created a clean JSON data source (`lojas_data.json`)
3. ✅ **Initialization script** - Built a robust Node.js script with absolute paths
4. ✅ **Seeding process** - Automated data insertion from JSON file
5. ✅ **npm scripts** - Added convenient commands for database operations

---

## File Structure

```
/Users/eros/Desktop/encarregado/
│
├── .env                                    # Database connection (NETLIFY_DATABASE_URL)
├── package.json                            # npm scripts for db operations
├── netlify.toml                            # Netlify configuration
│
├── tools/
│   ├── data/
│   │   └── lojas_data.json                # ⭐ SOURCE OF TRUTH - All lojas data
│   │
│   ├── scripts/
│   │   ├── init_and_seed.js              # Main initialization + seeding script
│   │   ├── verify_db.js                  # Database verification script
│   │   ├── README.md                     # Detailed documentation
│   │   └── create_tables.sql             # (legacy - not used)
│   │
│   └── seeds/
│       └── seed_from_array.sql           # (legacy - not used)
│
└── netlify/
    └── functions/
        ├── init_db.js                     # Create tables via Netlify function
        ├── seed_lojas.js                  # Seed data via Netlify function
        ├── get-lojas.js                   # API to retrieve lojas
        └── auth-register.js               # API to register new lojas
```

---

## Database Schema

### `users` Table

| Column   | Type   | Constraints              |
|----------|--------|--------------------------|
| id       | SERIAL | PRIMARY KEY              |
| username | TEXT   | UNIQUE NOT NULL          |
| role     | TEXT   | NOT NULL                 |

### `lojas` Table

| Column    | Type    | Constraints                  |
|-----------|---------|------------------------------|
| id        | SERIAL  | PRIMARY KEY                  |
| user_id   | INT     | REFERENCES users(id)         |
| nome      | TEXT    | NOT NULL                     |
| endereco  | TEXT    | NOT NULL                     |
| telefone  | TEXT    |                              |
| website   | TEXT    |                              |
| latitude  | NUMERIC | NOT NULL                     |
| longitude | NUMERIC | NOT NULL                     |
| bairro    | TEXT    |                              |
| categoria | TEXT    |                              |

---

## Current Database State

### Users
- **1 user**: `import_zonasul` (merchant role)

### Lojas (8 total)

**Ipanema (4 lojas)**
- Amoedo Ipanema
- Abc da Construção
- SIB Materiais
- Casa Mourão Materiais de Construção e Ferragens

**Copacabana (2 lojas)**
- 707 Materiais de Construção
- Rede Citylar Material de Construção - Copacabana

**Gávea (1 loja)**
- Rede Citylar Material de Construção - Gávea

**Botafogo (1 loja)**
- Befran Materiais de Construção

---

## Quick Commands

### Initialize Database (creates tables + seeds data)
```bash
npm run db:init
```

### Verify Database Contents
```bash
npm run db:verify
```

### Start Development Server
```bash
npm run dev
```

Then access:
- Initialize DB: `http://localhost:8888/.netlify/functions/init_db`
- Seed data: `http://localhost:8888/.netlify/functions/seed_lojas`
- Get lojas: `http://localhost:8888/.netlify/functions/get-lojas`
- Filter by neighborhood: `http://localhost:8888/.netlify/functions/get-lojas?bairro=Ipanema`

---

## Adding New Lojas

### Method 1: Edit JSON and Re-run Script

1. Edit `/Users/eros/Desktop/encarregado/tools/data/lojas_data.json`
2. Add new entries in this format:

```json
{
  "nome": "Nova Loja Exemplo",
  "endereco": "Rua Exemplo 123, Rio de Janeiro",
  "telefone": "(21) 1234-5678",
  "website": "www.exemplo.com.br",
  "latitude": -22.9068,
  "longitude": -43.1729,
  "bairro": "Centro",
  "categoria": "Loja de materiais de construção"
}
```

3. Run: `npm run db:init`
4. Verify: `npm run db:verify`

The script is **idempotent** - running it multiple times is safe and won't create duplicates.

### Method 2: Use the API

POST to `/.netlify/functions/auth-register`:

```bash
curl -X POST http://localhost:8888/.netlify/functions/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "merchant_name",
    "store": {
      "nome": "Nova Loja",
      "endereco": "Rua Exemplo 123, Rio de Janeiro",
      "telefone": "(21) 1234-5678",
      "website": "www.exemplo.com",
      "latitude": -22.9068,
      "longitude": -43.1729,
      "bairro": "Centro",
      "categoria": "Loja de materiais de construção"
    }
  }'
```

---

## Absolute Paths Reference

All scripts use these absolute paths for maximum reliability:

- **Project Root**: `/Users/eros/Desktop/encarregado`
- **Data Source**: `/Users/eros/Desktop/encarregado/tools/data/lojas_data.json`
- **Environment**: `/Users/eros/Desktop/encarregado/.env`
- **Init Script**: `/Users/eros/Desktop/encarregado/tools/scripts/init_and_seed.js`
- **Verify Script**: `/Users/eros/Desktop/encarregado/tools/scripts/verify_db.js`

---

## Environment Variables

Your `.env` file contains:

```env
NETLIFY_DATABASE_URL=postgresql://neondb_owner:npg_8DG1cIxTyVNq@ep-icy-king-adgak0k0-pooler.c-2.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require
```

This is automatically loaded by:
- ✅ `@netlify/neon` package (in Netlify functions)
- ✅ `dotenv` package (in Node.js scripts)

---

## Troubleshooting

### "Connection string is not provided"
- Verify `/Users/eros/Desktop/encarregado/.env` exists and contains `NETLIFY_DATABASE_URL`
- Run: `cat /Users/eros/Desktop/encarregado/.env`

### "Cannot find module"
- Install dependencies: `npm install`

### "Data file not found"
- Verify: `ls -la /Users/eros/Desktop/encarregado/tools/data/lojas_data.json`

### "Duplicate key error"
- This is expected when re-running the script - the script uses `ON CONFLICT DO NOTHING`
- Existing records are preserved, only new ones are added

---

## Next Steps

1. **Start the dev server**: `npm run dev`
2. **Access your frontend**: Open `http://localhost:8888`
3. **Test the API**: Try fetching lojas with `curl http://localhost:8888/.netlify/functions/get-lojas`
4. **Add more data**: Edit `lojas_data.json` and run `npm run db:init`

---

## Technical Details

### Why JSON Instead of Text File?

The original `array_lojas_zonaSul.txt` actually contained SQL code (not plain text data). To make the system more maintainable:

1. **Separation of concerns**: Data (JSON) is separate from logic (JavaScript/SQL)
2. **Easy to edit**: JSON is human-readable and can be edited with any text editor
3. **Type safety**: JSON structure is clear and validated
4. **Reusable**: The same data file can be used by multiple scripts
5. **Version control friendly**: Easy to see what changed in git diffs

### Why Absolute Paths?

Using absolute paths like `/Users/eros/Desktop/encarregado/...` ensures:

1. **No ambiguity**: Scripts work regardless of current working directory
2. **Easy debugging**: You can see exactly which file is being used
3. **Reliability**: No path resolution issues
4. **Clarity**: Anyone reading the code knows exactly where files are

### Script Safety Features

All scripts include:
- ✅ `CREATE TABLE IF NOT EXISTS` - won't fail if tables exist
- ✅ `ON CONFLICT DO NOTHING` - won't create duplicate records
- ✅ Detailed logging - you can see exactly what's happening
- ✅ Error handling - clear error messages when things go wrong
- ✅ Idempotent - safe to run multiple times

---

## Success Indicators

You'll know everything is working when:

1. ✅ `npm run db:init` completes with "SUCCESS! Database initialized and seeded."
2. ✅ `npm run db:verify` shows 1 user and 8 lojas
3. ✅ `curl http://localhost:8888/.netlify/functions/get-lojas` returns JSON with 8 stores
4. ✅ No error messages in the console

**Your database is now fully operational!** 🎉
