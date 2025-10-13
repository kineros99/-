#!/usr/bin/env node
/**
 * Quick test to verify Google Maps API key is working
 */

import dotenv from 'dotenv';
dotenv.config({ path: '/Users/eros/Desktop/encarregado/.env' });

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

async function testGoogleMapsKey() {
    console.log('╔══════════════════════════════════════════════════════════════╗');
    console.log('║          TESTING GOOGLE MAPS API KEY                         ║');
    console.log('╚══════════════════════════════════════════════════════════════╝\n');

    console.log(`API Key: ${GOOGLE_API_KEY.substring(0, 20)}...${GOOGLE_API_KEY.slice(-4)}`);
    console.log('\nTesting with a simple address in Rio de Janeiro...\n');

    const testAddress = 'R. Visc. de Pirajá, 339 - Ipanema, Rio de Janeiro - RJ';

    try {
        const params = new URLSearchParams({
            address: testAddress,
            key: GOOGLE_API_KEY,
            language: 'pt-BR',
            region: 'br'
        });

        const url = `https://maps.googleapis.com/maps/api/geocode/json?${params.toString()}`;

        console.log('Sending request to Google Maps API...');
        const response = await fetch(url);
        const data = await response.json();

        console.log(`\nAPI Status: ${data.status}`);

        if (data.status === 'OK') {
            const result = data.results[0];
            const location = result.geometry.location;

            console.log('\n✅ API KEY IS WORKING!\n');
            console.log('Test Results:');
            console.log(`  Address: ${testAddress}`);
            console.log(`  Found: ${result.formatted_address}`);
            console.log(`  Coordinates: ${location.lat}, ${location.lng}`);
            console.log(`  Location Type: ${result.geometry.location_type}`);
            console.log(`\n🎉 Google Maps Geocoding API está funcionando perfeitamente!`);

            return true;
        } else if (data.status === 'REQUEST_DENIED') {
            console.log('\n❌ API KEY NÃO ESTÁ FUNCIONANDO\n');
            console.log('Erro: REQUEST_DENIED');
            console.log('Possíveis causas:');
            console.log('  1. API key está incorreta');
            console.log('  2. Geocoding API não está ativada no Google Cloud Console');
            console.log('  3. Billing não está configurado');
            console.log('  4. API key tem restrições que bloqueiam este uso');

            if (data.error_message) {
                console.log(`\nMensagem de erro: ${data.error_message}`);
            }

            return false;
        } else {
            console.log(`\n⚠️ API retornou status: ${data.status}`);
            if (data.error_message) {
                console.log(`Mensagem: ${data.error_message}`);
            }
            return false;
        }

    } catch (error) {
        console.log('\n❌ ERRO ao conectar com Google Maps API\n');
        console.log(`Erro: ${error.message}`);
        return false;
    }
}

testGoogleMapsKey().then(success => {
    process.exit(success ? 0 : 1);
});
