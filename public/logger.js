/**
 * ============================================================================
 * AquiFacil - Comprehensive Live Page Logger
 * ============================================================================
 *
 * X-Ray logging system that captures everything happening in the application
 * from page load to page close.
 *
 * Features:
 * - Logs all user interactions, API calls, errors, state changes
 * - Persists across page navigation using localStorage
 * - Auto-saves to .txt files with session tracking
 * - Collapsible UI panel with search and copy functionality
 */

class LivePageLogger {
    constructor() {
        this.logs = [];
        this.sessionId = this.getOrCreateSessionId();
        this.sessionStartTime = new Date();
        this.currentPage = window.location.pathname.split('/').pop() || 'index.html';
        this.maxLogsInMemory = 2000;
        this.autoSaveInterval = 30000; // 30 seconds
        this.autoSaveThreshold = 500; // entries
        this.autoSaveTimer = null;
        this.isInitialized = false;

        this.init();
    }

    /**
     * Initialize the logger
     */
    init() {
        if (this.isInitialized) return;

        // Load persisted logs from localStorage
        this.loadPersistedLogs();

        // Log page load
        this.log('INFO', '🚀 Page Load Started', {
            page: this.currentPage,
            url: window.location.href,
            referrer: document.referrer || '(none)',
            userAgent: navigator.userAgent,
            sessionId: this.sessionId,
            timestamp: new Date().toISOString()
        });

        // Console interception disabled to prevent recursion
        // this.interceptConsole();

        // Intercept fetch API
        this.interceptFetch();

        // Track user interactions
        this.trackUserInteractions();

        // Track errors
        this.trackErrors();

        // Track page lifecycle
        this.trackPageLifecycle();

        // Start auto-save
        this.startAutoSave();

        // Create UI
        this.createUI();

        this.isInitialized = true;

        this.log('INFO', '✅ Logger initialized', {
            sessionId: this.sessionId,
            autoSaveInterval: `${this.autoSaveInterval / 1000}s`,
            autoSaveThreshold: this.autoSaveThreshold
        });
    }

    /**
     * Get or create a unique session ID
     */
    getOrCreateSessionId() {
        const today = new Date().toISOString().split('T')[0];
        const storageKey = `logger_session_${today}`;

        let sessionData = localStorage.getItem(storageKey);

        if (sessionData) {
            const data = JSON.parse(sessionData);
            data.count = (data.count || 0) + 1;
            localStorage.setItem(storageKey, JSON.stringify(data));
            return String(data.count).padStart(3, '0');
        } else {
            const data = { count: 1 };
            localStorage.setItem(storageKey, JSON.stringify(data));
            return '001';
        }
    }

    /**
     * Format timestamp
     */
    formatTimestamp(date = new Date()) {
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        const milliseconds = String(date.getMilliseconds()).padStart(3, '0');
        return `${hours}:${minutes}:${seconds}.${milliseconds}`;
    }

    /**
     * Format date for filename
     */
    formatDateForFilename(date = new Date()) {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hours = String(date.getHours()).padStart(2, '0');
        const minutes = String(date.getMinutes()).padStart(2, '0');
        const seconds = String(date.getSeconds()).padStart(2, '0');
        return `${year}-${month}-${day}_${hours}-${minutes}-${seconds}`;
    }

    /**
     * Core logging function
     */
    log(level, message, data = null, skipChecks = false) {
        const entry = {
            timestamp: new Date().toISOString(),
            level: level.toUpperCase(),
            message: message,
            data: data,
            page: this.currentPage
        };

        this.logs.push(entry);

        // Update UI if it exists
        if (this.logContainer) {
            this.appendLogToUI(entry);
        }

        // Persist to localStorage
        this.persistLogs();

        // Skip checks to prevent infinite recursion
        if (skipChecks) return;

        // Auto-save disabled to prevent unwanted file downloads
        // User can still manually save logs using the UI button
        /*
        if (this.logs.length >= this.autoSaveThreshold) {
            this.log('INFO', '💾 Auto-save threshold reached', { count: this.logs.length }, true);
            this.saveToFile();
        }
        */

        // Trim logs if exceeding memory limit
        if (this.logs.length > this.maxLogsInMemory) {
            const removed = this.logs.length - this.maxLogsInMemory;
            this.logs = this.logs.slice(-this.maxLogsInMemory);
            this.log('INFO', `🗑️ Trimmed old logs`, { removed }, true);
        }
    }

