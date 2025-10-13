# 🤖 AI ASSISTANT CONTEXT FOR ENCARREGADO PROJECT
## COMPREHENSIVE PROJECT KNOWLEDGE BASE

> **PURPOSE:** This document provides complete project context to enable AI assistants to understand and work with the Encarregado project immediately, without requiring the user to explain piece-by-piece.

---

## 🎯 PROJECT OVERVIEW

**Name:** Encarregado
**Type:** Multi-Country Construction Materials Store Locator
**Stack:** Netlify Functions + Neon PostgreSQL + Google Maps/Places APIs + Leaflet.js
**Purpose:** Discover and map construction material stores across multiple countries with automated store population

### Key Features
1. **Multi-Country Support:** Works with any country (case-insensitive)
2. **Auto-Population:** Automatically discover stores via Google Places API
3. **Dynamic City Discovery:** Add new cities on-the-fly
4. **Scoped Search:** Target specific neighborhoods with adaptive limits
5. **Duplicate Prevention:** Uses google_place_id UNIQUE constraint

---

## 📁 PROJECT ARCHITECTURE

```
encarregado/
├── netlify/functions/          # Backend (15 serverless functions)
│   ├── init-database.js        # ⭐ Database initialization
│   ├── discover-city.js        # City discovery (Google Geocoding)
│   ├── discover-neighborhoods.js # Neighborhood discovery
│   ├── auto-populate-city.js   # City-specific store population (111 max)
│   ├── auto-populate-stores.js # Global store population (legacy)
│   ├── scoped-auto-populate.js # Neighborhood-targeted (666/20/18 limits)
│   ├── get-lojas.js            # Fetch stores
│   ├── get-cities.js           # Fetch cities
│   ├── get-neighborhoods.js    # Fetch neighborhoods
│   └── utils/
│       └── places_nearby_google.js # Google Places API wrapper
│
├── public/                     # Frontend
│   ├── index.html              # Main map interface
│   ├── script.js               # Map logic
│   ├── admin.html              # Global auto-populate UI
│   ├── admin.js                # Admin logic
│   ├── admin-scoped.html       # Scoped auto-populate UI
│   └── admin-scoped.js         # Scoped admin logic
│
├── tools/
│   ├── diagnostics/            # ⭐ THIS DIAGNOSTIC SYSTEM
│   └── scripts/                # Database migration scripts
│
├── package.json
├── .env                        # Environment variables (not in git)
└── README.md
```

---

## 🗄️ DATABASE SCHEMA

### Tables

#### 1. **cities** (Multi-country city catalog)
```sql
CREATE TABLE cities (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL DEFAULT 'Brasil',
    center_lat NUMERIC(10, 7) NOT NULL,
    center_lng NUMERIC(10, 7) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(name, state, country)  -- Prevents duplicate cities
);
```

**Purpose:** Stores cities available for scoped auto-population
**Key Feature:** Case-insensitive matching via `LOWER(c.name) = LOWER($input)`

#### 2. **neighborhoods** (Zones within cities)
```sql
CREATE TABLE neighborhoods (
    id SERIAL PRIMARY KEY,
    city_id INTEGER NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    center_lat NUMERIC(10, 7) NOT NULL,
    center_lng NUMERIC(10, 7) NOT NULL,
    radius INTEGER NOT NULL DEFAULT 3000,  -- Search radius in meters
    apuration_count INTEGER NOT NULL DEFAULT 0,  -- Controls store limits
    last_apuration_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(city_id, name)
);
```

**Purpose:** Defines search zones for Google Places API
**Key Feature:** `apuration_count` determines dynamic store limits

