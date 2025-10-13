# OpenCage Geocoding Integration - Complete Guide

## Overview

Your application now has **automatic geocoding** powered by OpenCage Geocoder API. When users register a new store, the system automatically fetches latitude and longitude coordinates from the address.

---

## How It Works

### Automatic Coordinate Fetching

```
User enters address
      ↓
System calls OpenCage API
      ↓
Receives lat/lng + confidence score
      ↓
Automatically populates coordinates
      ↓
Store saved to database
```

### Validation Flow (When User Provides Coordinates)

```
User provides address + coordinates
      ↓
System fetches geocoded coordinates
      ↓
Compares user coords vs geocoded coords
      ↓
Distance > 1km?
      ├─ NO  → Use geocoded coordinates
      └─ YES → Ask user to confirm
               ├─ Option 1: Use geocoded (recommended)
               └─ Option 2: Keep provided coordinates
```

---

## API Configuration

### OpenCage API Key
**Location**: `/Users/eros/Desktop/encarregado/.env`

```env
OPENCAGE_API_KEY=684bb78d199749b78bb037bd93963a15
```

### API Limits
- **Free Tier**: 2,500 requests/day
- **Rate Limit**: 1 request/second
- **Coverage**: Worldwide

---

## File Structure

```
/Users/eros/Desktop/encarregado/
│
├── .env                                              # Contains OPENCAGE_API_KEY
│
├── netlify/functions/
│   ├── utils/
│   │   └── geocoding.js                             # ⭐ Geocoding utility module
│   │
│   ├── auth-register.js                              # Store registration with auto-geocoding
│   ├── get-lojas.js                                  # Retrieve stores
│   └── init_db.js                                    # Initialize database
│
└── public/
    └── script.js                                     # Frontend with validation flow
```

---

## Geocoding Module Functions

### File: `netlify/functions/utils/geocoding.js`

#### 1. `geocodeAddress(address, countryCode = 'br')`

Fetches coordinates for a given address.

**Parameters:**
- `address` (string): Full address (e.g., "Rua Exemplo 123, Rio de Janeiro")
- `countryCode` (string, optional): ISO country code (default: 'br' for Brazil)

**Returns:**
```javascript
{
  success: true,
  latitude: -22.98492,
  longitude: -43.20378,
  formatted: "Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro, Brazil",
  confidence: 10,  // 0-10 scale (10 = highest confidence)
  components: {
    bairro: "Ipanema",
    city: "Rio de Janeiro",
    state: "Rio de Janeiro",
    country: "Brazil",
    postcode: "22420-040",
    road: "Rua Farme de Amoedo",
    houseNumber: "107"
  },
  bounds: { ... },  // Geographic boundaries
  what3words: "..."  // what3words address
}
```

**Example:**
```javascript
import { geocodeAddress } from './utils/geocoding.js';

const result = await geocodeAddress("Rua Farme de Amoedo 107, Rio de Janeiro");
if (result.success) {
  console.log(`Lat: ${result.latitude}, Lng: ${result.longitude}`);
  console.log(`Confidence: ${result.confidence}/10`);
}
```

#### 2. `validateCoordinates(userLat, userLng, geocodedLat, geocodedLng, thresholdKm = 1)`

Validates user-provided coordinates against geocoded coordinates.

**Parameters:**
- `userLat`, `userLng`: User-provided coordinates
- `geocodedLat`, `geocodedLng`: Geocoded coordinates
- `thresholdKm`: Maximum acceptable distance in km (default: 1)

**Returns:**
```javascript
{
  isValid: false,
  distance: 1523,  // meters
  distanceKm: 1.523,
  suggestion: {
    message: "The provided coordinates are 1523m away from the geocoded address.",
    recommendedLatitude: -22.98492,
    recommendedLongitude: -43.20378,
    userProvidedLatitude: -22.97000,
    userProvidedLongitude: -43.19000
  }
}
```

#### 3. `reverseGeocode(latitude, longitude)`

Gets address from coordinates (reverse geocoding).

**Example:**
```javascript
const result = await reverseGeocode(-22.98492, -43.20378);
// Returns: "Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro, Brazil"
```

#### 4. `calculateDistance(lat1, lon1, lat2, lon2)`

Calculates distance between two coordinate points using Haversine formula.

**Returns:** Distance in kilometers