    /**
     * Persist logs to localStorage
     */
    persistLogs() {
        try {
            const storageKey = `logger_logs_${this.sessionId}`;
            localStorage.setItem(storageKey, JSON.stringify({
                sessionId: this.sessionId,
                sessionStartTime: this.sessionStartTime.toISOString(),
                logs: this.logs.slice(-500) // Only keep last 500 in localStorage
            }));
        } catch (e) {
            // localStorage full, clear old sessions
            this.clearOldSessions();
        }
    }

    /**
     * Load persisted logs from localStorage
     */
    loadPersistedLogs() {
        try {
            const storageKey = `logger_logs_${this.sessionId}`;
            const data = localStorage.getItem(storageKey);
            if (data) {
                const parsed = JSON.parse(data);
                if (parsed.logs && Array.isArray(parsed.logs)) {
                    this.logs = parsed.logs;
                    this.log('INFO', '📂 Loaded persisted logs', { count: this.logs.length });
                }
            }
        } catch (e) {
            console.error('Failed to load persisted logs:', e);
        }
    }

    /**
     * Clear old session data from localStorage
     */
    clearOldSessions() {
        const keys = Object.keys(localStorage);
        const loggerKeys = keys.filter(k => k.startsWith('logger_'));

        // Keep only current session and today's session counter
        const today = new Date().toISOString().split('T')[0];
        const keepKeys = [
            `logger_logs_${this.sessionId}`,
            `logger_session_${today}`
        ];

        loggerKeys.forEach(key => {
            if (!keepKeys.includes(key)) {
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Intercept console methods
     * DISABLED: This was causing infinite recursion and freezing the page
     */
    interceptConsole() {
        // Disabled to prevent infinite recursion
        // When this.log() is called, it can trigger console methods,
        // which would call this.log() again, creating an infinite loop
        return;
    }

    /**
     * Intercept fetch API
     * Simplified to only log metadata without reading response bodies
     * This prevents blocking data flow to the application
     */
    interceptFetch() {
        const self = this;
        const originalFetch = window.fetch;

        window.fetch = async function(...args) {
            const startTime = Date.now();
            const url = typeof args[0] === 'string' ? args[0] : args[0].url;
            const options = args[1] || {};
            const method = options.method || 'GET';

            self.log('API', `🌐 Fetch Request`, {
                method: method,
                url: url
            });

            try {
                const response = await originalFetch.apply(window, args);
                const duration = Date.now() - startTime;

                // Only log metadata - don't read response body
                self.log('API', `✅ Fetch Response`, {
                    method: method,
                    url: url,
                    status: response.status,
                    statusText: response.statusText,
                    duration: `${duration}ms`
                });

                return response;
            } catch (error) {
                const duration = Date.now() - startTime;

                self.log('ERROR', `❌ Fetch Failed`, {
                    method: method,
                    url: url,
                    error: error.message,
                    duration: `${duration}ms`
                });

                throw error;
            }
        };
    }

    /**
     * Track user interactions
     */
    trackUserInteractions() {
        const self = this;

        // Track all clicks (with exclusions for map interactions)
        document.addEventListener('click', function(e) {
            const element = e.target;

            // EXCLUSIONS: Skip logging for performance-heavy map interactions
            // 1. Skip if clicking on map container or any of its children
            if (element.id === 'map' || element.closest('#map')) {
                return;
            }

            // 2. Skip if clicking on logger UI elements
            if (element.closest('#logger-panel') || element.closest('#logger-toggle-btn')) {
                return;
            }

            // 3. Skip all Leaflet map controls and elements
            if (element.className && typeof element.className === 'string') {
                if (element.className.includes('leaflet-') ||
                    element.className.includes('marker-cluster')) {
                    return;
                }
            }

            // 4. Skip if parent has Leaflet classes
            if (element.closest('[class*="leaflet-"]') ||
                element.closest('[class*="marker-cluster"]')) {
                return;
            }

            const tag = element.tagName.toLowerCase();
            const id = element.id ? `#${element.id}` : '';
            const classes = element.className ? `.${element.className.split(' ').join('.')}` : '';
            const text = element.textContent ? element.textContent.substring(0, 50) : '';

            self.log('USER', '👆 Click Event', {
                element: `<${tag}${id}${classes}>`,
                text: text
            });
        }, true);

        // Track form submissions
        document.addEventListener('submit', function(e) {
            const form = e.target;
            const formId = form.id || '(no id)';
            const action = form.action || '(no action)';

            self.log('USER', '📋 Form Submit', {
                formId: formId,
                action: action,
                method: form.method
            });
        }, true);

        // Track input changes (but not the actual values for privacy)
        document.addEventListener('change', function(e) {
            const element = e.target;
            if (element.tagName === 'INPUT' || element.tagName === 'SELECT' || element.tagName === 'TEXTAREA') {
                const type = element.type || 'text';
                const id = element.id || element.name || '(no id)';

                // EXCLUSION: Skip radius slider to avoid performance issues
                if (id === 'radius-slider') {
                    return;
                }

                // EXCLUSION: Skip logger search input
                if (id === 'logger-search-input') {
                    return;
                }

                self.log('USER', '✏️ Input Changed', {
                    inputId: id,
                    type: type,
                    // Don't log actual values for privacy/security
                    hasValue: element.value ? true : false
                });
            }
        }, true);
    }

    /**
     * Track errors
     */
    trackErrors() {
        const self = this;

        window.addEventListener('error', function(e) {
            self.log('ERROR', '💥 JavaScript Error', {
                message: e.message,
                filename: e.filename,
                line: e.lineno,
                column: e.colno,
                stack: e.error ? e.error.stack : '(no stack trace)'
            });
        });

        window.addEventListener('unhandledrejection', function(e) {
            self.log('ERROR', '🚫 Unhandled Promise Rejection', {
                reason: e.reason,
                promise: e.promise
            });
        });
    }

    /**
     * Track page lifecycle
     */
    trackPageLifecycle() {
        const self = this;

        // DOM ready
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', function() {
                self.log('INFO', '📄 DOM Content Loaded', {
                    readyState: document.readyState
                });
            });
        } else {
            self.log('INFO', '📄 DOM Already Loaded', {
                readyState: document.readyState
            });
        }

        // Page fully loaded
        window.addEventListener('load', function() {
            const loadTime = performance.now();
            self.log('INFO', '🎉 Page Fully Loaded', {
                loadTime: `${loadTime.toFixed(2)}ms`
            });
        });

        // Page unload
        window.addEventListener('beforeunload', function() {
            const duration = new Date() - self.sessionStartTime;
            const minutes = Math.floor(duration / 60000);
            const seconds = Math.floor((duration % 60000) / 1000);

            self.log('INFO', '🚪 Page Unload', {
                duration: `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`,
                totalLogs: self.logs.length,
                page: self.currentPage
            });

            // Auto-save on unload disabled
            // self.saveToFile();
        });

        // Visibility change (tab switch)
        document.addEventListener('visibilitychange', function() {
            if (document.hidden) {
                self.log('INFO', '👁️ Page Hidden', { page: self.currentPage });
            } else {
                self.log('INFO', '👁️ Page Visible', { page: self.currentPage });
            }
        });
    }

    /**
     * Start auto-save timer
     * DISABLED: Auto-save was causing unwanted file downloads
     */
    startAutoSave() {
        // Auto-save disabled to prevent unwanted file downloads
        // User can manually save using the UI button (💾)
        return;
    }

    /**
     * Stop auto-save timer
     */
    stopAutoSave() {
        if (this.autoSaveTimer) {
            clearInterval(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    /**
     * Generate log file content
     */
    generateFileContent() {
        const header = `${'='.repeat(80)}
AQUIFACIL - LIVE PAGE LOG
${'='.repeat(80)}
Session ID: ${this.sessionId}
Start Time: ${this.sessionStartTime.toLocaleString()}
Current Page: ${this.currentPage}
User Agent: ${navigator.userAgent}
${'='.repeat(80)}

`;

        const logEntries = this.logs.map(entry => {
            const timestamp = new Date(entry.timestamp);
            const time = this.formatTimestamp(timestamp);
            const level = entry.level.padEnd(5);
            let output = `[${time}] [${level}] ${entry.message}`;

            if (entry.data) {
                const dataStr = JSON.stringify(entry.data, null, 2);
                output += '\n  ' + dataStr.split('\n').join('\n  ');
            }

            return output;
        }).join('\n\n');

        const footer = `\n\n${'='.repeat(80)}
END OF LOG - Session closed normally
Total Logs: ${this.logs.length}
${'='.repeat(80)}`;

        return header + logEntries + footer;
    }

    /**
     * Save logs to file
     */
    saveToFile() {
        const content = this.generateFileContent();
        const filename = `live_page_log_${this.formatDateForFilename(this.sessionStartTime)}_session-${this.sessionId}.txt`;

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);

        this.log('INFO', '💾 Logs saved to file', { filename });
    }

    /**
     * Copy all logs to clipboard
     */
    copyToClipboard() {
        const content = this.generateFileContent();

        navigator.clipboard.writeText(content).then(() => {
            this.log('INFO', '📋 Logs copied to clipboard', { size: content.length });
            this.showToast('✅ Logs copied to clipboard!');
        }).catch(err => {
            this.log('ERROR', '❌ Failed to copy to clipboard', { error: err.message });
            this.showToast('❌ Failed to copy logs');
        });
    }

    /**
     * Show toast notification
     */
    showToast(message) {
        const toast = document.createElement('div');
        toast.className = 'logger-toast';
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('show');
        }, 10);

        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 2000);
    }