#### 3. **lojas** (Stores)
```sql
CREATE TABLE lojas (
    id SERIAL PRIMARY KEY,
    user_id INT REFERENCES users(id),
    nome TEXT NOT NULL,
    endereco TEXT,
    telefone TEXT,
    website TEXT,
    latitude NUMERIC NOT NULL,
    longitude NUMERIC NOT NULL,
    bairro TEXT,  -- Neighborhood name
    categoria TEXT DEFAULT 'Material de Construção',
    source VARCHAR(20) DEFAULT 'user',  -- 'user' or 'auto'
    google_place_id VARCHAR(255),  -- ⭐ For duplicate prevention
    created_at TIMESTAMP DEFAULT NOW(),
    UNIQUE INDEX idx_lojas_google_place_id ON google_place_id WHERE google_place_id IS NOT NULL
);
```

**Purpose:** Stores (both user-added and auto-populated)
**Key Feature:** `source` distinguishes user vs auto-added stores

#### 4. **users**
```sql
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    role TEXT NOT NULL
);
```

#### 5. **auto_population_runs** (Audit log)
```sql
CREATE TABLE auto_population_runs (
    id SERIAL PRIMARY KEY,
    run_date TIMESTAMP DEFAULT NOW(),
    stores_added INTEGER NOT NULL DEFAULT 0,
    stores_skipped INTEGER NOT NULL DEFAULT 0,
    api_calls_used INTEGER NOT NULL DEFAULT 0,
    estimated_cost DECIMAL(10, 4) DEFAULT 0.00,
    status VARCHAR(50) DEFAULT 'completed',
    execution_time_ms INTEGER,
    scope_type VARCHAR(50) DEFAULT 'global',  -- 'global' or 'scoped'
    city_id INTEGER REFERENCES cities(id),
    neighborhood_id INTEGER REFERENCES neighborhoods(id)
);
```

### Views

#### **store_statistics** (Quick stats)
```sql
CREATE OR REPLACE VIEW store_statistics AS
SELECT
    COUNT(*) FILTER (WHERE source = 'user') as user_added_count,
    COUNT(*) FILTER (WHERE source = 'auto') as auto_added_count,
    COUNT(*) as total_stores
FROM lojas;
```

---

## 📡 API ENDPOINTS (15 Functions)

### 1. ⭐ init-database
**Endpoint:** `/.netlify/functions/init-database`
**Method:** GET or POST
**Auth:** None
**Purpose:** Initialize ALL database tables, indexes, views (idempotent)

**Response:**
```json
{
  "success": true,
  "statistics": {
    "users": 1,
    "stores": 0,
    "cities": 0,
    "neighborhoods": 0,
    "populationRuns": 0
  },
  "tables": ["users", "lojas", "cities", "neighborhoods", "auto_population_runs"],
  "views": ["store_statistics"]
}
```

**Common Issues:**
- Already exists errors → Safe to ignore (idempotent)

**Example:**
```bash
curl http://localhost:8888/.netlify/functions/init-database
```

---

### 2. discover-city
**Endpoint:** `/.netlify/functions/discover-city`
**Method:** POST
**Auth:** None
**Purpose:** Find and add city using Google Geocoding API (case-insensitive)

**Request:**
```json
{
  "cityName": "orlando",
  "countryName": "united states of america"  // Optional, defaults to "Brasil"
}
```

**Response:**
```json
{
  "success": true,
  "city": {
    "id": 2,
    "name": "Orlando",
    "state": "Florida",
    "country": "United States",
    "center_lat": 28.5383,
    "center_lng": -81.3792,
    "neighborhood_count": 0
  },
  "message": "City discovered and added to database",
  "alreadyExists": false
}
```

**Common Issues:**
- City not found → Check spelling, try alternative names
- Case sensitivity → ✅ Already handled (uses `LOWER()`)

**Country Normalization:**
- "united states of america", "USA", "usa", "US" → All work!
- Mapped to ISO code `US` and language `en-US`

**Example:**
```bash
curl -X POST http://localhost:8888/.netlify/functions/discover-city \
  -H "Content-Type: application/json" \
  -d '{"cityName": "orlando", "countryName": "united states"}'
```

---

### 3. discover-neighborhoods
**Endpoint:** `/.netlify/functions/discover-neighborhoods`
**Method:** POST
**Auth:** None
**Purpose:** Auto-discover neighborhoods for a city using Google Places Text Search