---

## Registration Flow

### Endpoint: `POST /.netlify/functions/auth-register`

### Request Body

#### Option 1: Address Only (Automatic Geocoding)
```json
{
  "username": "merchant_name",
  "store": {
    "nome": "Loja Exemplo",
    "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
    "categoria": "Loja de materiais de construção",
    "telefone": "(21) 1234-5678",
    "website": "www.exemplo.com"
  }
}
```

**What Happens:**
1. System geocodes "Rua Farme de Amoedo 107, Rio de Janeiro"
2. Fetches coordinates automatically
3. Auto-detects bairro (Ipanema)
4. Stores everything in database

#### Option 2: Address + User Coordinates (With Validation)
```json
{
  "username": "merchant_name",
  "store": {
    "nome": "Loja Exemplo",
    "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
    "categoria": "Loja de materiais de construção",
    "telefone": "(21) 1234-5678",
    "website": "www.exemplo.com",
    "latitude": -22.97000,
    "longitude": -43.19000
  }
}
```

**What Happens:**
1. System geocodes the address
2. Compares user coords vs geocoded coords
3. If distance > 1km, returns validation request (409 status)
4. User must confirm which coordinates to use

### Response: Validation Required (409)

```json
{
  "error": "Coordinate validation required",
  "message": "The provided coordinates do not match the address",
  "validation": {
    "userProvided": {
      "latitude": -22.97000,
      "longitude": -43.19000
    },
    "geocoded": {
      "latitude": -22.98492,
      "longitude": -43.20378,
      "formatted": "Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro, Brazil",
      "confidence": 10
    },
    "distance": 1523,
    "distanceKm": 1.523
  },
  "action": "Please confirm which coordinates to use",
  "options": [
    {
      "choice": "use_geocoded",
      "description": "Use automatically geocoded coordinates (recommended)",
      "coordinates": { "latitude": -22.98492, "longitude": -43.20378 }
    },
    {
      "choice": "use_provided",
      "description": "Keep my provided coordinates",
      "coordinates": { "latitude": -22.97000, "longitude": -43.19000 },
      "warning": "These coordinates may not match the address"
    }
  ],
  "instructions": "Resend the request with confirmCoordinates: 'use_geocoded' or 'use_provided'"
}
```

### Confirming Coordinates

Resend the request with `confirmCoordinates`:

```json
{
  "username": "merchant_name",
  "store": { ... },
  "confirmCoordinates": "use_geocoded"  // or "use_provided"
}
```

### Success Response (201)

```json
{
  "success": true,
  "message": "Store registered successfully",
  "store": {
    "id": 12,
    "nome": "Loja Exemplo",
    "latitude": -22.98492,
    "longitude": -43.20378,
    "bairro": "Ipanema"
  },
  "geocoding": {
    "source": "geocoded",  // or "user_provided"
    "confidence": 10,
    "formatted": "Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro, Brazil",
    "bairro": "Ipanema"
  }
}
```

---

## Frontend Integration

The frontend (`public/script.js`) automatically handles the validation flow:

1. **User submits form** with only address
2. **Backend geocodes** and returns coordinates
3. **Store is created** with automatic coordinates

**OR**

1. **User submits form** with address + coordinates
2. **Backend validates** coordinates
3. If mismatch detected:
   - Shows validation dialog with 2 options
   - User clicks button to choose
   - Form resubmits automatically with choice
4. **Store is created** with chosen coordinates

---

## Testing

### Test 1: Automatic Geocoding (No Coordinates Provided)

```bash
curl -X POST http://localhost:8888/.netlify/functions/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_merchant",
    "store": {
      "nome": "Teste Auto Geocoding",
      "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
      "categoria": "Loja de materiais de construção"
    }
  }'
```

**Expected:** Success with geocoded coordinates.

### Test 2: Correct User Coordinates (No Validation Needed)

```bash
curl -X POST http://localhost:8888/.netlify/functions/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_merchant",
    "store": {
      "nome": "Teste Coords Corretas",
      "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
      "categoria": "Loja de materiais de construção",
      "latitude": -22.98492,
      "longitude": -43.20378
    }
  }'
```

**Expected:** Success (coordinates match, no validation needed).

### Test 3: Incorrect Coordinates (Validation Required)

