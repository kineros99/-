#!/usr/bin/env node
/**
 * Test All Stores - Check geocoding accuracy for all stores in database
 */

import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { join } from 'path';
import { geocodeAddress } from '../../netlify/functions/utils/geocoding_corrected.js';

dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

const PROJECT_ROOT = '/Users/eros/Desktop/encarregado';
const DATA_FILE = join(PROJECT_ROOT, 'tools', 'data', 'lojas_data.json');

function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

async function testAllStores() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║            TESTING ALL STORES GEOCODING ACCURACY             ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const lojas = JSON.parse(readFileSync(DATA_FILE, 'utf-8'));
    const results = [];

    for (let i = 0; i < lojas.length; i++) {
        const loja = lojas[i];

        console.log(`\n[${i + 1}/${lojas.length}] ${loja.nome}`);
        console.log(`Address: ${loja.endereco}`);
        console.log(`Database coords: ${loja.latitude}, ${loja.longitude}`);

        const geocodeResult = await geocodeAddress(loja.endereco);

        if (geocodeResult.success) {
            const distance = calculateDistance(
                geocodeResult.latitude, geocodeResult.longitude,
                loja.latitude, loja.longitude
            );

            console.log(`Corrected coords: ${geocodeResult.latitude}, ${geocodeResult.longitude}`);
            console.log(`Distance from DB: ${distance.toFixed(2)}m`);

            if (geocodeResult.correction.manualOverride) {
                console.log(`✓ Using manual override`);
            } else {
                console.log(`Correction: ${geocodeResult.correction.distanceShift.toFixed(2)}m shift`);
            }

            if (distance < 50) {
                console.log(`✅ EXCELLENT: Within 50m`);
            } else if (distance < 100) {
                console.log(`✓ GOOD: Within 100m`);
            } else if (distance < 200) {
                console.log(`⚠️  FAIR: ${distance.toFixed(0)}m - May need review`);
            } else {
                console.log(`❌ POOR: ${distance.toFixed(0)}m - NEEDS MANUAL OVERRIDE`);
            }

            results.push({
                nome: loja.nome,
                endereco: loja.endereco,
                distance: distance,
                needsOverride: distance > 200,
                dbCoords: { lat: loja.latitude, lng: loja.longitude },
                correctedCoords: { lat: geocodeResult.latitude, lng: geocodeResult.longitude },
                confidence: geocodeResult.confidence
            });
        } else {
            console.log(`❌ Geocoding failed: ${geocodeResult.message}`);
            results.push({
                nome: loja.nome,
                endereco: loja.endereco,
                error: geocodeResult.message,
                needsOverride: true
            });
        }

        if (i < lojas.length - 1) {
            console.log('\n⏳ Waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    // Summary
    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                         SUMMARY                              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const needsOverride = results.filter(r => r.needsOverride);
    const excellent = results.filter(r => r.distance && r.distance < 50);
    const good = results.filter(r => r.distance && r.distance >= 50 && r.distance < 100);
    const fair = results.filter(r => r.distance && r.distance >= 100 && r.distance < 200);

    console.log(`Total stores: ${results.length}`);
    console.log(`✅ Excellent (<50m): ${excellent.length}`);
    console.log(`✓ Good (50-100m): ${good.length}`);
    console.log(`⚠️  Fair (100-200m): ${fair.length}`);
    console.log(`❌ Needs override (>200m): ${needsOverride.length}`);

    if (needsOverride.length > 0) {
        console.log('\n\nStores needing manual override:');
        needsOverride.forEach(store => {
            console.log(`\n- ${store.nome}`);
            console.log(`  Address: ${store.endereco}`);
            if (store.distance) {
                console.log(`  Error: ${store.distance.toFixed(0)}m`);
                console.log(`  Google Maps: https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(store.endereco)}`);
            }
        });
    }
}

testAllStores().catch(error => {
    console.error('Test failed:', error);
    process.exit(1);
});