**Request:**
```json
{
  "cityId": 2
}
```

**Response:**
```json
{
  "success": true,
  "neighborhoods": [
    {
      "id": 1,
      "name": "Downtown Orlando",
      "center_lat": 28.5383,
      "center_lng": -81.3792,
      "radius": 3000,
      "apuration_count": 0,
      "next_limit": 666
    }
  ],
  "count": 25,
  "message": "25 neighborhoods discovered for Orlando, Florida"
}
```

**Common Issues:**
- No neighborhoods found → Creates default "Centro" neighborhood
- Too few neighborhoods → Google limitation, manual addition needed

---

### 4. ⭐ auto-populate-city
**Endpoint:** `/.netlify/functions/auto-populate-city`
**Method:** POST
**Auth:** Password required
**Purpose:** Auto-populate stores for specific city (any country) - 111 store limit

**Request:**
```json
{
  "password": "your_admin_password",
  "cityId": 2
}
```

**Response:**
```json
{
  "success": true,
  "message": "Auto-population completed for Orlando, Florida",
  "city": {
    "id": 2,
    "name": "Orlando",
    "state": "Florida",
    "country": "United States"
  },
  "results": {
    "storesAdded": 87,
    "storesSkipped": 24,
    "apiCallsUsed": 12,
    "estimatedCost": "$0.3840",
    "executionTimeMs": 8942
  },
  "statistics": {
    "userAddedCount": 8,
    "autoAddedCount": 469,
    "totalStores": 477
  }
}
```

**Store Limit:** 111 stores maximum per run

**Common Issues:**
- 0 stores added → All stores already in database (duplicates)
- Password error → Check `ADMIN_PASSWORD` in .env

**Example:**
```bash
curl -X POST http://localhost:8888/.netlify/functions/auto-populate-city \
  -H "Content-Type: application/json" \
  -d '{"password": "123", "cityId": 2}'
```

---

### 5. scoped-auto-populate
**Endpoint:** `/.netlify/functions/scoped-auto-populate`
**Method:** POST
**Auth:** Password required
**Purpose:** Precise neighborhood-targeted auto-population with adaptive limits

**Request:**
```json
{
  "password": "your_admin_password",
  "neighborhood_ids": [1, 2, 3]
}
```

**Store Limit Logic (Based on apuration_count):**
- **1st apuration:** 666 stores
- **2nd-6th apurations:** 20 stores each
- **7th+ apurations:** 18 stores each

**Why Adaptive Limits?**
- First search captures bulk of stores
- Subsequent searches find newly opened stores
- Prevents API waste on empty searches

**Response:**
```json
{
  "success": true,
  "summary": {
    "neighborhoods_searched": 3,
    "stores_added": 42,
    "stores_skipped": 15,
    "api_calls_used": 3,
    "estimated_cost": "$0.0960"
  },
  "neighborhoods": [
    {
      "neighborhood_id": 1,
      "neighborhood_name": "Downtown Orlando",
      "stores_added": 15,
      "stores_skipped": 5,
      "api_calls": 1
    }
  ]
}
```

---

### 6-15. Other Endpoints

**get-lojas** - Fetch stores (optionally filtered by neighborhood)
**get-cities** - List all cities
**get-neighborhoods** - List neighborhoods for a city
**auto-populate-stores** - Global Rio-specific (legacy, now uses generic searchAllZones)

---

## 🔧 UTILITY FUNCTIONS

### searchAllZones() (Generic Multi-Country Search)
**File:** `netlify/functions/utils/places_nearby_google.js`

```javascript
export async function searchAllZones(
    maxStores = 111,
    existingPlaceIds = [],
    zones = null,
    countryName = 'Brasil'
)
```

**Purpose:** Search multiple neighborhoods/zones up to store limit
**Key Features:**
- Works with any country (dynamic language/region codes)
- Accepts custom zones array (from database)
- Prevents duplicates via existingPlaceIds
- Returns stores + statistics

