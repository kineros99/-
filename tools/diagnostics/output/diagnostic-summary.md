# 🔍 Diagnostic Report: Encarregado

**Generated:** 12/10/2025, 21:03:49
**Health Score:** 75/100

---

## 📊 Statistics

- **Functions:** 15
- **Lines of Code:** 4955
- **Critical Issues:** 3
- **Warnings:** 0
- **Database Tables:** 5
- **API Integrations:** 3

---

## ⚠️ Issues (3)




### 🔴 BACKEND - geocoding_google

Missing handler export




### 🔴 BACKEND - places_google

Missing handler export




### 🔴 BACKEND - places_nearby_google

Missing handler export




---

## 📡 Backend Functions


### auth-register

- **Path:** `netlify/functions/auth-register.js`
- **Lines:** 415
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### auto-populate-city

- **Path:** `netlify/functions/auto-populate-city.js`
- **Lines:** 333
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### auto-populate-stores

- **Path:** `netlify/functions/auto-populate-stores.js`
- **Lines:** 249
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### discover-city

- **Path:** `netlify/functions/discover-city.js`
- **Lines:** 238
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ✅
- **Issues:** 0


### discover-neighborhoods

- **Path:** `netlify/functions/discover-neighborhoods.js`
- **Lines:** 264
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ✅
- **Issues:** 0


### get-cities

- **Path:** `netlify/functions/get-cities.js`
- **Lines:** 84
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### get-lojas

- **Path:** `netlify/functions/get-lojas.js`
- **Lines:** 69
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### get-neighborhoods

- **Path:** `netlify/functions/get-neighborhoods.js`
- **Lines:** 121
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### init-database

- **Path:** `netlify/functions/init-database.js`
- **Lines:** 379
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### init_db

- **Path:** `netlify/functions/init_db.js`
- **Lines:** 42
- **Error Handling:** ✅
- **CORS:** ❌
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### scoped-auto-populate

- **Path:** `netlify/functions/scoped-auto-populate.js`
- **Lines:** 499
- **Error Handling:** ✅
- **CORS:** ✅
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### seed_lojas

- **Path:** `netlify/functions/seed_lojas.js`
- **Lines:** 107
- **Error Handling:** ✅
- **CORS:** ❌
- **Database:** ✅
- **Google API:** ❌
- **Issues:** 0


### geocoding_google

- **Path:** `netlify/functions/utils/geocoding_google.js`
- **Lines:** 270
- **Error Handling:** ✅
- **CORS:** ❌
- **Database:** ❌
- **Google API:** ✅
- **Issues:** 1


### places_google

- **Path:** `netlify/functions/utils/places_google.js`
- **Lines:** 251
- **Error Handling:** ✅
- **CORS:** ❌
- **Database:** ❌
- **Google API:** ✅
- **Issues:** 1


### places_nearby_google

- **Path:** `netlify/functions/utils/places_nearby_google.js`
- **Lines:** 294
- **Error Handling:** ✅
- **CORS:** ❌
- **Database:** ❌
- **Google API:** ✅
- **Issues:** 1


---

## 💾 Database

- **Tables:** users, lojas, cities, neighborhoods, auto_population_runs
- **Views:** store_statistics
- **.env File:** ✅
- **Database URL:** ✅
- **Google API Key:** ✅

---

**Platform:** darwin
**Node Version:** v24.9.0
