document.addEventListener('DOMContentLoaded', () => {
    // ========================================================================
    // Authentication Gate
    // ========================================================================
    const authGate = document.getElementById('auth-gate');
    const mainContent = document.getElementById('main-content');
    const authButton = document.getElementById('auth-button');
    const authUsernameInput = document.getElementById('auth-username');
    const authPasswordInput = document.getElementById('auth-password');
    const authMessageDiv = document.getElementById('auth-message');

    let isAuthenticated = false;
    let adminPassword = '';

    // Handle authentication
    authButton.addEventListener('click', authenticate);
    authPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            authenticate();
        }
    });

    function authenticate() {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (!username || !password) {
            showAuthMessage('Por favor, preencha usuário e senha', 'error');
            return;
        }

        if (username !== 'kinEROS') {
            showAuthMessage('Usuário inválido', 'error');
            return;
        }

        // Password validated - grant access
        adminPassword = password;
        isAuthenticated = true;

        // Hide auth gate with animation
        authGate.classList.add('hidden');
        setTimeout(() => {
            mainContent.classList.add('visible');
            // Initialize the app after authentication
            initializeApp();
        }, 300);
    }

    function showAuthMessage(text, type) {
        authMessageDiv.textContent = text;
        authMessageDiv.className = `message ${type}`;
        authMessageDiv.style.display = 'block';
    }

    // ========================================================================
    // Main Application (only runs after authentication)
    // ========================================================================
    const runButton = document.getElementById('runButton');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const logDiv = document.getElementById('log');
    const messageDiv = document.getElementById('message');
    const userCountEl = document.getElementById('userCount');
    const autoCountEl = document.getElementById('autoCount');
    const totalCountEl = document.getElementById('totalCount');

    function initializeApp() {
        // Load initial statistics
        loadStatistics();

        // ========================================================================
        // City Search and Selection
        // ========================================================================
        const countryInput = document.getElementById('country-input');
        const stateInput = document.getElementById('state-input');
        const citySearchInput = document.getElementById('city-search-input');
        const cityDropdown = document.getElementById('city-dropdown');
        const selectedCityInfo = document.getElementById('selected-city-info');
        const selectedCityText = document.getElementById('selected-city-text');
        const neighborhoodsInfo = document.getElementById('neighborhoods-info');

        let selectedCity = null;
        let searchTimeout = null;

        // City search with debouncing
        citySearchInput.addEventListener('input', () => {
            clearTimeout(searchTimeout);
            const query = citySearchInput.value.trim();

            if (query.length < 2) {
                cityDropdown.style.display = 'none';
                return;
            }

            searchTimeout = setTimeout(async () => {
                // Normalize inputs: trim whitespace, preserve original case for Google API
                const country = countryInput.value.trim() || 'Brasil';
                const state = stateInput.value.trim();

                if (!state) {
                    showMessage('Por favor, insira o estado primeiro', 'error');
                    return;
                }

                try {
                    // Discover the city (Google API handles case-insensitive matching)
                    const response = await fetch('/.netlify/functions/discover-city', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            cityName: query,  // Send as-is, let backend handle normalization
                            countryName: country
                        })
                    });

                    const result = await response.json();

                    if (response.ok && result.success) {
                        // Show the found city in dropdown
                        cityDropdown.innerHTML = `
                            <div class="city-option" data-city='${JSON.stringify(result.city)}'>
                                <div class="city-option-name">${result.city.name}</div>
                                <div class="city-option-details">${result.city.state}, ${result.city.country}</div>
                            </div>
                        `;
                        cityDropdown.style.display = 'block';

                        // Add click handler
                        cityDropdown.querySelector('.city-option').addEventListener('click', async () => {
                            await selectCity(result.city);
                        });
                    } else {
                        cityDropdown.innerHTML = `
                            <div style="padding: 12px; color: #666; text-align: center;">
                                Cidade não encontrada
                            </div>
                        `;
                        cityDropdown.style.display = 'block';
                    }
                } catch (error) {
                    console.error('City search error:', error);
                    showMessage(`Erro ao buscar cidade: ${error.message}`, 'error');
                }
            }, 500);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!citySearchInput.contains(e.target) && !cityDropdown.contains(e.target)) {
                cityDropdown.style.display = 'none';
            }
        });

        // Select city and discover neighborhoods
        async function selectCity(city) {
            selectedCity = city;
            cityDropdown.style.display = 'none';
            citySearchInput.value = city.name;

            selectedCityText.textContent = `${city.name}, ${city.state}, ${city.country}`;
            neighborhoodsInfo.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Descobrindo bairros...';
            selectedCityInfo.style.display = 'block';

            try {
                // Discover neighborhoods for this city
                const response = await fetch('/.netlify/functions/discover-neighborhoods', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cityId: city.id })
                });

                const result = await response.json();

                if (response.ok && result.success) {
                    neighborhoodsInfo.innerHTML = `
                        <i class="fas fa-check-circle" style="color: #28a745;"></i>
                        ${result.count} bairro(s) descoberto(s) e pronto para auto-population
                    `;
                } else {
                    throw new Error(result.message || 'Falha ao descobrir bairros');
                }
            } catch (error) {
                console.error('Neighborhood discovery error:', error);
                neighborhoodsInfo.innerHTML = `
                    <i class="fas fa-exclamation-triangle" style="color: #dc3545;"></i>
                    Erro ao descobrir bairros: ${error.message}
                `;
            }
        }

        // Run auto-population
        runButton.addEventListener('click', async () => {
            const username = usernameInput.value.trim();
            const password = passwordInput.value.trim();

            if (!username || !password) {
                showMessage('Por favor, insira usuário e senha', 'error');
                return;
            }

            if (username !== 'kinEROS') {
                showMessage('Usuário inválido', 'error');
                return;
            }

            // Validate city selection
            if (!selectedCity) {
                showMessage('Por favor, selecione uma cidade primeiro', 'error');
                return;
            }

            // Confirm action
            if (!confirm(`Tem certeza que deseja executar o auto-population para ${selectedCity.name}, ${selectedCity.state}? Isso irá buscar até 111 lojas do Google Places API.`)) {
                return;
            }

            // Disable button and show loading
            runButton.disabled = true;
            runButton.innerHTML = '<div class="spinner"></div><span>Executando... Isso pode levar alguns minutos</span>';
            clearLog();
            addLog('🚀 Iniciando auto-population...', 'info');
            messageDiv.style.display = 'none';

            try {
                addLog(`📡 Conectando com Google Places API para ${selectedCity.name}...`, 'info');

                const response = await fetch('/.netlify/functions/auto-populate-city', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        password: password,
                        cityId: selectedCity.id
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.message || 'Erro ao executar auto-population');
                }

                // Success
                addLog('', 'info');
                addLog('✅ AUTO-POPULATION CONCLUÍDO COM SUCESSO!', 'success');
                addLog('', 'info');
                addLog(`🌍 Cidade: ${result.city.name}, ${result.city.state}, ${result.city.country}`, 'info');
                addLog('', 'info');
                addLog(`📊 Resultados:`, 'info');
                addLog(`   🙃 Lojas adicionadas: ${result.results.storesAdded}`, 'success');
                addLog(`   ⏭️  Lojas ignoradas (duplicadas): ${result.results.storesSkipped}`, 'info');
                addLog(`   📞 Chamadas API: ${result.results.apiCallsUsed}`, 'info');
                addLog(`   💰 Custo estimado: ${result.results.estimatedCost}`, 'info');
                addLog(`   ⏱️  Tempo de execução: ${(result.results.executionTimeMs / 1000).toFixed(2)}s`, 'info');
                addLog('', 'info');
                addLog(`📈 Estatísticas atualizadas:`, 'info');
                addLog(`   🙂 Usuários: ${result.statistics.userAddedCount}`, 'info');
                addLog(`   🙃 Auto-populadas: ${result.statistics.autoAddedCount}`, 'success');
                addLog(`   📊 Total: ${result.statistics.totalStores}`, 'info');

                if (result.errors && result.errors.length > 0) {
                    addLog('', 'info');
                    addLog(`⚠️  Alguns erros ocorreram (${result.errors.length}):`, 'error');
                    result.errors.forEach(err => {
                        addLog(`   - ${err.store}: ${err.error}`, 'error');
                    });
                }

                showMessage(`✅ ${result.results.storesAdded} lojas adicionadas com sucesso para ${result.city.name}!`, 'success');

                // Reload statistics
                loadStatistics();

            } catch (error) {
                addLog('', 'info');
                addLog('❌ ERRO AO EXECUTAR AUTO-POPULATION', 'error');
                addLog(`   ${error.message}`, 'error');
                showMessage(`❌ Erro: ${error.message}`, 'error');
            } finally {
                runButton.disabled = false;
                runButton.innerHTML = '<i class="fas fa-play"></i><span>Executar Auto-Population (Max 111 Lojas)</span>';
            }
        });

        // Allow pressing Enter to run
        passwordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !runButton.disabled) {
                runButton.click();
            }
        });
    }

    // Load statistics from API
    async function loadStatistics() {
        try {
            const response = await fetch('/.netlify/functions/get-lojas');
            const lojas = await response.json();

            const userStores = lojas.filter(l => l.source === 'user');
            const autoStores = lojas.filter(l => l.source === 'auto');

            userCountEl.textContent = userStores.length;
            autoCountEl.textContent = autoStores.length;
            totalCountEl.textContent = lojas.length;

        } catch (error) {
            console.error('Failed to load statistics:', error);
            userCountEl.textContent = '?';
            autoCountEl.textContent = '?';
            totalCountEl.textContent = '?';
        }
    }

    // Add log entry
    function addLog(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = message;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    // Clear log
    function clearLog() {
        logDiv.innerHTML = '';
    }

    // Show message
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }
});