**Example:**
```javascript
const result = await searchAllZones(111, existingPlaceIds, neighborhoods, 'United States');
// Returns: { success, stores[], statistics: { storesFound, storesSkipped, apiCallsUsed, estimatedCost } }
```

---

### getCountryConfig() (Country Normalization)
**File:** `netlify/functions/utils/places_nearby_google.js:69-90`

```javascript
function getCountryConfig(countryName) {
    const normalized = countryName.toLowerCase().trim();
    const countryMap = {
        'brasil': { code: 'BR', language: 'pt-BR' },
        'brazil': { code: 'BR', language: 'pt-BR' },
        'united states': { code: 'US', language: 'en-US' },
        'united states of america': { code: 'US', language: 'en-US' },
        'usa': { code: 'US', language: 'en-US' },
        'us': { code: 'US', language: 'en-US' },
        'argentina': { code: 'AR', language: 'es-AR' },
        // ... more countries
    };
    return countryMap[normalized] || { code: 'BR', language: 'pt-BR' };
}
```

**Purpose:** Map country names (any case) to ISO codes + languages
**Key Feature:** Case-insensitive, supports multiple name variations

**To Add New Country:**
```javascript
'germany': { code: 'DE', language: 'de-DE' },
'deutschland': { code: 'DE', language: 'de-DE' }
```

---

## 🎯 COMMON USER INTENTS & SOLUTIONS

### Intent: "Test with Orlando, USA"
**Full Workflow:**

```bash
# Step 1: Initialize database
curl http://localhost:8888/.netlify/functions/init-database

# Step 2: Discover city (case-insensitive!)
curl -X POST http://localhost:8888/.netlify/functions/discover-city \
  -H "Content-Type: application/json" \
  -d '{"cityName": "orlando", "countryName": "united states of america"}'
# Returns cityId: 2

# Step 3: Neighborhoods auto-discovered automatically

# Step 4: Run auto-population
curl -X POST http://localhost:8888/.netlify/functions/auto-populate-city \
  -H "Content-Type: application/json" \
  -d '{"password": "123", "cityId": 2}'
```

**Result:** Up to 111 stores added for Orlando across all neighborhoods

---

### Intent: "All stores showing as duplicates (0 additions)"
**Explanation:** All returned stores already exist in database

**Verification:**
```sql
SELECT COUNT(*) FROM lojas WHERE google_place_id IS NOT NULL;
-- Shows existing stores

SELECT stores_skipped FROM auto_population_runs ORDER BY run_date DESC LIMIT 1;
-- Shows how many were duplicates
```

**This is CORRECT behavior** - duplicate prevention working as designed!

---

### Intent: "Add support for Germany"
**Solution:**

1. Edit `netlify/functions/utils/places_nearby_google.js`
2. Add to countryMap (line ~85):
```javascript
'germany': { code: 'DE', language: 'de-DE' },
'deutschland': { code: 'DE', language: 'de-DE' }
```
3. No other changes needed - fully dynamic!

---

### Intent: "Change store limits"
**For Global Auto-Populate (111 limit):**
Edit `auto-populate-city.js:155`
```javascript
const searchResult = await searchAllZones(200, existingPlaceIds, neighborhoods, city.country);
//                                        ^^^
```

**For Scoped Apuration (666/20/18 limits):**
Edit `scoped-auto-populate.js:31-36` or `get-neighborhoods.js:7-12`
```javascript
function calculateStoreLimit(apurationCount) {
    if (apurationCount === 0) return 1000;  // Changed from 666
    if (apurationCount >= 1 && apurationCount <= 5) return 50;  // Changed from 20
    if (apurationCount >= 6) return 30;  // Changed from 18
    return 666;
}
```

---

## ⚠️ COMMON ERROR PATTERNS & FIXES

### Error: "City not found"
**Cause:** Google Geocoding API couldn't locate city

**Debugging:**
1. Check spelling
2. Try alternative names: "NYC" vs "New York" vs "New York City"
3. Verify GOOGLE_MAPS_API_KEY in .env

