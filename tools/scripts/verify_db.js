#!/usr/bin/env node
/**
 * Database Verification Script
 *
 * This script queries the database to verify the data was inserted correctly.
 *
 * Usage: node tools/scripts/verify_db.js
 */

import { neon } from '@netlify/neon';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

const sql = neon();

async function verifyDatabase() {
  console.log('============================================');
  console.log('DATABASE VERIFICATION');
  console.log('============================================\n');

  try {
    // Count users
    const userCount = await sql`SELECT COUNT(*) as count FROM users`;
    console.log(`✓ Users table: ${userCount[0].count} users`);

    // List users
    const users = await sql`SELECT id, username, role FROM users`;
    users.forEach(user => {
      console.log(`  - ID ${user.id}: ${user.username} (${user.role})`);
    });
    console.log('');

    // Count lojas
    const lojaCount = await sql`SELECT COUNT(*) as count FROM lojas`;
    console.log(`✓ Lojas table: ${lojaCount[0].count} lojas`);

    // List lojas with details
    const lojas = await sql`
      SELECT
        l.id, l.nome, l.bairro, l.categoria,
        u.username as owner
      FROM lojas l
      LEFT JOIN users u ON l.user_id = u.id
      ORDER BY l.bairro, l.nome
    `;

    console.log('\nLojas by neighborhood:');
    let currentBairro = null;

    lojas.forEach(loja => {
      if (loja.bairro !== currentBairro) {
        currentBairro = loja.bairro;
        console.log(`\n  ${currentBairro}:`);
      }
      console.log(`    ${loja.id}. ${loja.nome}`);
      console.log(`       Category: ${loja.categoria}`);
      console.log(`       Owner: ${loja.owner}`);
    });

    console.log('\n============================================');
    console.log('VERIFICATION COMPLETE');
    console.log('============================================');

  } catch (error) {
    console.error('Error verifying database:', error);
    process.exit(1);
  }
}

verifyDatabase();
