#!/usr/bin/env node
/**
 * Complete System Test - Test Google Maps Geocoding with Real Addresses
 *
 * Run this after enabling billing on Google Cloud to verify everything works
 */

import dotenv from 'dotenv';
import { geocodeAddress } from '../../netlify/functions/utils/geocoding_google.js';

dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

// Test addresses with known coordinates
const testAddresses = [
    {
        address: 'R. Farme de Amoedo, 107 - Ipanema, Rio de Janeiro - RJ',
        expected: { lat: -22.982926, lng: -43.200761 },
        name: 'Farme de Amoedo 107'
    },
    {
        address: 'R. Visc. de Pirajá, 339 - Ipanema, Rio de Janeiro - RJ',
        expected: { lat: -22.984312, lng: -43.205168 },
        name: 'Visconde de Pirajá 339'
    },
    {
        address: 'R. Barata Ribeiro, 707 - Copacabana, Rio de Janeiro - RJ',
        expected: { lat: -22.974534, lng: -43.191571 },
        name: 'Barata Ribeiro 707'
    }
];

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

async function testCompleteSystem() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║              COMPLETE SYSTEM TEST - GOOGLE MAPS              ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
    console.log(`API Key: ${GOOGLE_API_KEY.substring(0, 20)}...${GOOGLE_API_KEY.slice(-4)}\n`);

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < testAddresses.length; i++) {
        const test = testAddresses[i];

        console.log(`\n[${i + 1}/${testAddresses.length}] ${test.name}`);
        console.log(`Address: ${test.address}`);

        const result = await geocodeAddress(test.address);

        if (result.success) {
            const distance = calculateDistance(
                result.latitude, result.longitude,
                test.expected.lat, test.expected.lng
            );

            console.log(`✅ Geocoding SUCCESS`);
            console.log(`   Result: ${result.latitude}, ${result.longitude}`);
            console.log(`   Formatted: ${result.formatted}`);
            console.log(`   Location Type: ${result.locationType}`);
            console.log(`   Confidence: ${result.confidence}/10`);
            console.log(`   Accuracy: ${distance.toFixed(2)}m from expected`);

            if (result.components.bairro) {
                console.log(`   Bairro: ${result.components.bairro}`);
            }

            successCount++;
        } else {
            console.log(`❌ Geocoding FAILED`);
            console.log(`   Error: ${result.error}`);
            console.log(`   Message: ${result.message}`);
            failCount++;
        }

        if (i < testAddresses.length - 1) {
            console.log('\n⏳ Waiting 1 second...');
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }

    console.log('\n\n╔══════════════════════════════════════════════════════════════╗');
    console.log('║                      TEST SUMMARY                            ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`Total tests: ${testAddresses.length}`);
    console.log(`✅ Success: ${successCount}`);
    console.log(`❌ Failed: ${failCount}`);

    if (successCount === testAddresses.length) {
        console.log('\n🎉 ALL TESTS PASSED! Google Maps Geocoding is working perfectly!');
        console.log('\nNext steps:');
        console.log('1. Test locally: netlify dev');
        console.log('2. Open: http://localhost:8888');
        console.log('3. Try registering a new store');
        console.log('4. If everything works, commit and push to deploy');
        return true;
    } else if (failCount === testAddresses.length) {
        console.log('\n⚠️  ALL TESTS FAILED');
        console.log('\nThis likely means:');
        console.log('- Billing is not enabled yet on Google Cloud');
        console.log('- OR Geocoding API is not activated');
        console.log('\nEnable billing at: https://console.cloud.google.com/billing');
        return false;
    } else {
        console.log('\n⚠️  PARTIAL SUCCESS');
        console.log('\nSome tests passed, some failed. Check the errors above.');
        return false;
    }
}

testCompleteSystem().then(success => {
    process.exit(success ? 0 : 1);
});
