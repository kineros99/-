#!/usr/bin/env node
/**
 * Check Coordinate Accuracy
 *
 * This script verifies the exact coordinates in the database
 * and validates them against known correct locations.
 */

import { neon } from '@netlify/neon';
import dotenv from 'dotenv';

dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

const sql = neon();

async function checkCoordinates() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║              COORDINATE ACCURACY CHECK                       ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  try {
    const lojas = await sql`
      SELECT id, nome, endereco, latitude, longitude, bairro
      FROM lojas
      ORDER BY bairro, nome
    `;

    console.log(`Found ${lojas.length} lojas in database\n`);

    // Known correct coordinates for Rio de Janeiro neighborhoods
    const neighborhoodRanges = {
      'Ipanema': { lat: [-22.995, -22.975], lng: [-43.215, -43.195] },
      'Copacabana': { lat: [-22.980, -22.960], lng: [-43.195, -43.175] },
      'Botafogo': { lat: [-22.965, -22.945], lng: [-43.195, -43.175] },
      'Gávea': { lat: [-22.985, -22.965], lng: [-43.235, -43.215] }
    };

    let issuesFound = 0;

    for (const loja of lojas) {
      const lat = parseFloat(loja.latitude);
      const lng = parseFloat(loja.longitude);

      console.log(`\n[${loja.id}] ${loja.nome}`);
      console.log(`    Address: ${loja.endereco}`);
      console.log(`    Bairro: ${loja.bairro || 'N/A'}`);
      console.log(`    Coordinates: ${lat}, ${lng}`);

      // Check if coordinates are valid
      if (isNaN(lat) || isNaN(lng)) {
        console.log(`    ❌ INVALID: Coordinates are not numbers`);
        issuesFound++;
        continue;
      }

      // Check if coordinates are within Rio de Janeiro bounds
      const rioLatRange = [-23.1, -22.7];
      const rioLngRange = [-43.8, -43.1];

      if (lat < rioLatRange[0] || lat > rioLatRange[1] ||
          lng < rioLngRange[0] || lng > rioLngRange[1]) {
        console.log(`    ❌ OUT OF BOUNDS: Not in Rio de Janeiro area`);
        console.log(`       Rio bounds: Lat ${rioLatRange}, Lng ${rioLngRange}`);
        issuesFound++;
        continue;
      }

      // Check if coordinates match the neighborhood
      if (loja.bairro && neighborhoodRanges[loja.bairro]) {
        const range = neighborhoodRanges[loja.bairro];
        const inRange = (
          lat >= range.lat[0] && lat <= range.lat[1] &&
          lng >= range.lng[0] && lng <= range.lng[1]
        );

        if (!inRange) {
          console.log(`    ⚠️  WARNING: Coordinates don't match ${loja.bairro} range`);
          console.log(`       Expected: Lat ${range.lat}, Lng ${range.lng}`);
          issuesFound++;
        } else {
          console.log(`    ✓ Coordinates match ${loja.bairro}`);
        }
      } else {
        console.log(`    ℹ️  No validation range for bairro: ${loja.bairro}`);
      }

      // Generate Google Maps link for verification
      const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;
      console.log(`    🗺️  Verify: ${mapsUrl}`);
    }

    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log(`║  SUMMARY: ${issuesFound} potential issues found${' '.repeat(30 - issuesFound.toString().length)}║`);
    console.log('╚══════════════════════════════════════════════════════════════╝');

    if (issuesFound > 0) {
      console.log('\n⚠️  Issues detected! Coordinates may need to be re-geocoded.');
      process.exit(1);
    } else {
      console.log('\n✅ All coordinates appear valid!');
    }

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkCoordinates();
