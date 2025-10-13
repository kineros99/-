/**
 * ============================================================================
 * Google Maps Geocoding API
 * ============================================================================
 *
 * This module provides geocoding using Google Maps Geocoding API.
 * Google Maps provides highly accurate coordinates, especially for Brazilian addresses.
 *
 * Pricing (as of 2024):
 * - $5 per 1000 requests
 * - $200 free credit per month = 40,000 free requests/month
 *
 * Setup:
 * 1. Go to: https://console.cloud.google.com/
 * 2. Enable "Geocoding API"
 * 3. Create API key (restrict it to Geocoding API only)
 * 4. Add key to .env: GOOGLE_MAPS_API_KEY=your_key_here
 */

const GOOGLE_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const GOOGLE_GEOCODING_URL = 'https://maps.googleapis.com/maps/api/geocode/json';

/**
 * Calculate distance between two points in meters (Haversine formula)
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLng/2) * Math.sin(dLng/2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
}

/**
 * Extract address components from Google's response
 */
function extractComponents(addressComponents) {
    const components = {};

    const typeMapping = {
        sublocality_level_1: 'bairro',
        sublocality: 'bairro',
        neighborhood: 'bairro',
        administrative_area_level_2: 'city',
        locality: 'city',
        administrative_area_level_1: 'state',
        country: 'country',
        postal_code: 'postcode',
        route: 'road',
        street_number: 'houseNumber'
    };

    addressComponents.forEach(component => {
        for (const type of component.types) {
            if (typeMapping[type]) {
                components[typeMapping[type]] = component.long_name;
                break;
            }
        }
    });

    return components;
}

/**
 * Geocode an address using Google Maps Geocoding API
 */
export async function geocodeAddress(address, countryCode = 'br') {
    if (!address || typeof address !== 'string') {
        return {
            success: false,
            error: 'Invalid address provided',
            message: 'Address must be a non-empty string'
        };
    }

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing or invalid. Please add GOOGLE_MAPS_API_KEY to .env file.'
        };
    }

    try {
        // Build the API request URL
        const params = new URLSearchParams({
            address: address,
            key: GOOGLE_API_KEY,
            language: 'pt-BR',
            region: countryCode
        });

        const url = `${GOOGLE_GEOCODING_URL}?${params.toString()}`;

        console.log(`[Geocoding - Google] Requesting coordinates for: "${address}"`);

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Maps API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();

        // Check API status
        if (data.status !== 'OK') {
            const errorMessages = {
                'ZERO_RESULTS': 'No results found for the provided address',
                'OVER_QUERY_LIMIT': 'API quota exceeded. Please check your Google Cloud Console.',
                'REQUEST_DENIED': 'API request denied. Check your API key and restrictions.',
                'INVALID_REQUEST': 'Invalid request. Please check the address format.',
                'UNKNOWN_ERROR': 'Server error. Please try again.'
            };

            return {
                success: false,
                error: 'Geocoding API error',
                message: errorMessages[data.status] || `Google API returned status: ${data.status}`,
                code: data.status
            };
        }

        // Get the first result (most accurate)
        const result = data.results[0];
        const location = result.geometry.location;
        const components = extractComponents(result.address_components);

        console.log(`[Geocoding - Google] ✓ Found: ${location.lat}, ${location.lng}`);
        console.log(`[Geocoding - Google] Location type: ${result.geometry.location_type}`);

        // Google's location_type indicates accuracy:
        // ROOFTOP: Most accurate (exact address)
        // RANGE_INTERPOLATED: Interpolated between two points
        // GEOMETRIC_CENTER: Center of a location (street, neighborhood, etc.)
        // APPROXIMATE: Approximate location
        const confidenceMap = {
            'ROOFTOP': 10,
            'RANGE_INTERPOLATED': 9,
            'GEOMETRIC_CENTER': 8,
            'APPROXIMATE': 6
        };

        const confidence = confidenceMap[result.geometry.location_type] || 7;

        // Extract useful information
        const geocodedData = {
            success: true,
            latitude: location.lat,
            longitude: location.lng,
            formatted: result.formatted_address,
            confidence: confidence,
            components: {
                bairro: components.bairro || null,
                city: components.city || null,
                state: components.state || null,
                country: components.country || null,
                postcode: components.postcode || null,
                road: components.road || null,
                houseNumber: components.houseNumber || null
            },
            bounds: result.geometry.bounds,
            locationType: result.geometry.location_type,
            placeId: result.place_id,
            provider: 'Google Maps'
        };

        return geocodedData;

    } catch (error) {
        console.error('[Geocoding - Google] Error:', error);
        return {
            success: false,
            error: 'Geocoding request failed',
            message: error.message,
            details: error.toString()
        };
    }
}

/**
 * Validate coordinates against geocoded address
 */
export function validateCoordinates(userLat, userLng, geocodedLat, geocodedLng, thresholdKm = 1) {
    const distance = calculateDistance(userLat, userLng, geocodedLat, geocodedLng);

    const isValid = distance <= thresholdKm * 1000; // Convert km to meters

    return {
        isValid,
        distance: Math.round(distance), // in meters
        distanceKm: parseFloat((distance / 1000).toFixed(3)),
        suggestion: !isValid ? {
            message: `The provided coordinates are ${Math.round(distance)}m away from the geocoded address.`,
            recommendedLatitude: geocodedLat,
            recommendedLongitude: geocodedLng,
            userProvidedLatitude: userLat,
            userProvidedLongitude: userLng
        } : null
    };
}

/**
 * Reverse geocode - convert coordinates to address
 */
export async function reverseGeocode(latitude, longitude) {
    if (typeof latitude !== 'number' || typeof longitude !== 'number') {
        return {
            success: false,
            error: 'Invalid coordinates',
            message: 'Latitude and longitude must be numbers'
        };
    }

    if (!GOOGLE_API_KEY || GOOGLE_API_KEY === 'your_google_api_key_here') {
        return {
            success: false,
            error: 'API key not configured',
            message: 'Google Maps API key is missing or invalid'
        };
    }

    try {
        const params = new URLSearchParams({
            latlng: `${latitude},${longitude}`,
            key: GOOGLE_API_KEY,
            language: 'pt-BR'
        });

        const url = `${GOOGLE_GEOCODING_URL}?${params.toString()}`;
        const response = await fetch(url);

        if (!response.ok) {
            throw new Error(`Google Maps API error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status !== 'OK' || !data.results || data.results.length === 0) {
            return {
                success: false,
                error: 'No address found',
                message: 'Could not find address for the provided coordinates'
            };
        }

        const result = data.results[0];

        return {
            success: true,
            formatted: result.formatted_address,
            components: extractComponents(result.address_components),
            placeId: result.place_id
        };

    } catch (error) {
        console.error('[Reverse Geocoding - Google] Error:', error);
        return {
            success: false,
            error: 'Reverse geocoding failed',
            message: error.message
        };
    }
}
