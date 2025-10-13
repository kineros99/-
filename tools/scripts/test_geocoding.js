#!/usr/bin/env node
/**
 * Test Script for OpenCage Geocoding Integration
 *
 * This script tests the geocoding functionality without needing the dev server.
 *
 * Usage: node tools/scripts/test_geocoding.js
 */

import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '../../.env') });

// Import geocoding functions
const OPENCAGE_API_KEY = process.env.OPENCAGE_API_KEY || '684bb78d199749b78bb037bd93963a15';
const OPENCAGE_API_URL = 'https://api.opencagedata.com/geocode/v1/json';

async function geocodeAddress(address, countryCode = 'br') {
  if (!address) {
    return { success: false, error: 'No address provided' };
  }

  try {
    const params = new URLSearchParams({
      q: address,
      key: OPENCAGE_API_KEY,
      countrycode: countryCode,
      language: 'pt-BR',
      pretty: 1,
      limit: 1
    });

    const url = `${OPENCAGE_API_URL}?${params.toString()}`;
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.results || data.results.length === 0) {
      return {
        success: false,
        error: 'No results found',
        message: 'Could not find coordinates for the provided address'
      };
    }

    const result = data.results[0];
    const { lat, lng } = result.geometry;
    const components = result.components;

    return {
      success: true,
      latitude: lat,
      longitude: lng,
      formatted: result.formatted,
      confidence: result.confidence,
      components: {
        bairro: components.neighbourhood || components.suburb || null,
        city: components.city || components.town || null,
        state: components.state || null,
        country: components.country || null
      }
    };
  } catch (error) {
    return {
      success: false,
      error: 'Geocoding failed',
      message: error.message
    };
  }
}

async function runTests() {
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║           OpenCage Geocoding Test Suite                     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝\n');

  console.log(`API Key: ${OPENCAGE_API_KEY ? OPENCAGE_API_KEY.substring(0, 8) + '...' : 'NOT SET'}\n`);

  // Test addresses from existing data
  const testAddresses = [
    'Rua Farme de Amoedo 107, Rio de Janeiro',
    'Rua Barata Ribeiro 707, lj. G, Rio de Janeiro',
    'Rua Visconde de Pirajá 207, lj. 314, Rio de Janeiro',
    'Rua Gen. Polidoro 177, lj. A e B, Rio de Janeiro, RJ, 22280-002',
    'Invalid Address That Does Not Exist 99999'
  ];

  for (let i = 0; i < testAddresses.length; i++) {
    const address = testAddresses[i];

    console.log(`\n[Test ${i + 1}/${testAddresses.length}] Testing: "${address}"`);
    console.log('─'.repeat(70));

    const result = await geocodeAddress(address);

    if (result.success) {
      console.log(`✅ SUCCESS`);
      console.log(`   Latitude:  ${result.latitude}`);
      console.log(`   Longitude: ${result.longitude}`);
      console.log(`   Formatted: ${result.formatted}`);
      console.log(`   Confidence: ${result.confidence}/10`);
      console.log(`   Bairro: ${result.components.bairro || 'N/A'}`);
      console.log(`   City: ${result.components.city || 'N/A'}`);
    } else {
      console.log(`❌ FAILED`);
      console.log(`   Error: ${result.error}`);
      console.log(`   Message: ${result.message}`);
    }

    // Rate limiting - wait 1 second between requests
    if (i < testAddresses.length - 1) {
      console.log('\n⏳ Waiting 1 second (rate limiting)...');
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    Tests Complete                            ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
}

// Run tests
runTests().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
