#!/usr/bin/env node
/**
 * ============================================================================
 * Database Initialization and Seeding Script
 * ============================================================================
 *
 * This script ensures that:
 * 1. The database tables (users, lojas) are created
 * 2. The database is seeded with initial data from lojas_data.json
 *
 * ABSOLUTE PATHS:
 * - Script location: /Users/eros/Desktop/encarregado/tools/scripts/init_and_seed.js
 * - Data source: /Users/eros/Desktop/encarregado/tools/data/lojas_data.json
 * - .env file: /Users/eros/Desktop/encarregado/.env
 *
 * Usage:
 *   node /Users/eros/Desktop/encarregado/tools/scripts/init_and_seed.js
 *
 * OR from project root:
 *   node tools/scripts/init_and_seed.js
 */

import { neon } from '@netlify/neon';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

// Get the directory of this script
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ABSOLUTE PATH to project root
const PROJECT_ROOT = '/Users/eros/Desktop/encarregado';

// ABSOLUTE PATH to data file
const DATA_FILE_PATH = join(PROJECT_ROOT, 'tools', 'data', 'lojas_data.json');

console.log('============================================');
console.log('DATABASE INITIALIZATION & SEEDING');
console.log('============================================');
console.log(`Project Root: ${PROJECT_ROOT}`);
console.log(`Data File: ${DATA_FILE_PATH}`);
console.log('============================================\n');

// Initialize database connection
// This uses NETLIFY_DATABASE_URL from .env automatically
const sql = neon();

/**
 * Step 1: Create tables if they don't exist
 */
async function createTables() {
  console.log('[1/3] Creating tables...');

  try {
    // Create users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        role TEXT NOT NULL
      )
    `;
    console.log('  ✓ Users table created/verified');

    // Create lojas table with foreign key to users
    await sql`
      CREATE TABLE IF NOT EXISTS lojas (
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
      )
    `;
    console.log('  ✓ Lojas table created/verified');
    console.log('');

  } catch (error) {
    console.error('  ✗ Error creating tables:', error.message);
    throw error;
  }
}

/**
 * Step 2: Create the import user
 */
async function createImportUser() {
  console.log('[2/3] Creating import user...');

  try {
    const result = await sql`
      INSERT INTO users (username, role)
      VALUES ('import_zonasul', 'merchant')
      ON CONFLICT (username)
      DO UPDATE SET username = EXCLUDED.username
      RETURNING id
    `;

    const userId = result[0].id;
    console.log(`  ✓ Import user ready (ID: ${userId})`);
    console.log('');
    return userId;

  } catch (error) {
    console.error('  ✗ Error creating import user:', error.message);
    throw error;
  }
}

/**
 * Step 3: Seed data from JSON file
 */
async function seedData(userId) {
  console.log('[3/3] Seeding data from JSON file...');
  console.log(`  Reading: ${DATA_FILE_PATH}`);

  try {
    // Read and parse the JSON data file
    const dataContent = readFileSync(DATA_FILE_PATH, 'utf-8');
    const lojas = JSON.parse(dataContent);

    console.log(`  Found ${lojas.length} lojas to insert`);

    // Insert each loja
    let insertedCount = 0;
    let skippedCount = 0;

    for (const loja of lojas) {
      try {
        await sql`
          INSERT INTO lojas (
            user_id, nome, endereco, telefone, website,
            latitude, longitude, bairro, categoria
          )
          VALUES (
            ${userId},
            ${loja.nome},
            ${loja.endereco},
            ${loja.telefone},
            ${loja.website},
            ${loja.latitude},
            ${loja.longitude},
            ${loja.bairro},
            ${loja.categoria}
          )
          ON CONFLICT DO NOTHING
        `;
        insertedCount++;
        console.log(`    ✓ ${loja.nome}`);
      } catch (err) {
        skippedCount++;
        console.log(`    ○ ${loja.nome} (already exists or error)`);
      }
    }

    console.log('');
    console.log(`  Summary: ${insertedCount} inserted, ${skippedCount} skipped`);
    console.log('');

  } catch (error) {
    console.error('  ✗ Error seeding data:', error.message);
    throw error;
  }
}

/**
 * Main execution
 */
async function main() {
  try {
    await createTables();
    const userId = await createImportUser();
    await seedData(userId);

    console.log('============================================');
    console.log('SUCCESS! Database initialized and seeded.');
    console.log('============================================');
    process.exit(0);

  } catch (error) {
    console.error('');
    console.error('============================================');
    console.error('FAILED! An error occurred.');
    console.error('============================================');
    console.error(error);
    process.exit(1);
  }
}

// Run the script
main();
