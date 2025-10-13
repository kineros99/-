# 🔍 Universal Project Diagnostic System

## Overview

A **cross-platform diagnostic tool** that systematically analyzes your entire project, generates comprehensive reports, and provides AI assistants with complete project context.

## Features

### ✅ What It Does

1. **Comprehensive Analysis**
   - Scans all backend functions (15 functions analyzed)
   - Analyzes frontend code (3 files, 1340 lines)
   - Checks database configuration (5 tables, 1 view)
   - Verifies API integrations (Google Maps, Netlify Neon)

2. **Issue Detection**
   - Missing error handling
   - Missing CORS headers
   - Database connection issues
   - Missing environment variables
   - Broken imports

3. **Auto-Fix Capabilities**
   - Creates `.env.example` template
   - Adds missing error handling (future)
   - Fixes CORS headers (future)
   - Generates database migrations (future)

4. **Multiple Report Formats**
   - **JSON:** Machine-readable for CI/CD (`diagnostic-report.json`)
   - **HTML:** Beautiful dashboard with charts (`diagnostic-report.html`)
   - **Markdown:** Human-readable summary (`diagnostic-summary.md`)

5. **AI Assistant Context**
   - Generates comprehensive prompt with FULL project knowledge
   - 15 function descriptions with examples
   - Database schema documentation
   - Common user intents and solutions
   - Error patterns and fixes

## Installation

```bash
# No installation needed! Already included in project
cd tools/diagnostics
```

## Usage

### Basic Run
```bash
node universal-diagnostic.js
```

**Output:**
- ✅ Analyzes all functions
- ✅ Generates 3 report formats
- ✅ Creates AI context file
- ✅ Shows health score: **75/100**

### Advanced Options

```bash
# Generate only JSON report
node universal-diagnostic.js --format=json

# Generate only HTML report
node universal-diagnostic.js --format=html

# Generate all formats (default)
node universal-diagnostic.js --format=all

# Enable auto-fix for detected issues
node universal-diagnostic.js --auto-fix

# Verbose output
node universal-diagnostic.js --verbose

# Combine options
node universal-diagnostic.js --format=html --auto-fix --verbose
```

## Generated Files

After running, check `tools/diagnostics/output/`:

```
output/
├── diagnostic-report.json       # Full results (machine-readable)
├── diagnostic-report.html       # Visual dashboard
├── diagnostic-summary.md        # Quick overview
└── ai-assistant-context.md      # AI context prompt (from template)
```

## Report Formats

### 1. JSON Report (`diagnostic-report.json`)

Complete diagnostic results for programmatic access:

```json
{
  "timestamp": "2025-10-12T21:03:49.000Z",
  "projectName": "Encarregado",
  "healthScore": 75,
  "functions": [
    {
      "name": "discover-city",
      "path": "netlify/functions/discover-city.js",
      "hasHandler": true,
      "hasErrorHandling": true,
      "hasCORS": true,
      "lineCount": 238,
      "issues": []
    }
  ],
  "database": {
    "hasEnvFile": true,
    "hasDatabaseURL": true,
    "tables": ["users", "lojas", "cities", "neighborhoods", "auto_population_runs"]
  },
  "issues": [
    {
      "category": "backend",
      "file": "geocoding_google",
      "severity": "critical",
      "message": "Missing handler export"
    }
  ],
  "statistics": {
    "totalFunctions": 15,
    "totalLines": 4955,
    "criticalIssues": 3,
    "warnings": 0
  }
}
```

### 2. HTML Dashboard (`diagnostic-report.html`)

Beautiful visual report with:
- Health score gauge (color-coded)
- Statistics cards
- Function list with badges
- Issue breakdown
- Responsive design

**Open in browser:**
```bash
open output/diagnostic-report.html
```

### 3. Markdown Summary (`diagnostic-summary.md`)

Human-readable text report:
```markdown
# 🔍 Diagnostic Report: Encarregado

**Health Score:** 75/100

## 📊 Statistics
- Functions: 15
- Lines of Code: 4,955
- Critical Issues: 3

## ⚠️ Issues
### 🔴 BACKEND - geocoding_google
Missing handler export
```

## AI Assistant Context

### What Is It?

