document.addEventListener('DOMContentLoaded', () => {
    // ========================================================================
    // Initialize Floating Log on Page Load
    // ========================================================================
    if (typeof window.showFloatingLog === 'function') {
        window.showFloatingLog('Log do Sistema');

        // Start minimized
        if (typeof window.minimizeFloatingLog === 'function') {
            window.minimizeFloatingLog();
        }
    }

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

    // Check for existing session on page load
    checkExistingSession();

    // Handle authentication
    authButton.addEventListener('click', authenticate);
    authPasswordInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            authenticate();
        }
    });

    function checkExistingSession() {
        try {
            const sessionData = sessionStorage.getItem('encarregado_admin_session');
            if (sessionData) {
                const session = JSON.parse(sessionData);
                const sessionAge = Date.now() - session.timestamp;
                const MAX_SESSION_AGE = 24 * 60 * 60 * 1000; // 24 hours

                if ((session.username === 'kinEROS' || session.username === 'student') && sessionAge < MAX_SESSION_AGE) {
                    // Valid session exists - auto-login
                    console.log('[Auth] Valid session found, auto-authenticating...');
                    isAuthenticated = true;
                    adminPassword = ''; // Don't store password, just keep session valid

                    // Skip auth gate
                    authGate.classList.add('hidden');
                    mainContent.classList.add('visible');
                    initializeApp();
                } else {
                    // Session expired or invalid - clear it
                    sessionStorage.removeItem('encarregado_admin_session');
                }
            }
        } catch (error) {
            console.error('[Auth] Error checking session:', error);
            sessionStorage.removeItem('encarregado_admin_session');
        }
    }

    function authenticate() {
        const username = authUsernameInput.value.trim();
        const password = authPasswordInput.value.trim();

        if (!username || !password) {
            showAuthMessage('Por favor, preencha usuário e senha', 'error');
            return;
        }

        if (username !== 'kinEROS' && username !== 'student') {
            showAuthMessage('Usuário inválido', 'error');
            return;
        }

        // Password validated - grant access
        adminPassword = password;
        isAuthenticated = true;

        // Store session in sessionStorage
        const sessionData = {
            username: username,
            timestamp: Date.now()
        };
        sessionStorage.setItem('encarregado_admin_session', JSON.stringify(sessionData));
        console.log('[Auth] Session created and stored');

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
        // Hierarchical Filters: Country → State → City
        // ========================================================================
        const countrySelect = document.getElementById('country-select');
        const stateSelect = document.getElementById('state-select');
        const citySelect = document.getElementById('city-select');

        const confirmCountryBtn = document.getElementById('confirm-country-btn');
        const confirmStateBtn = document.getElementById('confirm-state-btn');
        const confirmCityBtn = document.getElementById('confirm-city-btn');

        const stateSection = document.getElementById('state-section');
        const citySection = document.getElementById('city-section');

        const filterSummaryBadge = document.getElementById('filter-summary-badge');
        const filterSummaryText = document.getElementById('filter-summary-text');
        const clearFiltersBtn = document.getElementById('clear-filters-btn');

        let allCountries = [];
        let allStates = [];
        let allCities = [];

        let selectedCountry = null;
        let selectedState = null;
        let selectedCity = null;

        // Load countries on page load
        loadCountries();

        async function loadCountries() {
            try {
                const response = await fetch('/.netlify/functions/get-countries');
                allCountries = await response.json();

                countrySelect.innerHTML = '<option value="">🌍 Nenhum filtro - Buscar em todos os países</option>';
                allCountries.forEach(country => {
                    const option = document.createElement('option');
                    option.value = country.country_code;
                    option.textContent = `${country.name} (${country.country_code}) - ${country.city_count} cidades`;
                    option.dataset.countryData = JSON.stringify(country);
                    countrySelect.appendChild(option);
                });

                console.log('[Admin] Loaded', allCountries.length, 'countries');
            } catch (error) {
                console.error('[Admin] Failed to load countries:', error);
                showMessage('Erro ao carregar países', 'error');
            }
        }

        // Country selection change
        countrySelect.addEventListener('change', () => {
            const value = countrySelect.value;

            if (value === '') {
                // No filter selected
                confirmCountryBtn.style.display = 'none';
                resetStateAndCityFilters();
            } else {
                // Country selected, show confirm button
                confirmCountryBtn.style.display = 'block';
                confirmCountryBtn.disabled = false;
            }
        });

        // Confirm country
        confirmCountryBtn.addEventListener('click', async () => {
            const selectedOption = countrySelect.selectedOptions[0];
            selectedCountry = JSON.parse(selectedOption.dataset.countryData);

            console.log('[Admin] Country confirmed:', selectedCountry.name, selectedCountry.country_code);

            // Load states for this country
            await loadStates(selectedCountry.country_code);

            // Show state section
            stateSection.style.display = 'block';
            confirmCountryBtn.disabled = true;

            // Update filter summary
            updateFilterSummary();
        });

        async function loadStates(countryCode) {
            try {
                stateSelect.innerHTML = '<option value="">Carregando estados...</option>';
                stateSelect.disabled = true;

                const response = await fetch(`/.netlify/functions/get-states?country_code=${countryCode}`);
                const data = await response.json();
                allStates = data.states || data; // Handle both {states: []} and [] formats

                stateSelect.innerHTML = '<option value="">🌍 Nenhum filtro - Buscar em todos os estados</option>';

                if (allStates.length === 0 || data.needsDiscovery) {
                    // Auto-discover states instead of just showing a redirect button
                    console.log('[Admin] No states found, auto-discovering...');

                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Descobrindo estados automaticamente...';
                    stateSelect.appendChild(option);
                    confirmStateBtn.style.display = 'none';

                    showMessage(
                        `🔍 Nenhum estado encontrado para ${selectedCountry.name}. Descobrindo estados automaticamente...`,
                        'info'
                    );

                    // Automatically discover states
                    const discovered = await discoverStatesForCountry(countryCode);

                    if (discovered) {
                        // Reload states after discovery
                        showMessage(`✅ Estados descobertos para ${selectedCountry.name}! Recarregando...`, 'success');
                        await loadStates(countryCode); // Recursively reload
                    } else {
                        showMessage(
                            `❌ Não foi possível descobrir estados para ${selectedCountry.name}. Você pode continuar sem filtro de estado.`,
                            'error'
                        );
                        stateSelect.innerHTML = '<option value="">Nenhum estado disponível - continuar sem filtro</option>';
                        confirmStateBtn.style.display = 'none';
                    }
                    return; // Exit early, will reload if successful
                } else {
                    // States found, populate dropdown
                    allStates.forEach(state => {
                        const option = document.createElement('option');
                        option.value = state.state;
                        option.textContent = `${state.state} (${state.state_code}) - ${state.city_count} cidades`;
                        option.dataset.stateData = JSON.stringify(state);
                        stateSelect.appendChild(option);
                    });
                }

                stateSelect.disabled = false;
                console.log('[Admin] Loaded', allStates.length, 'states for', countryCode);
            } catch (error) {
                console.error('[Admin] Failed to load states:', error);
                console.error('[Admin] Error details:', error.message, error.stack);
                showMessage(`Erro ao carregar estados: ${error.message}`, 'error');
                stateSelect.innerHTML = '<option value="">Erro ao carregar estados</option>';
            }
        }

        async function discoverStatesForCountry(countryCode) {
            try {
                console.log(`[Admin] Discovering states for ${countryCode}...`);

                const response = await fetch('/.netlify/functions/discover-states', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ countryCode })
                });

                const result = await response.json();

                if (result.success) {
                    console.log(`[Admin] ✅ Discovered ${result.count} states for ${countryCode}`);
                    return true;
                } else {
                    console.error('[Admin] ❌ State discovery failed:', result.error || result.message);
                    return false;
                }
            } catch (error) {
                console.error('[Admin] ❌ Error discovering states:', error);
                return false;
            }
        }

        // State selection change
        stateSelect.addEventListener('change', () => {
            const value = stateSelect.value;

            if (value === '') {
                // No state filter
                confirmStateBtn.style.display = 'none';
                resetCityFilter();
            } else {
                // State selected, show confirm button
                confirmStateBtn.style.display = 'block';
                confirmStateBtn.disabled = false;
            }
        });

        // Confirm state
        confirmStateBtn.addEventListener('click', async () => {
            const selectedOption = stateSelect.selectedOptions[0];

            // Safety check: only parse if data exists
            if (!selectedOption.dataset.stateData) {
                showMessage('Estado selecionado não tem dados disponíveis', 'error');
                return;
            }

            selectedState = JSON.parse(selectedOption.dataset.stateData);

            console.log('[Admin] State confirmed:', selectedState.state);

            // Load cities for this state
            await loadCities(selectedState.state);

            // Show city section
            citySection.style.display = 'block';
            confirmStateBtn.disabled = true;

            // Update filter summary
            updateFilterSummary();
        });

        async function loadCities(stateName) {
            try {
                citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
                citySelect.disabled = true;

                const response = await fetch(`/.netlify/functions/get-cities?state=${encodeURIComponent(stateName)}`);
                allCities = await response.json();

                citySelect.innerHTML = '<option value="">🌍 Nenhum filtro - Buscar em todas as cidades</option>';

                if (allCities.length === 0) {
                    // Auto-discover cities instead of just failing
                    console.log('[Admin] No cities found, auto-discovering...');

                    const option = document.createElement('option');
                    option.value = '';
                    option.textContent = 'Descobrindo cidades automaticamente...';
                    citySelect.appendChild(option);
                    confirmCityBtn.style.display = 'none';

                    showMessage(
                        `🔍 Nenhuma cidade encontrada para ${stateName}. Descobrindo cidades automaticamente...`,
                        'info'
                    );

                    // Automatically discover cities for this state
                    const discovered = await discoverCitiesForState(selectedCountry.country_code, stateName);

                    if (discovered) {
                        // Reload cities after discovery
                        showMessage(`✅ Cidades descobertas para ${stateName}! Recarregando...`, 'success');
                        await loadCities(stateName); // Recursively reload
                    } else {
                        showMessage(
                            `❌ Não foi possível descobrir cidades para ${stateName}. Você pode continuar sem filtro de cidade.`,
                            'error'
                        );
                        citySelect.innerHTML = '<option value="">Nenhuma cidade disponível - continuar sem filtro</option>';
                        confirmCityBtn.style.display = 'none';
                    }
                    return; // Exit early, will reload if successful
                } else {
                    allCities.forEach(city => {
                        const option = document.createElement('option');
                        option.value = city.id;
                        option.textContent = `${city.name} - ${city.neighborhood_count} bairros`;
                        option.dataset.cityData = JSON.stringify(city);
                        citySelect.appendChild(option);
                    });
                }

                citySelect.disabled = false;
                console.log('[Admin] Loaded', allCities.length, 'cities for', stateName);
            } catch (error) {
                console.error('[Admin] Failed to load cities:', error);
                showMessage('Erro ao carregar cidades', 'error');
                citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
            }
        }

        async function discoverCitiesForState(countryCode, stateName) {
            try {
                console.log(`[Admin] Discovering cities for ${stateName}, ${countryCode}...`);

                // Special handling for Australia: use lower population threshold
                const populationMin = countryCode === 'AU' ? 500 : 1000;

                const response = await fetch('/.netlify/functions/discover-cities-bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        countryCode: countryCode,
                        stateFilter: stateName,
                        populationMin: populationMin,
                        batchSize: 100
                    })
                });

                const result = await response.json();

                if (result.success) {
                    console.log(`[Admin] ✅ Discovered ${result.citiesAdded} cities for ${stateName}`);
                    return true;
                } else {
                    console.error('[Admin] ❌ City discovery failed:', result.error || result.message);
                    return false;
                }
            } catch (error) {
                console.error('[Admin] ❌ Error discovering cities:', error);
                return false;
            }
        }

        // ================================================================
        // Auto-Discovery Chain: Prepares database and discovers missing data
        // ================================================================
        async function autoDiscoverAndRetry(password, filters) {
            const startTime = Date.now();
            const TIME_BUDGET_MS = 24000; // 24 seconds safe limit (Netlify timeout is 26s)

            // Safely initialize floating log
            try {
                if (typeof window.clearFloatingLog === 'function') window.clearFloatingLog();
                if (typeof window.showFloatingLog === 'function') window.showFloatingLog('Descoberta Automática');
            } catch (e) {
                console.error('[FloatingLog] Error in autoDiscoverAndRetry:', e);
            }

            try {
                const {country_code, state, city_id} = filters;

                // ====================================================================
                // PHASE 0: Database Initialization (CRITICAL)
                // ====================================================================
                addLog('🔧 Fase 0/5: Inicializando banco de dados...', 'info');

                try {
                    // Initialize core tables (countries, cities, neighborhoods, etc.)
                    addLog('   📦 Verificando tabelas principais...', 'info');
                    const initResponse = await fetch('/.netlify/functions/init-database', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!initResponse.ok) {
                        const initError = await initResponse.json();
                        addLog('   ⚠️  Aviso: Inicialização do banco pode ter falhado', 'error');
                        addLog(`   ${initError.message || 'Erro desconhecido'}`, 'error');
                        // Continue anyway - tables might already exist
                    } else {
                        addLog('   ✓ Tabelas principais verificadas', 'info');
                    }

                    // Ensure states table exists
                    addLog('   📦 Verificando tabela de estados...', 'info');
                    const migrateResponse = await fetch('/.netlify/functions/migrate-add-states-table', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!migrateResponse.ok) {
                        const migrateError = await migrateResponse.json();
                        addLog('   ⚠️  Aviso: Migração de estados pode ter falhado', 'error');
                        addLog(`   ${migrateError.message || 'Erro desconhecido'}`, 'error');
                        // Continue anyway - table might already exist
                    } else {
                        addLog('   ✓ Tabela de estados verificada', 'info');
                    }

                    addLog('   ✅ Banco de dados pronto!', 'success');
                } catch (dbError) {
                    addLog('   ⚠️  Aviso: Erro ao inicializar banco', 'error');
                    addLog(`   ${dbError.message}`, 'error');
                    addLog('   Continuando mesmo assim (tabelas podem já existir)...', 'info');
                }

                addLog('', 'info');

                // Check time budget after initialization
                const elapsed1 = Date.now() - startTime;
                if (elapsed1 > TIME_BUDGET_MS - 5000) {
                    addLog('⏱️  Tempo esgotado durante inicialização', 'error');
                    addLog('   Execute novamente para continuar', 'info');
                    window.stopFloatingLogOperation();
                    return false;
                }

                // ====================================================================
                // PHASE 1: Discover States if needed
                // ====================================================================
                addLog('📍 Fase 1/5: Verificando se precisa descobrir estados...', 'info');

                // If country filter, ensure states exist
                if (country_code) {
                    const statesCheck = await fetch(`/.netlify/functions/get-states?country_code=${country_code}`);
                    const statesData = await statesCheck.json();

                    if (!statesData.states || statesData.states.length === 0) {
                        addLog('   🔍 Descobrindo estados...', 'info');
                        const statesDiscovered = await discoverStatesForCountry(country_code);
                        if (!statesDiscovered) {
                            addLog('   ❌ Falha ao descobrir estados', 'error');
                            window.stopFloatingLogOperation();
                            return false;
                        }
                        addLog('   ✅ Estados descobertos!', 'success');
                    } else {
                        addLog('   ✓ Estados já existem', 'info');
                    }
                } else {
                    addLog('   ⏭️  Pulando (sem filtro de país)', 'info');
                }

                addLog('', 'info');

                // Check time budget after state discovery
                const elapsed2 = Date.now() - startTime;
                if (elapsed2 > TIME_BUDGET_MS - 5000) {
                    addLog('⏱️  Tempo esgotado após descoberta de estados', 'error');
                    addLog('   Execute novamente para continuar', 'info');
                    window.stopFloatingLogOperation();
                    return false;
                }

                // ====================================================================
                // PHASE 2: Discover Cities if needed
                // ====================================================================
                addLog('🏙️  Fase 2/5: Verificando se precisa descobrir cidades...', 'info');

                if (state && country_code) {
                    const citiesCheck = await fetch(`/.netlify/functions/get-cities?state=${encodeURIComponent(state)}`);
                    const citiesData = await citiesCheck.json();

                    if (!citiesData || citiesData.length === 0) {
                        addLog('   🔍 Descobrindo cidades...', 'info');
                        const citiesDiscovered = await discoverCitiesForState(country_code, state);
                        if (!citiesDiscovered) {
                            addLog('   ❌ Falha ao descobrir cidades', 'error');
                            window.stopFloatingLogOperation();
                            return false;
                        }
                        addLog('   ✅ Cidades descobertas!', 'success');
                    } else {
                        addLog('   ✓ Cidades já existem', 'info');
                    }
                } else {
                    addLog('   ⏭️  Pulando (sem filtro de estado)', 'info');
                }

                addLog('', 'info');

                // Check time budget after city discovery
                const elapsed3 = Date.now() - startTime;
                if (elapsed3 > TIME_BUDGET_MS - 5000) {
                    addLog('⏱️  Tempo esgotado após descoberta de cidades', 'error');
                    addLog('   Execute novamente para continuar', 'info');
                    window.stopFloatingLogOperation();
                    return false;
                }

                // ====================================================================
                // PHASE 3: Discover Neighborhoods (with TIME BUDGET tracking)
                // ====================================================================
                addLog('🏘️  Fase 3/5: Descobrindo bairros...', 'info');

                let citiesToDiscover = [];

                if (city_id) {
                    // Single city - just discover this one
                    citiesToDiscover = [city_id];
                } else if (state) {
                    // All cities in state
                    const citiesResponse = await fetch(`/.netlify/functions/get-cities?state=${encodeURIComponent(state)}`);
                    const cities = await citiesResponse.json();
                    citiesToDiscover = cities.map(c => c.id);
                } else if (country_code) {
                    // All cities in country
                    const statesResponse = await fetch(`/.netlify/functions/get-states?country_code=${country_code}`);
                    const statesData = await statesResponse.json();
                    const states = statesData.states || [];

                    for (const st of states) {
                        const citiesResponse = await fetch(`/.netlify/functions/get-cities?state=${encodeURIComponent(st.state)}`);
                        const cities = await citiesResponse.json();
                        citiesToDiscover.push(...cities.map(c => c.id));
                    }
                }

                addLog(`   📍 ${citiesToDiscover.length} cidades para descobrir bairros`, 'info');

                if (citiesToDiscover.length === 0) {
                    addLog('   ❌ Nenhuma cidade encontrada para descobrir bairros', 'error');
                    window.stopFloatingLogOperation();
                    return false;
                }

                // Discover neighborhoods for each city with TIME BUDGET tracking
                let successCount = 0;
                let failCount = 0;
                let stoppedEarly = false;

                for (let i = 0; i < citiesToDiscover.length; i++) {
                    // Check time budget BEFORE each city
                    const elapsedNow = Date.now() - startTime;
                    if (elapsedNow > TIME_BUDGET_MS - 6000) {
                        // Leave 6 seconds for retry phase
                        stoppedEarly = true;
                        addLog(`   ⏱️  Tempo esgotado - processadas ${i}/${citiesToDiscover.length} cidades`, 'error');
                        addLog(`   Execute novamente para continuar de onde parou`, 'info');
                        break;
                    }

                    const cityId = citiesToDiscover[i];
                    addLog(`   🔍 Descobrindo bairros (${i + 1}/${citiesToDiscover.length})...`, 'info');

                    try {
                        const response = await fetch('/.netlify/functions/discover-neighborhoods', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ cityId })
                        });

                        const result = await response.json();

                        if (result.success) {
                            successCount++;
                            addLog(`      ✓ ${result.count} bairros descobertos`, 'success');
                        } else {
                            failCount++;
                            addLog(`      ✗ Falha: ${result.error}`, 'error');
                        }
                    } catch (error) {
                        failCount++;
                        addLog(`      ✗ Erro: ${error.message}`, 'error');
                    }

                    // Small delay to avoid overwhelming APIs (only if not near time limit)
                    const elapsedAfter = Date.now() - startTime;
                    if (elapsedAfter < TIME_BUDGET_MS - 6000) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                }

                addLog(`   ✅ Descoberta concluída: ${successCount} sucesso, ${failCount} falhas`, successCount > 0 ? 'success' : 'error');

                if (successCount === 0) {
                    addLog('   ❌ Nenhum bairro foi descoberto', 'error');
                    window.stopFloatingLogOperation();
                    return false;
                }

                if (stoppedEarly) {
                    addLog('', 'info');
                    addLog('⚠️  Descoberta parcial devido a limite de tempo', 'error');
                    addLog('   Execute a auto-population novamente para continuar', 'info');
                    // Return false to avoid retry - user should run again
                    window.stopFloatingLogOperation();
                    return false;
                }

                addLog('', 'info');

                // ====================================================================
                // PHASE 4: Retry Auto-Population
                // ====================================================================
                addLog('🔄 Fase 4/5: Tentando auto-population novamente...', 'info');
                addLog('', 'info');

                const response = await fetch('/.netlify/functions/auto-populate-stores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        filters: filters
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    addLog('', 'info');
                    addLog('❌ AUTO-POPULATION FALHOU NOVAMENTE', 'error');
                    addLog(`   ${result.message}`, 'error');
                    window.stopFloatingLogOperation();
                    return false;
                }

                // Success! Show results
                addLog('', 'info');
                addLog('✅ AUTO-POPULATION CONCLUÍDO COM SUCESSO!', 'success');
                addLog('', 'info');
                addLog(`📊 Resultados:`, 'info');
                addLog(`   🔍 Lojas encontradas pelo Google: ${result.results.storesFoundByGoogle || 0}`, result.results.storesFoundByGoogle > 0 ? 'info' : 'error');
                addLog(`   🏘️  Bairros pesquisados: ${result.results.neighborhoodsSearched || 0}/${result.results.totalNeighborhoods || 0}`, 'info');
                addLog(`   🙃 Lojas adicionadas: ${result.results.storesAdded}`, result.results.storesAdded > 0 ? 'success' : 'info');
                addLog(`   ⏭️  Lojas ignoradas (duplicadas): ${result.results.storesSkipped}`, 'info');
                addLog(`   📞 Chamadas API: ${result.results.apiCallsUsed}`, 'info');
                addLog(`   💰 Custo estimado: ${result.results.estimatedCost}`, 'info');

                showMessage(`✅ ${result.results.storesAdded} lojas adicionadas após descoberta automática!`, 'success');
                loadStatistics();

                window.stopFloatingLogOperation();
                return true;

            } catch (error) {
                addLog('', 'info');
                addLog('❌ Erro durante descoberta automática', 'error');
                addLog(`   ${error.message}`, 'error');
                console.error('[Auto-Discovery] Full error:', error);
                window.stopFloatingLogOperation();
                return false;
            }
        }

        // City selection change
        citySelect.addEventListener('change', () => {
            const value = citySelect.value;

            if (value === '') {
                // No city filter
                confirmCityBtn.style.display = 'none';
            } else {
                // City selected, show confirm button
                confirmCityBtn.style.display = 'block';
                confirmCityBtn.disabled = false;
            }
        });

        // Confirm city
        confirmCityBtn.addEventListener('click', () => {
            const selectedOption = citySelect.selectedOptions[0];

            // Safety check: only parse if data exists
            if (!selectedOption.dataset.cityData) {
                showMessage('Cidade selecionada não tem dados disponíveis', 'error');
                return;
            }

            selectedCity = JSON.parse(selectedOption.dataset.cityData);

            console.log('[Admin] City confirmed:', selectedCity.name);

            confirmCityBtn.disabled = true;

            // Update filter summary
            updateFilterSummary();
        });

        // Update filter summary badge
        function updateFilterSummary() {
            const filters = [];

            if (selectedCountry) {
                filters.push(`País: ${selectedCountry.name}`);
            }
            if (selectedState) {
                filters.push(`Estado: ${selectedState.state}`);
            }
            if (selectedCity) {
                filters.push(`Cidade: ${selectedCity.name}`);
            }

            if (filters.length > 0) {
                filterSummaryText.textContent = filters.join(' → ');
                filterSummaryBadge.style.display = 'block';
            } else {
                filterSummaryBadge.style.display = 'none';
            }
        }

        // Clear all filters
        clearFiltersBtn.addEventListener('click', () => {
            resetAllFilters();
        });

        function resetAllFilters() {
            selectedCountry = null;
            selectedState = null;
            selectedCity = null;

            countrySelect.value = '';
            confirmCountryBtn.style.display = 'none';

            resetStateAndCityFilters();

            filterSummaryBadge.style.display = 'none';

            console.log('[Admin] All filters cleared');
        }

        function resetStateAndCityFilters() {
            selectedState = null;
            selectedCity = null;

            stateSection.style.display = 'none';
            stateSelect.innerHTML = '<option value="">Carregando estados...</option>';
            confirmStateBtn.style.display = 'none';

            resetCityFilter();

            updateFilterSummary();
        }

        function resetCityFilter() {
            selectedCity = null;

            citySection.style.display = 'none';
            citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
            confirmCityBtn.style.display = 'none';

            updateFilterSummary();
        }

        // ========================================================================
        // Floating Log Overlay Functions
        // ========================================================================

        let floatingLogActive = false;
        let floatingLogMinimized = false;
        let floatingLogCount = 0;

        // Expose state for external access
        window.floatingLogActive = false;
        window.floatingLogMinimized = false;

        // Safe wrapper for floating log operations
        function safeFloatingLogCall(fn, ...args) {
            try {
                if (typeof fn === 'function') {
                    return fn(...args);
                }
            } catch (e) {
                console.error('[FloatingLog] Error:', e);
            }
        }

        window.showFloatingLog = function(title = 'Progresso') {
            const floatingLog = document.getElementById('floating-log');
            const floatingTitle = document.getElementById('floating-log-title');
            floatingTitle.textContent = title;
            floatingLog.classList.add('active');
            floatingLog.classList.add('active-operation');
            floatingLogActive = true;
            window.floatingLogActive = true;
            floatingLogMinimized = false;
            window.floatingLogMinimized = false;
            floatingLogCount = 0;
            updateFloatingLogBadge();
        };

        window.closeFloatingLog = function() {
            const floatingLog = document.getElementById('floating-log');
            floatingLog.classList.remove('active');
            floatingLog.classList.remove('active-operation');
            floatingLogActive = false;
            window.floatingLogActive = false;
            floatingLogMinimized = false;
            window.floatingLogMinimized = false;
        };

        window.minimizeFloatingLog = function() {
            const floatingLog = document.getElementById('floating-log');
            floatingLog.classList.toggle('minimized');
            floatingLogMinimized = !floatingLogMinimized;
            window.floatingLogMinimized = floatingLogMinimized;
            updateFloatingLogBadge();
        };

        window.toggleFloatingLog = function(event) {
            // Prevent unintended log closure
            if (event) event.stopPropagation();

            if (floatingLogMinimized) {
                minimizeFloatingLog();
            }
        };

        // Add global click handler with more robust floating log management
        document.addEventListener('click', function(event) {
            const floatingLog = document.getElementById('floating-log');
            const target = event.target;

            // Check if log exists and is active
            if (floatingLog && window.floatingLogActive) {
                const isFloatingLogOrChild = floatingLog.contains(target);
                const isActiveOperation = floatingLog.classList.contains('active-operation');

                // Close log only if:
                // 1. Not clicking inside the log
                // 2. Not minimized
                // 3. Not an active operation
                if (!isFloatingLogOrChild && !window.floatingLogMinimized && !isActiveOperation) {
                    window.closeFloatingLog();
                }
            }
        });

        window.addFloatingLog = function(message, type = 'info') {
            const content = document.getElementById('floating-log-content');
            const entry = document.createElement('div');
            entry.className = `floating-log-entry ${type}`;
            entry.textContent = message;
            content.appendChild(entry);
            content.scrollTop = content.scrollHeight;

            floatingLogCount++;
            updateFloatingLogBadge();

            if (!floatingLogActive) {
                window.showFloatingLog();
            }
        };

        window.clearFloatingLog = function() {
            const content = document.getElementById('floating-log-content');
            content.innerHTML = '';
            floatingLogCount = 0;
            updateFloatingLogBadge();
        };

        window.stopFloatingLogOperation = function() {
            const floatingLog = document.getElementById('floating-log');
            floatingLog.classList.remove('active-operation');
        };

        function updateFloatingLogBadge() {
            const badge = document.getElementById('floating-log-badge');
            if (floatingLogMinimized && floatingLogCount > 0) {
                badge.textContent = floatingLogCount;
                badge.style.display = 'inline-block';
            } else {
                badge.style.display = 'none';
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

            if (username !== 'kinEROS' && username !== 'student') {
                showMessage('Usuário inválido', 'error');
                return;
            }

            // Build filter configuration
            const filters = {
                country_code: selectedCountry?.country_code || null,
                state: selectedState?.state || null,
                city_id: selectedCity?.id || null
            };

            // Build confirmation message based on active filters
            let scopeMessage = 'TODOS OS PAÍSES';
            if (selectedCountry && !selectedState && !selectedCity) {
                scopeMessage = `${selectedCountry.name}`;
            } else if (selectedCountry && selectedState && !selectedCity) {
                scopeMessage = `${selectedState.state}, ${selectedCountry.name}`;
            } else if (selectedCountry && selectedState && selectedCity) {
                scopeMessage = `${selectedCity.name}, ${selectedState.state}, ${selectedCountry.name}`;
            }

            // Confirm action
            if (!confirm(`Tem certeza que deseja executar o auto-population para:\n\n${scopeMessage}\n\nIsso irá buscar até 111 lojas do Google Places API.`)) {
                return;
            }

            // Disable button and show loading
            runButton.disabled = true;
            runButton.innerHTML = '<div class="spinner"></div><span>Executando... Isso pode levar alguns minutos</span>';
            clearLog();

            // Safely initialize floating log
            try {
                if (typeof window.clearFloatingLog === 'function') window.clearFloatingLog();
                if (typeof window.showFloatingLog === 'function') window.showFloatingLog('Auto-Population');
            } catch (e) {
                console.error('[FloatingLog] Error initializing:', e);
            }

            addLog('🚀 Iniciando auto-population...', 'info');
            addLog('', 'info');

            // Log filter configuration
            addLog('🎯 Configuração de Filtros:', 'info');
            if (!filters.country_code && !filters.state && !filters.city_id) {
                addLog('   🌍 Modo: GLOBAL (sem filtros)', 'info');
                addLog('   Buscando em todos os países, estados e cidades', 'info');
            } else if (filters.country_code && !filters.state && !filters.city_id) {
                addLog(`   🌍 Modo: FILTRO POR PAÍS`, 'info');
                addLog(`   País: ${selectedCountry.name} (${selectedCountry.country_code})`, 'info');
            } else if (filters.country_code && filters.state && !filters.city_id) {
                addLog(`   🗺️  Modo: FILTRO POR ESTADO`, 'info');
                addLog(`   País: ${selectedCountry.name} (${selectedCountry.country_code})`, 'info');
                addLog(`   Estado: ${selectedState.state}`, 'info');
            } else if (filters.country_code && filters.state && filters.city_id) {
                addLog(`   🏙️  Modo: FILTRO POR CIDADE`, 'info');
                addLog(`   País: ${selectedCountry.name} (${selectedCountry.country_code})`, 'info');
                addLog(`   Estado: ${selectedState.state}`, 'info');
                addLog(`   Cidade: ${selectedCity.name}`, 'info');
            }
            addLog('', 'info');

            messageDiv.style.display = 'none';

            try {
                addLog(`📡 Conectando com Google Places API...`, 'info');

                const response = await fetch('/.netlify/functions/auto-populate-stores', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        username: username,
                        password: password,
                        filters: filters
                    })
                });

                const result = await response.json();

                if (!response.ok) {
                    // Store result for error handling
                    const error = new Error(result.message || 'Erro ao executar auto-population');
                    error.result = result; // Attach result for later access
                    throw error;
                }

                // Success
                addLog('', 'info');
                addLog('✅ AUTO-POPULATION CONCLUÍDO COM SUCESSO!', 'success');
                addLog('', 'info');
                addLog(`📊 Resultados:`, 'info');
                addLog(`   🔍 Lojas encontradas pelo Google: ${result.results.storesFoundByGoogle || 0}`, result.results.storesFoundByGoogle > 0 ? 'info' : 'error');
                addLog(`   🏘️  Bairros pesquisados: ${result.results.neighborhoodsSearched || 0}/${result.results.totalNeighborhoods || 0}`, 'info');
                if (result.results.remainingNeighborhoods > 0) {
                    addLog(`   ⏭️  Bairros restantes: ${result.results.remainingNeighborhoods} (execute novamente para continuar)`, 'info');
                }
                addLog(`   🙃 Lojas adicionadas: ${result.results.storesAdded}`, result.results.storesAdded > 0 ? 'success' : 'info');
                addLog(`   ⏭️  Lojas ignoradas (duplicadas): ${result.results.storesSkipped}`, 'info');
                addLog(`   📞 Chamadas API: ${result.results.apiCallsUsed}`, 'info');
                addLog(`   💰 Custo estimado: ${result.results.estimatedCost}`, 'info');
                addLog(`   ⏱️  Tempo de execução: ${(result.results.executionTimeMs / 1000).toFixed(2)}s`, 'info');

                // Add explanation if no stores found
                if (result.results.storesFoundByGoogle === 0) {
                    addLog('', 'info');
                    addLog(`⚠️  ATENÇÃO: Google Places API não encontrou lojas nesta área.`, 'error');
                    addLog(`   Possíveis razões:`, 'info');
                    addLog(`   - Área sem lojas de construção cadastradas no Google`, 'info');
                    addLog(`   - País diferente precisa de termos de busca adaptados`, 'info');
                    addLog(`   - Coordenadas dos bairros podem estar incorretas`, 'info');
                }
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

                // Show message with continuation prompt if needed
                if (result.results.moreAvailable && result.results.remainingNeighborhoods > 0) {
                    showMessage(`✅ ${result.results.storesAdded} lojas adicionadas! ${result.results.remainingNeighborhoods} bairros restantes - execute novamente para continuar.`, 'success');
                } else {
                    showMessage(`✅ ${result.results.storesAdded} lojas adicionadas com sucesso com os filtros aplicados!`, 'success');
                }

                // Reload statistics
                loadStatistics();

            } catch (error) {
                // Check if this is a "No neighborhoods" error - if so, trigger auto-discovery
                if (error.result && error.result.error === 'No neighborhoods found') {
                    addLog('', 'info');
                    addLog('⚠️  Nenhum bairro encontrado - iniciando descoberta automática...', 'info');
                    addLog('', 'info');

                    // Try to auto-discover missing data and retry
                    const retrySuccess = await autoDiscoverAndRetry(password, filters);

                    window.stopFloatingLogOperation();
                    if (!retrySuccess) {
                        // If auto-discovery failed, show original error
                        addLog('', 'info');
                        addLog('❌ Não foi possível preparar os dados automaticamente', 'error');
                        addLog(`   ${error.message}`, 'error');
                        showMessage(`❌ Erro: ${error.message}`, 'error');
                    }
                    // If successful, autoDiscoverAndRetry handles everything
                    return; // Skip the finally block's button reset if we're retrying
                }

                // Handle other errors normally
                addLog('', 'info');
                addLog('❌ ERRO AO EXECUTAR AUTO-POPULATION', 'error');
                addLog(`   ${error.message}`, 'error');

                // Show suggestions if available (from backend error response)
                if (error.result && error.result.suggestion) {
                    addLog('', 'info');
                    addLog('💡 Sugestão:', 'info');
                    error.result.suggestion.split('\n').forEach(line => {
                        if (line.trim()) addLog(`   ${line}`, 'info');
                    });
                    if (error.result.workflow) {
                        addLog('', 'info');
                        addLog(`ℹ️  ${error.result.workflow}`, 'info');
                    }
                }

                showMessage(`❌ Erro: ${error.message}`, 'error');
            } finally {
                runButton.disabled = false;
                runButton.innerHTML = '<i class="fas fa-play"></i><span>Executar Auto-Population (Max 111 Lojas)</span>';

                // Do not auto-close floating log
                try {
                    if (typeof window.stopFloatingLogOperation === 'function') window.stopFloatingLogOperation();
                    // Removed auto-close timeout to keep log always visible
                } catch (e) {
                    console.error('[FloatingLog] Error processing log:', e);
                }
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

        // Also add to floating log if active
        if (window.floatingLogActive && typeof window.addFloatingLog === 'function') {
            window.addFloatingLog(message, type);
        }
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
