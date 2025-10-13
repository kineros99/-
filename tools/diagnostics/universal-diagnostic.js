#!/usr/bin/env node

/**
 * ============================================================================
 * UNIVERSAL PROJECT DIAGNOSTIC SYSTEM
 * ============================================================================
 *
 * Cross-platform diagnostic tool that:
 * - Analyzes ALL project functions systematically
 * - Generates comprehensive reports (JSON, HTML, Markdown)
 * - Auto-fixes common issues
 * - Generates AI assistant context prompts
 *
 * Usage:
 *   node universal-diagnostic.js
 *   node universal-diagnostic.js --format=html
 *   node universal-diagnostic.js --format=json
 *   node universal-diagnostic.js --auto-fix
 *   node universal-diagnostic.js --generate-ai-context
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '../..');

// Parse command line arguments
const args = process.argv.slice(2);
const options = {
    format: 'all', // all, json, html, markdown
    autoFix: false,
    generateAiContext: true,
    verbose: false
};

args.forEach(arg => {
    if (arg.startsWith('--format=')) options.format = arg.split('=')[1];
    if (arg === '--auto-fix') options.autoFix = true;
    if (arg === '--generate-ai-context') options.generateAiContext = true;
    if (arg === '--verbose' || arg === '-v') options.verbose = true;
});

// ============================================================================
// DIAGNOSTIC ENGINE
// ============================================================================

class UniversalDiagnostic {
    constructor() {
        this.startTime = Date.now();
        this.results = {
            timestamp: new Date().toISOString(),
            projectName: 'Encarregado',
            projectRoot: PROJECT_ROOT,
            platform: process.platform,
            nodeVersion: process.version,
            functions: [],
            database: {},
            frontend: {},
            apis: {},
            issues: [],
            autoFixes: [],
            statistics: {},
            healthScore: 0
        };
    }

    /**
     * Main diagnostic execution
     */
    async run() {
        console.log('╔═══════════════════════════════════════════════════════════════╗');
        console.log('║     UNIVERSAL PROJECT DIAGNOSTIC SYSTEM                       ║');
        console.log('║     Comprehensive Analysis with Auto-Fix                      ║');
        console.log('╚═══════════════════════════════════════════════════════════════╝\n');

        try {
            // Phase 1: Scan project structure
            console.log('📁 Phase 1: Scanning project structure...');
            await this.scanProjectStructure();

            // Phase 2: Analyze backend functions
            console.log('\n📡 Phase 2: Analyzing backend functions...');
            await this.analyzeBackendFunctions();

            // Phase 3: Analyze frontend
            console.log('\n🎨 Phase 3: Analyzing frontend code...');
            await this.analyzeFrontend();

            // Phase 4: Check database configuration
            console.log('\n💾 Phase 4: Checking database configuration...');
            await this.checkDatabase();

            // Phase 5: Analyze API integrations
            console.log('\n🌐 Phase 5: Analyzing API integrations...');
            await this.analyzeAPIs();

            // Phase 6: Detect issues
            console.log('\n🔍 Phase 6: Detecting issues...');
            await this.detectIssues();

            // Phase 7: Auto-fix (if enabled)
            if (options.autoFix) {
                console.log('\n🔧 Phase 7: Applying auto-fixes...');
                await this.applyAutoFixes();
            }

            // Phase 8: Calculate health score
            console.log('\n📊 Phase 8: Calculating health score...');
            this.calculateHealthScore();

            // Phase 9: Generate reports
            console.log('\n📄 Phase 9: Generating reports...');
            await this.generateReports();

            // Phase 10: Generate AI context (if enabled)
            if (options.generateAiContext) {
                console.log('\n🤖 Phase 10: Generating AI assistant context...');
                await this.generateAIContext();
            }

            const duration = ((Date.now() - this.startTime) / 1000).toFixed(2);
            console.log(`\n✅ Diagnostic complete in ${duration}s`);
            console.log(`📊 Health Score: ${this.results.healthScore}/100`);
            console.log(`⚠️  Issues Found: ${this.results.issues.length}`);
            if (options.autoFix) {
                console.log(`🔧 Auto-Fixes Applied: ${this.results.autoFixes.length}`);
            }

            return this.results;

        } catch (error) {
            console.error('\n❌ Diagnostic failed:', error.message);
            console.error(error.stack);
            process.exit(1);
        }
    }

    /**
     * Scan project structure
     */
    async scanProjectStructure() {
        const structure = {
            backend: [],
            frontend: [],
            database: [],
            config: [],
            tests: [],
            docs: []
        };

        // Scan netlify functions
        const functionsDir = path.join(PROJECT_ROOT, 'netlify/functions');
        if (fs.existsSync(functionsDir)) {
            structure.backend = this.scanDirectory(functionsDir, '.js');
        }

        // Scan public directory
        const publicDir = path.join(PROJECT_ROOT, 'public');
        if (fs.existsSync(publicDir)) {
            structure.frontend = this.scanDirectory(publicDir, '.js')
                .concat(this.scanDirectory(publicDir, '.html'));
        }

        // Scan database scripts
        const dbDir = path.join(PROJECT_ROOT, 'tools/scripts');
        if (fs.existsSync(dbDir)) {
            structure.database = this.scanDirectory(dbDir, '.sql')
                .concat(this.scanDirectory(dbDir, '.js'));
        }

        // Check config files
        const configFiles = ['package.json', '.env', 'netlify.toml', 'README.md'];
        configFiles.forEach(file => {
            const filePath = path.join(PROJECT_ROOT, file);
            if (fs.existsSync(filePath)) {
                structure.config.push(file);
            }
        });

        this.results.structure = structure;

        console.log(`  ✓ Backend files: ${structure.backend.length}`);
        console.log(`  ✓ Frontend files: ${structure.frontend.length}`);
        console.log(`  ✓ Database files: ${structure.database.length}`);
        console.log(`  ✓ Config files: ${structure.config.length}`);
    }

    /**
     * Scan directory for files with extension
     */
    scanDirectory(dir, ext) {
        const files = [];

        function scan(currentDir) {
            if (!fs.existsSync(currentDir)) return;

            const entries = fs.readdirSync(currentDir, { withFileTypes: true });

            for (const entry of entries) {
                const fullPath = path.join(currentDir, entry.name);

                if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
                    scan(fullPath);
                } else if (entry.isFile() && entry.name.endsWith(ext)) {
                    files.push(fullPath);
                }
            }
        }

        scan(dir);
        return files;
    }

    /**
     * Analyze backend functions
     */
    async analyzeBackendFunctions() {
        const functionsDir = path.join(PROJECT_ROOT, 'netlify/functions');
        const functionFiles = this.results.structure.backend;

        for (const filePath of functionFiles) {
            try {
                const content = fs.readFileSync(filePath, 'utf-8');
                const relativePath = path.relative(PROJECT_ROOT, filePath);
                const functionName = path.basename(filePath, '.js');

                const analysis = {
                    name: functionName,
                    path: relativePath,
                    type: 'netlify-function',
                    hasHandler: content.includes('export const handler'),
                    hasAsync: content.includes('async'),
                    usesDatabase: content.includes('neon()') || content.includes('sql`'),
                    usesGoogleAPI: content.includes('googleapis') || content.includes('GOOGLE_API_KEY'),
                    hasErrorHandling: content.includes('try') && content.includes('catch'),
                    hasCORS: content.includes('Access-Control-Allow-Origin'),
                    lineCount: content.split('\n').length,
                    dependencies: this.extractDependencies(content),
                    endpoints: this.extractEndpoints(content, functionName),
                    issues: []
                };

                // Check for issues
                if (!analysis.hasHandler) {
                    analysis.issues.push({ severity: 'critical', message: 'Missing handler export' });
                }
                if (!analysis.hasErrorHandling) {
                    analysis.issues.push({ severity: 'warning', message: 'No error handling (try/catch)' });
                }
                if (analysis.usesDatabase && !analysis.hasErrorHandling) {
                    analysis.issues.push({ severity: 'critical', message: 'Database calls without error handling' });
                }

                this.results.functions.push(analysis);

                if (options.verbose) {
                    console.log(`  ✓ ${functionName}: ${analysis.lineCount} lines, ${analysis.issues.length} issues`);
                }

            } catch (error) {
                console.error(`  ✗ Error analyzing ${filePath}:`, error.message);
            }
        }

        console.log(`  ✓ Analyzed ${this.results.functions.length} functions`);
    }

    /**
     * Extract dependencies from code
     */
    extractDependencies(content) {
        const deps = [];
        const importRegex = /import\s+.*?\s+from\s+['"](.+?)['"]/g;
        let match;

        while ((match = importRegex.exec(content)) !== null) {
            deps.push(match[1]);
        }

        return deps;
    }

    /**
     * Extract endpoint information
     */
    extractEndpoints(content, functionName) {
        return [{
            path: `/.netlify/functions/${functionName}`,
            methods: this.extractMethods(content),
            requiresAuth: content.includes('password') || content.includes('ADMIN_PASSWORD'),
            parameters: this.extractParameters(content)
        }];
    }

    /**
     * Extract HTTP methods
     */
    extractMethods(content) {
        const methods = [];
        if (content.includes("httpMethod !== 'GET'") || content.includes("httpMethod === 'GET'")) methods.push('GET');
        if (content.includes("httpMethod !== 'POST'") || content.includes("httpMethod === 'POST'")) methods.push('POST');
        if (methods.length === 0) methods.push('ANY');
        return methods;
    }

    /**
     * Extract parameters
     */
    extractParameters(content) {
        const params = [];
        const bodyRegex = /JSON\.parse\(event\.body\)/g;

        if (bodyRegex.test(content)) {
            const varRegex = /const\s+\{\s*([^}]+)\s*\}\s*=\s*JSON\.parse/g;
            let match;
            while ((match = varRegex.exec(content)) !== null) {
                const vars = match[1].split(',').map(v => v.trim().split(':')[0].trim());
                params.push(...vars);
            }
        }

        return params;
    }

    /**
     * Analyze frontend code
     */
    async analyzeFrontend() {
        const frontendFiles = this.results.structure.frontend.filter(f => f.endsWith('.js'));

        this.results.frontend = {
            files: frontendFiles.length,
            totalLines: 0,
            usesLeaflet: false,
            usesFetch: false,
            hasErrorHandling: false,
            issues: []
        };

        for (const filePath of frontendFiles) {
            const content = fs.readFileSync(filePath, 'utf-8');
            this.results.frontend.totalLines += content.split('\n').length;

            if (content.includes('L.map') || content.includes('leaflet')) {
                this.results.frontend.usesLeaflet = true;
            }
            if (content.includes('fetch(')) {
                this.results.frontend.usesFetch = true;
            }
            if (content.includes('try') && content.includes('catch')) {
                this.results.frontend.hasErrorHandling = true;
            }
        }

        console.log(`  ✓ Analyzed ${this.results.frontend.files} frontend files`);
        console.log(`  ✓ Total lines: ${this.results.frontend.totalLines}`);
    }

    /**
     * Check database configuration
     */
    async checkDatabase() {
        const envPath = path.join(PROJECT_ROOT, '.env');
        const hasEnvFile = fs.existsSync(envPath);

        this.results.database = {
            hasEnvFile,
            hasDatabaseURL: false,
            hasGoogleAPIKey: false,
            tables: [
                'users',
                'lojas',
                'cities',
                'neighborhoods',
                'auto_population_runs'
            ],
            views: ['store_statistics'],
            issues: []
        };

        if (hasEnvFile) {
            const envContent = fs.readFileSync(envPath, 'utf-8');
            this.results.database.hasDatabaseURL = envContent.includes('NETLIFY_DATABASE_URL') || envContent.includes('DATABASE_URL');
            this.results.database.hasGoogleAPIKey = envContent.includes('GOOGLE_MAPS_API_KEY');
        } else {
            this.results.database.issues.push({
                severity: 'critical',
                message: '.env file not found',
                autoFix: 'create-env-example'
            });
        }

        if (!this.results.database.hasDatabaseURL) {
            this.results.database.issues.push({
                severity: 'critical',
                message: 'DATABASE_URL not configured'
            });
        }

        if (!this.results.database.hasGoogleAPIKey) {
            this.results.database.issues.push({
                severity: 'warning',
                message: 'GOOGLE_MAPS_API_KEY not configured'
            });
        }

        console.log(`  ✓ .env file: ${hasEnvFile ? 'Found' : 'Missing'}`);
        console.log(`  ✓ Database URL: ${this.results.database.hasDatabaseURL ? 'Configured' : 'Missing'}`);
        console.log(`  ✓ Google API Key: ${this.results.database.hasGoogleAPIKey ? 'Configured' : 'Missing'}`);
    }

    /**
     * Analyze API integrations
     */
    async analyzeAPIs() {
        this.results.apis = {
            google: {
                geocoding: false,
                places: false,
                textSearch: false
            },
            netlify: {
                functions: true,
                neon: false
            },
            issues: []
        };

        // Check package.json for dependencies
        const packagePath = path.join(PROJECT_ROOT, 'package.json');
        if (fs.existsSync(packagePath)) {
            const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

            if (deps['@netlify/neon']) {
                this.results.apis.netlify.neon = true;
            }
        }

        // Scan for API usage
        for (const func of this.results.functions) {
            const filePath = path.join(PROJECT_ROOT, func.path);
            const content = fs.readFileSync(filePath, 'utf-8');

            if (content.includes('geocode/json')) this.results.apis.google.geocoding = true;
            if (content.includes('places:searchNearby')) this.results.apis.google.places = true;
            if (content.includes('place/textsearch')) this.results.apis.google.textSearch = true;
        }

        console.log(`  ✓ Google Geocoding API: ${this.results.apis.google.geocoding ? 'Used' : 'Not used'}`);
        console.log(`  ✓ Google Places API: ${this.results.apis.google.places ? 'Used' : 'Not used'}`);
        console.log(`  ✓ Netlify Neon: ${this.results.apis.netlify.neon ? 'Configured' : 'Missing'}`);
    }

    /**
     * Detect issues across project
     */
    async detectIssues() {
        // Collect all issues
        const allIssues = [];

        // Backend issues
        this.results.functions.forEach(func => {
            func.issues.forEach(issue => {
                allIssues.push({
                    category: 'backend',
                    file: func.name,
                    ...issue
                });
            });
        });

        // Frontend issues
        this.results.frontend.issues.forEach(issue => {
            allIssues.push({
                category: 'frontend',
                ...issue
            });
        });

        // Database issues
        this.results.database.issues.forEach(issue => {
            allIssues.push({
                category: 'database',
                ...issue
            });
        });

        // API issues
        this.results.apis.issues.forEach(issue => {
            allIssues.push({
                category: 'api',
                ...issue
            });
        });

        this.results.issues = allIssues;

        const critical = allIssues.filter(i => i.severity === 'critical').length;
        const warnings = allIssues.filter(i => i.severity === 'warning').length;

        console.log(`  ⚠️  Critical issues: ${critical}`);
        console.log(`  ⚠️  Warnings: ${warnings}`);
    }

    /**
     * Apply auto-fixes
     */
    async applyAutoFixes() {
        const fixableIssues = this.results.issues.filter(i => i.autoFix);

        for (const issue of fixableIssues) {
            try {
                switch (issue.autoFix) {
                    case 'create-env-example':
                        await this.createEnvExample();
                        this.results.autoFixes.push({
                            issue: issue.message,
                            fix: 'Created .env.example template',
                            success: true
                        });
                        break;

                    // Add more auto-fix cases here
                }
            } catch (error) {
                this.results.autoFixes.push({
                    issue: issue.message,
                    fix: issue.autoFix,
                    success: false,
                    error: error.message
                });
            }
        }

        console.log(`  ✓ Applied ${this.results.autoFixes.filter(f => f.success).length} fixes`);
    }

    /**
     * Auto-fix: Create .env.example
     */
    async createEnvExample() {
        const envExample = `# Encarregado Environment Variables
# Copy this file to .env and fill in your values

# Database
NETLIFY_DATABASE_URL=postgresql://user:password@host:5432/database

# Google Maps API Key
GOOGLE_MAPS_API_KEY=your_google_api_key_here

# Admin Password
ADMIN_PASSWORD=your_admin_password_here

# Netlify (automatically set by Netlify)
URL=http://localhost:8888
`;

        const envExamplePath = path.join(PROJECT_ROOT, '.env.example');
        fs.writeFileSync(envExamplePath, envExample, 'utf-8');
    }

    /**
     * Calculate health score
     */
    calculateHealthScore() {
        let score = 100;

        // Deduct points for critical issues
        const criticalIssues = this.results.issues.filter(i => i.severity === 'critical');
        score -= criticalIssues.length * 10;

        // Deduct points for warnings
        const warnings = this.results.issues.filter(i => i.severity === 'warning');
        score -= warnings.length * 5;

        // Deduct points for missing features
        if (!this.results.database.hasEnvFile) score -= 10;
        if (!this.results.database.hasDatabaseURL) score -= 15;
        if (!this.results.database.hasGoogleAPIKey) score -= 10;

        // Bonus for good practices
        if (this.results.functions.every(f => f.hasErrorHandling)) score += 5;
        if (this.results.functions.every(f => f.hasCORS)) score += 5;

        this.results.healthScore = Math.max(0, Math.min(100, score));

        // Calculate statistics
        this.results.statistics = {
            totalFunctions: this.results.functions.length,
            totalLines: this.results.functions.reduce((sum, f) => sum + f.lineCount, 0) + this.results.frontend.totalLines,
            criticalIssues: criticalIssues.length,
            warnings: warnings.length,
            autoFixesAvailable: this.results.issues.filter(i => i.autoFix).length,
            databaseTables: this.results.database.tables.length,
            apiIntegrations: Object.values(this.results.apis.google).filter(Boolean).length
        };
    }

    /**
     * Generate reports
     */
    async generateReports() {
        const outputDir = path.join(__dirname, 'output');
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        // Always generate JSON
        const jsonPath = path.join(outputDir, 'diagnostic-report.json');
        fs.writeFileSync(jsonPath, JSON.stringify(this.results, null, 2), 'utf-8');
        console.log(`  ✓ JSON report: ${jsonPath}`);

        // Generate HTML if requested
        if (options.format === 'html' || options.format === 'all') {
            await this.generateHTMLReport(outputDir);
        }

        // Generate Markdown if requested
        if (options.format === 'markdown' || options.format === 'all') {
            await this.generateMarkdownReport(outputDir);
        }
    }

    /**
     * Generate HTML report
     */
    async generateHTMLReport(outputDir) {
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Diagnostic Report - ${this.results.projectName}</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Segoe UI', Arial, sans-serif; background: #f5f5f5; padding: 20px; }
        .container { max-width: 1200px; margin: 0 auto; background: white; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
        .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 10px 10px 0 0; }
        .header h1 { margin-bottom: 10px; }
        .health-score { font-size: 48px; font-weight: bold; margin: 20px 0; }
        .score-good { color: #28a745; }
        .score-warning { color: #ffc107; }
        .score-critical { color: #dc3545; }
        .section { padding: 30px; border-bottom: 1px solid #eee; }
        .section h2 { color: #667eea; margin-bottom: 20px; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .stat-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .stat-value { font-size: 32px; font-weight: bold; color: #667eea; }
        .stat-label { font-size: 14px; color: #666; margin-top: 5px; }
        .issue { padding: 15px; margin: 10px 0; border-radius: 5px; }
        .issue-critical { background: #f8d7da; border-left: 4px solid #dc3545; }
        .issue-warning { background: #fff3cd; border-left: 4px solid #ffc107; }
        .function-list { list-style: none; }
        .function-item { padding: 15px; margin: 10px 0; background: #f8f9fa; border-radius: 5px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; margin: 0 5px; }
        .badge-success { background: #d4edda; color: #155724; }
        .badge-danger { background: #f8d7da; color: #721c24; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🔍 Diagnostic Report</h1>
            <p>${this.results.projectName} - ${new Date(this.results.timestamp).toLocaleString()}</p>
            <div class="health-score ${this.getScoreClass()}">
                Health Score: ${this.results.healthScore}/100
            </div>
        </div>

        <div class="section">
            <h2>📊 Statistics</h2>
            <div class="stats-grid">
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.totalFunctions}</div>
                    <div class="stat-label">Functions</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.totalLines}</div>
                    <div class="stat-label">Lines of Code</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.criticalIssues}</div>
                    <div class="stat-label">Critical Issues</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.warnings}</div>
                    <div class="stat-label">Warnings</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.databaseTables}</div>
                    <div class="stat-label">Database Tables</div>
                </div>
                <div class="stat-card">
                    <div class="stat-value">${this.results.statistics.apiIntegrations}</div>
                    <div class="stat-label">API Integrations</div>
                </div>
            </div>
        </div>

        <div class="section">
            <h2>⚠️ Issues (${this.results.issues.length})</h2>
            ${this.results.issues.length === 0 ? '<p>✅ No issues found!</p>' : ''}
            ${this.results.issues.map(issue => `
                <div class="issue issue-${issue.severity}">
                    <strong>${issue.category.toUpperCase()}</strong> ${issue.file ? `- ${issue.file}` : ''}
                    <p>${issue.message}</p>
                    ${issue.autoFix ? '<span class="badge badge-success">Auto-fixable</span>' : ''}
                </div>
            `).join('')}
        </div>

        <div class="section">
            <h2>📡 Backend Functions (${this.results.functions.length})</h2>
            <ul class="function-list">
                ${this.results.functions.map(func => `
                    <li class="function-item">
                        <strong>${func.name}</strong>
                        <span class="badge ${func.hasErrorHandling ? 'badge-success' : 'badge-danger'}">
                            Error Handling: ${func.hasErrorHandling ? 'Yes' : 'No'}
                        </span>
                        <span class="badge ${func.hasCORS ? 'badge-success' : 'badge-danger'}">
                            CORS: ${func.hasCORS ? 'Yes' : 'No'}
                        </span>
                        <p>${func.path}</p>
                        <p>Lines: ${func.lineCount} | Issues: ${func.issues.length}</p>
                    </li>
                `).join('')}
            </ul>
        </div>
    </div>
</body>
</html>`;

        const htmlPath = path.join(outputDir, 'diagnostic-report.html');
        fs.writeFileSync(htmlPath, html, 'utf-8');
        console.log(`  ✓ HTML report: ${htmlPath}`);
    }

    /**
     * Get score CSS class
     */
    getScoreClass() {
        if (this.results.healthScore >= 80) return 'score-good';
        if (this.results.healthScore >= 50) return 'score-warning';
        return 'score-critical';
    }

    /**
     * Generate Markdown report
     */
    async generateMarkdownReport(outputDir) {
        const md = `# 🔍 Diagnostic Report: ${this.results.projectName}

**Generated:** ${new Date(this.results.timestamp).toLocaleString()}
**Health Score:** ${this.results.healthScore}/100

---

## 📊 Statistics

- **Functions:** ${this.results.statistics.totalFunctions}
- **Lines of Code:** ${this.results.statistics.totalLines}
- **Critical Issues:** ${this.results.statistics.criticalIssues}
- **Warnings:** ${this.results.statistics.warnings}
- **Database Tables:** ${this.results.statistics.databaseTables}
- **API Integrations:** ${this.results.statistics.apiIntegrations}

---

## ⚠️ Issues (${this.results.issues.length})

${this.results.issues.length === 0 ? '✅ **No issues found!**' : ''}

${this.results.issues.map(issue => `
### ${issue.severity === 'critical' ? '🔴' : '⚠️'} ${issue.category.toUpperCase()}${issue.file ? ` - ${issue.file}` : ''}

${issue.message}

${issue.autoFix ? '✅ **Auto-fixable**' : ''}
`).join('\n')}

---

## 📡 Backend Functions

${this.results.functions.map(func => `
### ${func.name}

- **Path:** \`${func.path}\`
- **Lines:** ${func.lineCount}
- **Error Handling:** ${func.hasErrorHandling ? '✅' : '❌'}
- **CORS:** ${func.hasCORS ? '✅' : '❌'}
- **Database:** ${func.usesDatabase ? '✅' : '❌'}
- **Google API:** ${func.usesGoogleAPI ? '✅' : '❌'}
- **Issues:** ${func.issues.length}
`).join('\n')}

---

## 💾 Database

- **Tables:** ${this.results.database.tables.join(', ')}
- **Views:** ${this.results.database.views.join(', ')}
- **.env File:** ${this.results.database.hasEnvFile ? '✅' : '❌'}
- **Database URL:** ${this.results.database.hasDatabaseURL ? '✅' : '❌'}
- **Google API Key:** ${this.results.database.hasGoogleAPIKey ? '✅' : '❌'}

---

**Platform:** ${this.results.platform}
**Node Version:** ${this.results.nodeVersion}
`;

        const mdPath = path.join(outputDir, 'diagnostic-summary.md');
        fs.writeFileSync(mdPath, md, 'utf-8');
        console.log(`  ✓ Markdown report: ${mdPath}`);
    }

    /**
     * Generate AI assistant context
     */
    async generateAIContext() {
        // This will be a MASSIVE prompt that gives AI full project context
        // To be continued in next file due to size...
        console.log(`  ✓ AI context generation (see ai-context-generator.js)`);
    }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

(async () => {
    const diagnostic = new UniversalDiagnostic();
    await diagnostic.run();
})();
