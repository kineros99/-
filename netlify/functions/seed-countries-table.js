/**
 * ============================================================================
 * Seed Countries Table - Phase 2 Setup
 * ============================================================================
 *
 * Populates the countries table with data from the static map
 * Run after migrate-add-countries-table.js
 *
 * Endpoint: /.netlify/functions/seed-countries-table
 * Method: GET or POST
 */

import { neon } from '@netlify/neon';
import { COUNTRY_LANGUAGE_DATA } from './utils/country-language-map.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL);

export const handler = async () => {
    try {
        console.log('[Seed] Starting countries table seeding...\n');

        const entries = Object.entries(COUNTRY_LANGUAGE_DATA);
        let inserted = 0;
        let updated = 0;
        let errors = [];

        for (const [code, data] of entries) {
            try {
                console.log(`[Seed] Processing ${code} (${data.name})...`);

                const result = await sql`
                    INSERT INTO countries (
                        country_code,
                        name,
                        continent,
                        primary_language,
                        full_language_code,
                        alternative_languages,
                        currency,
                        distance_unit,
                        neighborhood_terms,
                        search_templates,
                        regional_languages,
                        use_zip_codes,
                        use_postcodes,
                        administrative_structure,
                        data_sources,
                        data_source,
                        last_updated
                    ) VALUES (
                        ${code},
                        ${data.name},
                        ${data.continent},
                        ${data.primary},
                        ${data.full},
                        ${JSON.stringify(data.alternatives || [])},
                        ${data.currency},
                        ${data.distanceUnit || 'km'},
                        ${JSON.stringify(data.neighborhoodTerms)},
                        ${JSON.stringify(data.searchTemplates)},
                        ${JSON.stringify(data.regionalLanguages || null)},
                        ${data.useZipCodes || false},
                        ${data.usePostcodes || false},
                        ${JSON.stringify(data.administrativeStructure || null)},
                        ${JSON.stringify(data.dataSources || ['Google', 'OSM'])},
                        'static_map',
                        NOW()
                    )
                    ON CONFLICT (country_code)
                    DO UPDATE SET
                        name = EXCLUDED.name,
                        continent = EXCLUDED.continent,
                        primary_language = EXCLUDED.primary_language,
                        full_language_code = EXCLUDED.full_language_code,
                        alternative_languages = EXCLUDED.alternative_languages,
                        currency = EXCLUDED.currency,
                        distance_unit = EXCLUDED.distance_unit,
                        neighborhood_terms = EXCLUDED.neighborhood_terms,
                        search_templates = EXCLUDED.search_templates,
                        regional_languages = EXCLUDED.regional_languages,
                        use_zip_codes = EXCLUDED.use_zip_codes,
                        use_postcodes = EXCLUDED.use_postcodes,
                        administrative_structure = EXCLUDED.administrative_structure,
                        data_sources = EXCLUDED.data_sources,
                        last_updated = NOW()
                    RETURNING id, country_code
                `;

                if (result.length > 0) {
                    inserted++;
                    console.log(`[Seed] ✓ ${code} inserted/updated`);
                }

            } catch (error) {
                console.error(`[Seed] ✗ Error processing ${code}:`, error.message);
                errors.push({ code, error: error.message });
            }
        }

        // Update existing cities with country codes (for Brazil)
        console.log('\n[Seed] Updating existing cities with country codes...');

        const citiesUpdated = await sql`
            UPDATE cities
            SET country_code = 'BR'
            WHERE country = 'Brasil' OR country = 'Brazil'
            AND country_code IS NULL
        `;

        console.log(`[Seed] ✓ Updated ${citiesUpdated.length} cities with BR country code`);

        console.log('\n[Seed] ===============================================');
        console.log('[Seed] ✅ SEEDING COMPLETE');
        console.log('[Seed] ===============================================');
        console.log(`[Seed] Countries processed: ${entries.length}`);
        console.log(`[Seed] Successfully inserted/updated: ${inserted}`);
        console.log(`[Seed] Errors: ${errors.length}`);
        console.log(`[Seed] Cities updated: ${citiesUpdated.length}`);
        console.log('[Seed] ===============================================\n');

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
                success: true,
                message: 'Countries table seeded successfully',
                statistics: {
                    totalCountries: entries.length,
                    inserted: inserted,
                    errors: errors.length,
                    citiesUpdated: citiesUpdated.length
                },
                errors: errors.length > 0 ? errors : undefined,
                nextSteps: [
                    'Run /test-phase-2-caching to validate',
                    'Phase 2 (Database Caching) is now active',
                    'Ready to implement Phase 3 (API Integrations)'
                ]
            }),
        };

    } catch (error) {
        console.error('[Seed] ❌ Error:', error);

        return {
            statusCode: 500,
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                success: false,
                error: 'Seeding failed',
                message: error.message,
                details: error.toString()
            }),
        };
    }
};