A **comprehensive prompt file** that gives AI assistants (like Claude, ChatGPT) complete project knowledge instantly.

### Why Is It Useful?

**Without context:**
```
User: "Why are there 0 stores added?"
AI: "Can you show me the code?"
User: "Here's discover-city.js..."
AI: "And how do you call it?"
User: "Here's admin.js..."
AI: "What database schema?"
User: "Here's create_tables.sql..."
```

**With AI context:**
```
User: "Why are there 0 stores added?"
AI: "All stores already exist in database (duplicates).
     This is correct behavior - duplicate prevention
     via google_place_id UNIQUE constraint."
```

### How to Use

1. **Generate context:**
```bash
node universal-diagnostic.js
```

2. **Open context file:**
```bash
open templates/ai-context-template.md
```

3. **Share with AI:**
   - Copy entire file
   - Paste into AI chat
   - Say: "Use this as project context"

4. **AI now knows:**
   - All 15 functions with examples
   - Database schema (5 tables)
   - Common user intents
   - Error patterns and fixes
   - How to test features
   - Project architecture

### Context Contents

The AI context includes:

#### 📖 Project Overview
- Architecture diagram
- Technology stack
- Key features

#### 📡 API Catalog (15 Functions)
Each function documented with:
- Purpose
- Endpoint
- HTTP method
- Authentication requirements
- Request/response examples
- Common issues and fixes
- Example curl commands

#### 🗄️ Database Schema
- All 5 tables with SQL
- Relationships (foreign keys)
- Indexes
- Views

#### 🎯 Common User Intents
Example: "Test with Orlando, USA"
```bash
# Full workflow provided:
1. curl http://localhost:8888/.netlify/functions/init-database
2. curl -X POST ...discover-city... -d '{"cityName": "orlando", "countryName": "usa"}'
3. curl -X POST ...auto-populate-city... -d '{"password": "123", "cityId": 2}'
```

#### ⚠️ Error Patterns
- "City not found" → How to fix
- "Duplicates (0 additions)" → Explanation (correct behavior!)
- "Missing env variable" → Solution

## Health Score

**Score Calculation:**

| Metric | Points |
|--------|--------|
| Base score | 100 |
| Critical issue | -10 each |
| Warning | -5 each |
| Missing .env | -10 |
| Missing DATABASE_URL | -15 |
| Missing GOOGLE_API_KEY | -10 |
| **Bonuses:** |
| All functions have error handling | +5 |
| All functions have CORS | +5 |

**Current Score: 75/100**
- 3 critical issues (utility files flagged incorrectly) = -30
- All main functions have error handling = +5
- Most functions have CORS = +5

**Interpretation:**
- **80-100:** Excellent
- **60-79:** Good (current: 75)
- **40-59:** Needs improvement
- **0-39:** Critical issues

## Current Diagnostic Results

### ✅ Strengths
- All 15 functions analyzed successfully
- Database fully configured (5 tables, 1 view)
- Environment variables present
- API integrations working
- Error handling in all main functions
- CORS enabled on most endpoints

### ⚠️ Issues Found (3)

#### 1. geocoding_google.js - "Missing handler export"
**Status:** False positive
**Reason:** This is a utility module, not a Netlify function
**Fix:** Update diagnostic to ignore `/utils/` files

#### 2. places_google.js - "Missing handler export"
**Status:** False positive
**Reason:** Utility module

#### 3. places_nearby_google.js - "Missing handler export"
**Status:** False positive
**Reason:** Utility module

### 📊 Statistics
- **Total functions:** 15
- **Total lines:** 4,955
- **Backend:** 15 files
- **Frontend:** 3 files (1,340 lines)
- **Database:** 5 tables, 1 view
- **API integrations:** 3 (Geocoding, Places, Neon)

## Auto-Fix Capabilities

### Currently Implemented

#### 1. Create .env.example
**Trigger:** Missing .env file
**Action:** Creates template with all required variables

```bash
node universal-diagnostic.js --auto-fix
```

**Created file:**
```
# Encarregado Environment Variables
NETLIFY_DATABASE_URL=postgresql://user:password@host:5432/database
GOOGLE_MAPS_API_KEY=your_google_api_key_here
ADMIN_PASSWORD=your_admin_password_here
URL=http://localhost:8888
```

