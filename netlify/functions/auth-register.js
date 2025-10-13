/**
 * ============================================================================
 * Netlify Function: Store Registration with Auto-Geocoding
 * ============================================================================
 *
 * This function registers a new store with automatic coordinate fetching.
 *
 * Flow:
 * 1. User provides address (lat/lng optional)
 * 2. System fetches coordinates from OpenCage API
 * 3. If user provided coords, validates them against geocoded coords
 * 4. Returns suggestion if coords don't match (user can confirm or update)
 * 5. Stores data in database
 *
 * Endpoint: /.netlify/functions/auth-register
 * Method: POST
 *
 * ABSOLUTE PATH: /Users/eros/Desktop/encarregado/netlify/functions/auth-register.js
 */

import { neon } from '@netlify/neon';
import { geocodeAddress, validateCoordinates } from './utils/geocoding_google.js';
import { findBusinessByAddress } from './utils/places_google.js';

const sql = neon(process.env.NETLIFY_DATABASE_URL); // uses NETLIFY_DATABASE_URL automatically

export const handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Method not allowed' }),
    };
  }

  try {
    const { username, store, confirmCoordinates, useGoogleData } = JSON.parse(event.body);

    // ========================================================================
    // STEP 1: Validate required fields
    // ========================================================================
    if (!username || !store?.nome || !store?.endereco || !store?.categoria) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Missing required fields',
          message: 'Required: username, store.nome, store.endereco, store.categoria',
          required: ['username', 'store.nome', 'store.endereco', 'store.categoria']
        }),
      };
    }

    // ========================================================================
    // STEP 2: Check Google Places for existing business data
    // ========================================================================
    console.log(`[Registration] Checking Google Places for business at: ${store.endereco}`);

    const placesResult = await findBusinessByAddress(store.endereco);

    if (placesResult.success && placesResult.found && !useGoogleData) {
      // Found a business in Google's database - ask user if they want to use it
      console.log(`[Registration] ✓ Found business in Google: ${placesResult.business.name}`);

      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          googleBusinessFound: true,
          message: 'Found an existing business at this address in Google database',
          googleData: {
            name: placesResult.business.name,
            address: placesResult.business.address,
            phone: placesResult.business.phone,
            website: placesResult.business.website,
            businessStatus: placesResult.business.businessStatus,
            location: placesResult.business.location
          },
          userProvidedData: {
            name: store.nome,
            address: store.endereco,
            phone: store.telefone || null,
            website: store.website || null
          },
          action: 'Please confirm which data to use',
          instructions: 'Resend request with useGoogleData: true (use Google data) or useGoogleData: false (use your data)'
        }),
      };
    }

    // Determine which data to use
    let finalStoreData = { ...store };
    let dataSource = 'user_provided';

    if (useGoogleData && placesResult.found) {
      // User chose to use Google's data
      console.log(`[Registration] Using Google's business data`);
      finalStoreData.nome = placesResult.business.name || store.nome;
      finalStoreData.telefone = placesResult.business.phone || store.telefone;
      finalStoreData.website = placesResult.business.website || store.website;
      dataSource = 'google_places';
    } else {
      console.log(`[Registration] Using user-provided data (Google: ${placesResult.found ? 'found but not used' : 'not found'})`);
    }

    // ========================================================================
    // STEP 3: Geocode the address automatically
    // ========================================================================
    console.log(`[Registration] Geocoding address: ${finalStoreData.endereco}`);

    const geocodeResult = await geocodeAddress(finalStoreData.endereco);

    if (!geocodeResult.success) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: 'Geocoding failed',
          message: 'Could not find coordinates for the provided address',
          details: geocodeResult.message,
          suggestion: 'Please verify the address includes street name and city',
          addressProvided: store.endereco
        }),
      };
    }

    const geocodedLat = geocodeResult.latitude;
    const geocodedLng = geocodeResult.longitude;
    const geocodedBairro = geocodeResult.components.bairro;
    const confidence = geocodeResult.confidence;

    console.log(`[Registration] ✓ Geocoded: ${geocodedLat}, ${geocodedLng} (confidence: ${confidence}/10)`);

    // ========================================================================
    // STEP 4: Handle user-provided coordinates (validation)
    // ========================================================================
    let finalLatitude = geocodedLat;
    let finalLongitude = geocodedLng;
    let coordinateValidation = null;

    if (finalStoreData.latitude != null && finalStoreData.longitude != null) {
      // User provided coordinates - validate them
      const userLat = parseFloat(finalStoreData.latitude);
      const userLng = parseFloat(finalStoreData.longitude);

      if (isNaN(userLat) || isNaN(userLng)) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Invalid coordinates',
            message: 'Latitude and longitude must be valid numbers'
          }),
        };
      }

      console.log(`[Registration] User provided coords: ${userLat}, ${userLng}`);

      // Validate against geocoded coordinates
      coordinateValidation = validateCoordinates(
        userLat,
        userLng,
        geocodedLat,
        geocodedLng,
        1 // 1km threshold
      );

      if (!coordinateValidation.isValid && !confirmCoordinates) {
        // Coordinates don't match - ask user to confirm
        console.log(`[Registration] ⚠ Coordinate mismatch: ${coordinateValidation.distanceKm}km away`);

        return {
          statusCode: 409, // Conflict
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: 'Coordinate validation required',
            message: 'The provided coordinates do not match the address',
            validation: {
              userProvided: {
                latitude: userLat,
                longitude: userLng
              },
              geocoded: {
                latitude: geocodedLat,
                longitude: geocodedLng,
                formatted: geocodeResult.formatted,
                confidence: confidence
              },
              distance: coordinateValidation.distance,
              distanceKm: coordinateValidation.distanceKm
            },
            action: 'Please confirm which coordinates to use',
            options: [
              {
                choice: 'use_geocoded',
                description: 'Use automatically geocoded coordinates (recommended)',
                coordinates: { latitude: geocodedLat, longitude: geocodedLng }
              },
              {
                choice: 'use_provided',
                description: 'Keep my provided coordinates',
                coordinates: { latitude: userLat, longitude: userLng },
                warning: 'These coordinates may not match the address'
              }
            ],
            instructions: 'Resend the request with confirmCoordinates: "use_geocoded" or "use_provided"'
          }),
        };
      }

      // User confirmed to use their coordinates despite mismatch
      if (confirmCoordinates === 'use_provided') {
        finalLatitude = userLat;
        finalLongitude = userLng;
        console.log(`[Registration] ✓ User confirmed to use provided coords`);
      } else {
        // Use geocoded (default or explicit confirmation)
        finalLatitude = geocodedLat;
        finalLongitude = geocodedLng;
        console.log(`[Registration] ✓ Using geocoded coords`);
      }
    }

    // Auto-detect bairro if not provided
    const finalBairro = finalStoreData.bairro || geocodedBairro;

    // ========================================================================
    // STEP 4.5: Check if this store was previously auto-added
    // ========================================================================
    // If the store exists with source='auto' and has the same google_place_id,
    // we should upgrade it to 'verified' instead of creating a duplicate
    let googlePlaceId = null;

    if (placesResult.found && placesResult.business.placeId) {
      googlePlaceId = placesResult.business.placeId;

      console.log(`[Registration] Checking if store with Place ID ${googlePlaceId} exists as auto-added...`);

      const existingAutoStore = await sql`
        SELECT id, nome, source, user_verified
        FROM lojas
        WHERE google_place_id = ${googlePlaceId}
        AND source = 'auto'
      `;

      if (existingAutoStore.length > 0) {
        // This store was auto-added! Upgrade it to 'verified'
        const storeId = existingAutoStore[0].id;
        console.log(`[Registration] 🧵 Found auto-added store (ID: ${storeId}). Upgrading to 'verified'...`);

        // Create user first
        const userResult = await sql`
          INSERT INTO users (username, role)
          VALUES (${username}, 'merchant')
          ON CONFLICT (username)
          DO UPDATE SET username = EXCLUDED.username
          RETURNING id
        `;
        const userId = userResult[0].id;

        // Update the existing store to 'verified'
        const upgradedStore = await sql`
          UPDATE lojas
          SET
            source = 'verified',
            user_verified = true,
            user_id = ${userId},
            nome = ${finalStoreData.nome},
            telefone = COALESCE(${finalStoreData.telefone}, telefone),
            website = COALESCE(${finalStoreData.website}, website)
          WHERE id = ${storeId}
          RETURNING id, nome, latitude, longitude, bairro, source, user_verified
        `;

        const verifiedStore = upgradedStore[0];
        console.log(`[Registration] ✅ Store upgraded to 'verified': ID ${verifiedStore.id}`);

        // Return early with verified status
        return {
          statusCode: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            success: true,
            upgraded: true,
            message: 'Auto-added store upgraded to user-verified! 🧵',
            store: {
              id: verifiedStore.id,
              nome: verifiedStore.nome,
              latitude: verifiedStore.latitude,
              longitude: verifiedStore.longitude,
              bairro: verifiedStore.bairro,
              source: verifiedStore.source,
              user_verified: verifiedStore.user_verified
            },
            dataSource: dataSource,
            geocoding: {
              source: coordinateValidation && !coordinateValidation.isValid && confirmCoordinates === 'use_provided'
                ? 'user_provided'
                : 'geocoded',
              confidence: confidence,
              formatted: geocodeResult.formatted,
              bairro: geocodedBairro
            }
          }),
        };
      }
    }

    // ========================================================================
    // STEP 5: Create user and store in database
    // ========================================================================
    console.log(`[Registration] Creating user: ${username}`);

    const userResult = await sql`
      INSERT INTO users (username, role)
      VALUES (${username}, 'merchant')
      ON CONFLICT (username)
      DO UPDATE SET username = EXCLUDED.username
      RETURNING id
    `;

    const userId = userResult[0].id;
    console.log(`[Registration] ✓ User ID: ${userId}`);

    // Insert the store
    const storeResult = await sql`
      INSERT INTO lojas (
        user_id, nome, endereco, telefone, website,
        latitude, longitude, bairro, categoria, source, google_place_id, user_verified
      )
      VALUES (
        ${userId},
        ${finalStoreData.nome},
        ${finalStoreData.endereco},
        ${finalStoreData.telefone || null},
        ${finalStoreData.website || null},
        ${finalLatitude},
        ${finalLongitude},
        ${finalBairro},
        ${finalStoreData.categoria},
        'user',
        ${googlePlaceId},
        false
      )
      RETURNING id, nome, latitude, longitude, bairro
    `;

    const createdStore = storeResult[0];
    console.log(`[Registration] ✓ Store created: ID ${createdStore.id}`);

    // ========================================================================
    // STEP 6: Return success response
    // ========================================================================
    return {
      statusCode: 201,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
      body: JSON.stringify({
        success: true,
        message: 'Store registered successfully',
        store: {
          id: createdStore.id,
          nome: createdStore.nome,
          latitude: createdStore.latitude,
          longitude: createdStore.longitude,
          bairro: createdStore.bairro
        },
        dataSource: dataSource,
        geocoding: {
          source: coordinateValidation && !coordinateValidation.isValid && confirmCoordinates === 'use_provided'
            ? 'user_provided'
            : 'geocoded',
          confidence: confidence,
          formatted: geocodeResult.formatted,
          bairro: geocodedBairro
        }
      }),
    };

  } catch (err) {
    console.error('[Registration] Error:', err);

    // Check for specific database errors
    let errorMessage = 'Failed to register store';
    let statusCode = 500;

    if (err.message.includes('duplicate key')) {
      errorMessage = 'A store with this name already exists';
      statusCode = 409;
    } else if (err.message.includes('foreign key')) {
      errorMessage = 'Invalid user reference';
      statusCode = 400;
    } else if (err.message.includes('violates not-null')) {
      errorMessage = 'Missing required database fields';
      statusCode = 400;
    }

    return {
      statusCode: statusCode,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: errorMessage,
        message: err.message,
        details: err.toString()
      }),
    };
  }
};