**Fix:**
```bash
# Try different variations
curl -X POST ... -d '{"cityName": "New York City"}'
curl -X POST ... -d '{"cityName": "NYC"}'
curl -X POST ... -d '{"cityName": "New York", "countryName": "United States"}'
```

---

### Error: "No neighborhoods available for this city"
**Cause:** Google Places Text Search found nothing OR city exists without neighborhoods

**Fix:**
System automatically creates default "Centro" neighborhood as fallback

**Manual Fix:**
```sql
INSERT INTO neighborhoods (city_id, name, center_lat, center_lng, radius)
VALUES (2, 'Downtown', 28.5383, -81.3792, 5000);
```

---

### Error: "google_place_id already exists"
**Cause:** Trying to insert duplicate store

**Fix:**
Already handled! Uses `ON CONFLICT (google_place_id) DO NOTHING`

**No action needed** - this is correct duplicate prevention

---

### Error: "ADMIN_PASSWORD not configured"
**Cause:** Missing env variable

**Fix:**
```bash
# Add to .env
ADMIN_PASSWORD=your_secure_password_here
```

---

### Error: "GOOGLE_MAPS_API_KEY not configured"
**Cause:** Missing or invalid API key

**Fix:**
```bash
# Add to .env
GOOGLE_MAPS_API_KEY=AIzaSyB...your_actual_key

# Verify key has these APIs enabled:
# - Geocoding API
# - Places API (New)
```

---

## 🚀 QUICK START COMMANDS

```bash
# 1. Install dependencies
npm install

# 2. Start dev server
netlify dev
# Runs at http://localhost:8888

# 3. Initialize database
curl http://localhost:8888/.netlify/functions/init-database

# 4. Test with Orlando
curl -X POST http://localhost:8888/.netlify/functions/discover-city \
  -H "Content-Type: application/json" \
  -d '{"cityName": "orlando", "countryName": "usa"}'

# 5. Auto-populate (get cityId from step 4)
curl -X POST http://localhost:8888/.netlify/functions/auto-populate-city \
  -H "Content-Type: application/json" \
  -d '{"password": "123", "cityId": 2}'
```

---

## 💡 IMPORTANT FOR AI ASSISTANTS

### Key Principles
1. **All country names are case-insensitive** - normalized via `toLowerCase()`
2. **City matching uses LOWER()** in database queries
3. **Store limit is 111** for global, **666/20/18** for scoped apuration
4. **Duplicates prevented** via `google_place_id` UNIQUE constraint
5. **All functions return consistent JSON:** `{ success, data/error, message }`

### When User Says "It doesn't work"
**Ask these diagnostic questions:**

1. "Did you run `init-database` first?"
2. "What's the exact error message?"
3. "Can you show the request/response?"
4. "Are all env variables set?"
5. "Did you check if stores already exist (duplicates)?"

### When User Wants to Add Feature
**Before coding, check:**

1. Does function already exist? (15 functions available)
2. Is it configurable? (many limits are parameterized)
3. Is it in database? (check tables/views)
4. Can existing function be modified? (prefer editing over new creation)

---

## 📊 DIAGNOSTIC REPORT INTEGRATION

This AI context was generated by the **Universal Diagnostic System**.

**Current Health Score:** {{HEALTH_SCORE}}/100
**Issues Found:** {{ISSUE_COUNT}}
**Functions Analyzed:** {{FUNCTION_COUNT}}

**To regenerate:**
```bash
node tools/diagnostics/universal-diagnostic.js --generate-ai-context
```

---

## 🎓 LEARNING RESOURCES

- **Google Places API (New):** https://developers.google.com/maps/documentation/places/web-service/search-nearby
- **Netlify Functions:** https://docs.netlify.com/functions/overview/
- **Neon PostgreSQL:** https://neon.tech/docs
- **Leaflet.js:** https://leafletjs.com/reference.html

---

**END OF AI ASSISTANT CONTEXT**

> **Note to AI:** You now have complete project knowledge. The user doesn't need to explain architecture, schemas, or endpoints. You can immediately help with any request by referencing this context.