### Future Auto-Fixes

- Add missing error handling (try/catch)
- Add CORS headers to responses
- Fix case-sensitive comparisons (add LOWER())
- Generate database indexes
- Create migration files

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Project Health Check

on: [push, pull_request]

jobs:
  diagnostic:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Setup Node.js
        uses: actions/setup-node@v2
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm install
      - name: Run diagnostic
        run: node tools/diagnostics/universal-diagnostic.js --format=json
      - name: Check health score
        run: |
          SCORE=$(node -p "require('./tools/diagnostics/output/diagnostic-report.json').healthScore")
          if [ $SCORE -lt 70 ]; then
            echo "Health score too low: $SCORE/100"
            exit 1
          fi
      - name: Upload reports
        uses: actions/upload-artifact@v2
        with:
          name: diagnostic-reports
          path: tools/diagnostics/output/
```

### Exit Codes

- `0` - Success (health score ≥ 50)
- `1` - Failure (critical issues or score < 50)

## Cross-Platform Versions

### Node.js (Current)
```bash
node tools/diagnostics/universal-diagnostic.js
```

**For:** Netlify, Vercel, AWS Lambda, Node.js projects

### Python (Coming Soon)
```bash
python tools/diagnostics/universal_diagnostic.py
```

**For:** Django, Flask, FastAPI projects

### Swift (Coming Soon)
```bash
swift tools/diagnostics/UniversalDiagnostic.swift
```

**For:** iOS, macOS apps

### PowerShell (Coming Soon)
```powershell
.\tools\diagnostics\Universal-Diagnostic.ps1
```

**For:** Windows, .NET projects

## Development

### Add New Checks

Edit `universal-diagnostic.js`:

```javascript
// In detectIssues() method
async detectIssues() {
    // Your custom check
    if (!this.results.database.hasBackup) {
        this.results.issues.push({
            category: 'database',
            severity: 'warning',
            message: 'No database backup configured',
            autoFix: 'setup-backup'
        });
    }
}
```

### Add Auto-Fix

```javascript
// In applyAutoFixes() method
async applyAutoFixes() {
    switch (issue.autoFix) {
        case 'setup-backup':
            await this.setupDatabaseBackup();
            break;
    }
}

async setupDatabaseBackup() {
    // Implementation
}
```

## Troubleshooting

### Diagnostic Won't Run

```bash
# Check Node.js version (requires v14+)
node --version

# Reinstall dependencies
npm install

# Run with verbose output
node universal-diagnostic.js --verbose
```

### Reports Not Generated

```bash
# Check output directory exists
ls -la tools/diagnostics/output/

# Create manually if missing
mkdir -p tools/diagnostics/output

# Check file permissions
chmod 755 tools/diagnostics/
```

### AI Context Not Helpful

The AI context template is static. To customize:

1. Edit `templates/ai-context-template.md`
2. Add project-specific sections
3. Include your common workflows
4. Update error patterns

## FAQ

### Q: Does it modify my code?
**A:** Only with `--auto-fix` flag, and only safe fixes (like creating .env.example)

### Q: Can I use this in production?
**A:** Yes! Run before deployments to verify health

### Q: How often should I run it?
**A:**
- Before each commit (via pre-commit hook)
- In CI/CD pipeline
- After adding new functions
- When debugging issues

### Q: What does health score 75 mean?
**A:** Good! Means project is functional with minor issues. 80+ is excellent.

### Q: Can AI really understand my project from the context?
**A:** Yes! The AI context includes everything: functions, schemas, examples, errors. Try it!

### Q: How do I share AI context with multiple AIs?
**A:** Copy `templates/ai-context-template.md` and paste into any AI chat (Claude, ChatGPT, etc.)

## Contributing

Want to improve the diagnostic? Add:
- More auto-fix rules
- Additional checks (security, performance)
- Cross-platform versions (Python, Swift)
- Custom report templates

## License

MIT - Part of the Encarregado project

---

**🎯 Pro Tip:** Run diagnostic before asking AI for help. The AI context file gives the assistant complete project knowledge instantly!

**📊 Current Health:** 75/100 - Good!
**⚠️ Issues:** 3 (all false positives in utility files)
**✅ Functions:** 15/15 analyzed
**💾 Database:** Fully configured