```bash
curl -X POST http://localhost:8888/.netlify/functions/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_merchant",
    "store": {
      "nome": "Teste Coords Incorretas",
      "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
      "categoria": "Loja de materiais de construção",
      "latitude": -22.95000,
      "longitude": -43.18000
    }
  }'
```

**Expected:** 409 status with validation options.

### Test 4: Confirm Geocoded Coordinates

```bash
curl -X POST http://localhost:8888/.netlify/functions/auth-register \
  -H "Content-Type: application/json" \
  -d '{
    "username": "test_merchant",
    "store": {
      "nome": "Teste Confirma Geocoded",
      "endereco": "Rua Farme de Amoedo 107, Rio de Janeiro",
      "categoria": "Loja de materiais de construção",
      "latitude": -22.95000,
      "longitude": -43.18000
    },
    "confirmCoordinates": "use_geocoded"
  }'
```

**Expected:** Success with geocoded coordinates.

---

## Error Handling

### Geocoding Fails

```json
{
  "error": "Geocoding failed",
  "message": "Could not find coordinates for the provided address",
  "details": "No results found",
  "suggestion": "Please verify the address includes street name and city",
  "addressProvided": "..."
}
```

**Solution:** User should verify and correct the address.

### API Key Missing

```json
{
  "success": false,
  "error": "API key not configured",
  "message": "OpenCage API key is missing or invalid"
}
```

**Solution:** Verify `OPENCAGE_API_KEY` in `.env` file.

### Rate Limit Exceeded

OpenCage returns 402 status when rate limit is exceeded.

**Solution:**
- Wait for limit reset (daily)
- Upgrade to paid plan
- Implement caching for common addresses

---

## Best Practices

### 1. Always Provide Complete Addresses

✅ Good: `"Rua Farme de Amoedo 107, Rio de Janeiro"`
❌ Bad: `"Rua Farme de Amoedo 107"` (missing city)

### 2. Include Neighborhood When Known

This helps with more accurate geocoding:
```json
{
  "endereco": "Rua Farme de Amoedo 107, Ipanema, Rio de Janeiro"
}
```

### 3. Trust Geocoded Coordinates

The system's geocoded coordinates are usually more accurate than user-provided ones. Always recommend "use_geocoded" option.

### 4. Cache Common Addresses

If you have many stores at the same address, consider caching geocoding results to save API calls.

---

## Database Schema

The `lojas` table stores both address and coordinates:

```sql
CREATE TABLE lojas (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id),
  nome TEXT NOT NULL,
  endereco TEXT NOT NULL,
  telefone TEXT,
  website TEXT,
  latitude NUMERIC NOT NULL,  -- Auto-populated by geocoding
  longitude NUMERIC NOT NULL, -- Auto-populated by geocoding
  bairro TEXT,                -- Auto-detected from geocoding
  categoria TEXT
);
```

---

## Security Notes

### API Key Protection

⚠️ **IMPORTANT**: Your OpenCage API key (`684bb78d199749b78bb037bd93963a15`) should be kept secure:

1. ✅ Stored in `.env` (not committed to git)
2. ✅ Accessed via `process.env.OPENCAGE_API_KEY`
3. ❌ Never expose in frontend JavaScript
4. ❌ Never commit to GitHub

### `.gitignore` Configuration

Ensure your `.gitignore` includes:
```
.env
.env.local
```

---

## Troubleshooting

### "Could not find coordinates"

**Cause:** Address is too vague or doesn't exist.

**Solution:**
- Add more details (street number, city name)
- Check for typos
- Verify address exists

### "Coordinate validation required" Every Time

**Cause:** User-provided coordinates are always wrong.

**Solution:**
- Let the system geocode automatically
- Don't provide latitude/longitude in the request

### Geocoding is Slow

**Cause:** OpenCage API has latency (~200-500ms per request).

**Solution:**
- This is normal - show loading indicator
- Consider caching results for common addresses

---

## Summary

✅ **Automatic geocoding** - Just provide address, get coordinates
✅ **Validation flow** - Detects incorrect user coordinates
✅ **User choice** - Option to keep or update coordinates
✅ **High accuracy** - OpenCage provides confidence scores
✅ **Neighborhood detection** - Auto-detects bairro from address
✅ **Error handling** - Clear messages for all edge cases

**Your geocoding system is production-ready!** 🎉
