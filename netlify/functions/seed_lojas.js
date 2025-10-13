/**
 * Netlify Function: Seed Lojas
 *
 * This function seeds the database with lojas data from the JSON file.
 * It reads from: /Users/eros/Desktop/encarregado/tools/data/lojas_data.json
 *
 * Endpoint: /.netlify/functions/seed_lojas
 * Method: GET
 */

import { neon } from '@netlify/neon';
import { readFileSync } from 'fs';
import { join } from 'path';

const sql = neon(); // uses NETLIFY_DATABASE_URL automatically

// ABSOLUTE PATH to data file
const PROJECT_ROOT = '/Users/eros/Desktop/encarregado';
const DATA_FILE_PATH = join(PROJECT_ROOT, 'tools', 'data', 'lojas_data.json');

export const handler = async () => {
  try {
    console.log('Starting seeding process...');
    console.log(`Reading data from: ${DATA_FILE_PATH}`);

    // Step 1: Create import user if not exists
    const userResult = await sql`
      INSERT INTO users (username, role)
      VALUES ('import_zonasul', 'merchant')
      ON CONFLICT (username)
      DO UPDATE SET username = EXCLUDED.username
      RETURNING id
    `;

    const userId = userResult[0].id;
    console.log(`Import user ID: ${userId}`);

    // Step 2: Read lojas data from JSON file
    const dataContent = readFileSync(DATA_FILE_PATH, 'utf-8');
    const lojas = JSON.parse(dataContent);

    console.log(`Found ${lojas.length} lojas to insert`);

    // Step 3: Insert each loja
    let insertedCount = 0;
    const insertedLojas = [];

    for (const loja of lojas) {
      try {
        const result = await sql`
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
          RETURNING id, nome
        `;

        if (result.length > 0) {
          insertedCount++;
          insertedLojas.push(result[0]);
        }
      } catch (err) {
        console.log(`Skipped: ${loja.nome} - ${err.message}`);
      }
    }

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Lojas seeding completed!',
        total: lojas.length,
        inserted: insertedCount,
        skipped: lojas.length - insertedCount,
        lojas: insertedLojas
      }),
    };

  } catch (err) {
    console.error('Seeding error:', err);
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        error: 'Failed to seed lojas',
        message: err.message
      }),
    };
  }
};