    /**
     * Create UI elements
     */
    createUI() {
        // Create logger button
        const button = document.createElement('button');
        button.id = 'logger-toggle-btn';
        button.className = 'logger-toggle-btn';
        button.innerHTML = '📊';
        button.title = 'Toggle Live Page Logger';
        button.addEventListener('click', () => this.togglePanel());
        document.body.appendChild(button);

        // Create logger panel
        const panel = document.createElement('div');
        panel.id = 'logger-panel';
        panel.className = 'logger-panel';
        panel.innerHTML = `
            <div class="logger-header">
                <h3>📊 LIVE PAGE LOG</h3>
                <div class="logger-controls">
                    <button id="logger-copy-btn" title="Copy All Logs">📋</button>
                    <button id="logger-save-btn" title="Save Logs Now">💾</button>
                    <button id="logger-clear-btn" title="Clear Logs">🗑️</button>
                    <button id="logger-close-btn" title="Close Panel">✕</button>
                </div>
            </div>
            <div class="logger-search">
                <input type="text" id="logger-search-input" placeholder="🔍 Search logs...">
            </div>
            <div class="logger-stats">
                <span>Session: ${this.sessionId}</span>
                <span>Logs: <span id="logger-count">0</span></span>
                <span>Auto-save: ${this.autoSaveInterval / 1000}s</span>
            </div>
            <div class="logger-container" id="logger-container"></div>
        `;
        document.body.appendChild(panel);

        this.logContainer = document.getElementById('logger-container');
        this.logCountElement = document.getElementById('logger-count');

        // Add event listeners
        document.getElementById('logger-copy-btn').addEventListener('click', () => this.copyToClipboard());
        document.getElementById('logger-save-btn').addEventListener('click', () => this.saveToFile());
        document.getElementById('logger-clear-btn').addEventListener('click', () => this.clearLogs());
        document.getElementById('logger-close-btn').addEventListener('click', () => this.togglePanel());

        const searchInput = document.getElementById('logger-search-input');
        searchInput.addEventListener('input', (e) => this.filterLogs(e.target.value));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey) {
                if (e.key === 'L') {
                    e.preventDefault();
                    this.togglePanel();
                } else if (e.key === 'C') {
                    e.preventDefault();
                    this.copyToClipboard();
                } else if (e.key === 'S') {
                    e.preventDefault();
                    this.saveToFile();
                }
            }
        });

        // Populate existing logs
        this.refreshUI();
    }

    /**
     * Append a single log entry to UI
     */
    appendLogToUI(entry) {
        if (!this.logContainer) return;

        const logElement = this.createLogElement(entry);
        this.logContainer.appendChild(logElement);

        // Auto-scroll to bottom
        this.logContainer.scrollTop = this.logContainer.scrollHeight;

        // Update count
        if (this.logCountElement) {
            this.logCountElement.textContent = this.logs.length;
        }
    }

    /**
     * Create log element
     */
    createLogElement(entry) {
        const div = document.createElement('div');
        div.className = `logger-entry logger-${entry.level.toLowerCase()}`;

        const timestamp = new Date(entry.timestamp);
        const time = this.formatTimestamp(timestamp);

        let html = `<div class="logger-entry-header">[${time}] [${entry.level}] ${entry.message}</div>`;

        if (entry.data) {
            const dataStr = JSON.stringify(entry.data, null, 2);
            html += `<div class="logger-entry-data">${this.escapeHtml(dataStr)}</div>`;
        }

        div.innerHTML = html;
        return div;
    }

    /**
     * Escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Refresh entire UI
     */
    refreshUI() {
        if (!this.logContainer) return;

        this.logContainer.innerHTML = '';
        this.logs.forEach(entry => {
            const logElement = this.createLogElement(entry);
            this.logContainer.appendChild(logElement);
        });

        if (this.logCountElement) {
            this.logCountElement.textContent = this.logs.length;
        }
    }

    /**
     * Filter logs by search term
     */
    filterLogs(searchTerm) {
        if (!this.logContainer) return;

        const entries = this.logContainer.querySelectorAll('.logger-entry');
        const term = searchTerm.toLowerCase();

        entries.forEach(entry => {
            const text = entry.textContent.toLowerCase();
            if (text.includes(term)) {
                entry.style.display = 'block';
            } else {
                entry.style.display = 'none';
            }
        });
    }

    /**
     * Clear logs
     */
    clearLogs() {
        if (confirm('Are you sure you want to clear all logs for this session?')) {
            this.logs = [];
            this.refreshUI();
            this.persistLogs();
            this.log('INFO', '🗑️ Logs cleared by user');
        }
    }

    /**
     * Toggle panel visibility
     */
    togglePanel() {
        const panel = document.getElementById('logger-panel');
        if (panel) {
            panel.classList.toggle('show');

            if (panel.classList.contains('show')) {
                this.log('INFO', '👁️ Logger panel opened');
            } else {
                this.log('INFO', '👁️ Logger panel closed');
            }
        }
    }
}

// LOGGER TEMPORARILY DISABLED
// The logger was causing severe performance issues:
// - persistLogs() writes to localStorage on EVERY log entry
// - appendLogToUI() manipulates DOM on EVERY log entry
// - Event tracking creates thousands of log entries per second
// - This freezes the browser completely
//
// TODO: Refactor logger to use batching and throttling before re-enabling

/*
// Initialize logger when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        window.liveLogger = new LivePageLogger();
    });
} else {
    window.liveLogger = new LivePageLogger();
}
*/

console.log('[Logger] Logger is currently disabled for performance. Page should be fully responsive.');
