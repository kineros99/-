document.addEventListener('DOMContentLoaded', () => {
    // ========================================================================
    // Main Application
    // ========================================================================
    let allCities = [];
    let allNeighborhoods = [];
    let selectedCity = null;
    let selectedNeighborhoods = new Set();

    // DOM Elements
    const citySearchInput = document.getElementById('city-search');
    const cityDropdown = document.getElementById('city-dropdown');
    const selectedCityInfo = document.getElementById('selected-city-info');
    const selectedCityName = document.getElementById('selected-city-name');
    const neighborhoodsContainer = document.getElementById('neighborhoods-container');
    const selectAllBtn = document.getElementById('select-all-btn');
    const runButton = document.getElementById('runButton');
    const logDiv = document.getElementById('log');
    const messageDiv = document.getElementById('message');

    // Summary elements
    const summaryNeighborhoods = document.getElementById('summary-neighborhoods');
    const summaryTotalLimit = document.getElementById('summary-total-limit');
    const summaryCost = document.getElementById('summary-cost');

    // Initialize app on load
    loadCities();
    setupCitySearch();

    // ========================================================================
    // Fuzzy String Matching (removes accents, special chars, ignores case)
    // ========================================================================
    function normalizeString(str) {
        return str
            .toLowerCase()
            .normalize('NFD')  // Decompose accented characters
            .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
            .replace(/[`~'",.!?;:]/g, '')  // Remove special punctuation
            .trim();
    }

    function fuzzyMatch(search, target) {
        const normalizedSearch = normalizeString(search);
        const normalizedTarget = normalizeString(target);
        return normalizedTarget.includes(normalizedSearch);
    }

    // ========================================================================
    // Load Cities
    // ========================================================================
    async function loadCities() {
        try {
            addLog('📍 Carregando cidades...', 'info');

            const response = await fetch('/.netlify/functions/get-cities');
            if (!response.ok) throw new Error('Failed to fetch cities');

            allCities = await response.json();

            addLog(`✅ ${allCities.length} cidades carregadas`, 'success');

        } catch (error) {
            console.error('Error loading cities:', error);
            addLog('❌ Erro ao carregar cidades', 'error');
        }
    }

    // ========================================================================
    // City Search with Fuzzy Matching
    // ========================================================================
    function setupCitySearch() {
        // Show dropdown on focus
        citySearchInput.addEventListener('focus', () => {
            if (citySearchInput.value.trim()) {
                performSearch(citySearchInput.value);
            }
        });

        // Search as user types
        citySearchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.trim();

            if (searchTerm.length === 0) {
                cityDropdown.classList.remove('active');
                return;
            }

            performSearch(searchTerm);
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.city-search-container')) {
                cityDropdown.classList.remove('active');
            }
        });
    }

    function performSearch(searchTerm) {
        // Filter cities using fuzzy matching
        const matchedCities = allCities.filter(city => {
            return fuzzyMatch(searchTerm, city.name) ||
                   fuzzyMatch(searchTerm, city.state) ||
                   fuzzyMatch(searchTerm, `${city.name} ${city.state}`);
        });

        renderCityDropdown(matchedCities, searchTerm);
    }

    function renderCityDropdown(cities, searchTerm) {
        cityDropdown.innerHTML = '';

        if (cities.length === 0) {
            // No cities found - offer to discover
            const discoverOption = document.createElement('div');
            discoverOption.className = 'city-option';
            discoverOption.style.cursor = 'pointer';
            discoverOption.style.background = '#f0f8ff';
            discoverOption.style.borderLeft = '4px solid #667eea';

            discoverOption.innerHTML = `
                <div class="city-option-name">🔍 Procurar "${searchTerm}" no Google Maps</div>
                <div class="city-option-info">Clique para descobrir esta cidade</div>
            `;

            discoverOption.addEventListener('click', () => {
                discoverCity(searchTerm);
            });

            cityDropdown.appendChild(discoverOption);
            cityDropdown.classList.add('active');
            return;
        }

        cities.forEach(city => {
            const option = document.createElement('div');
            option.className = 'city-option';
            option.dataset.cityId = city.id;

            option.innerHTML = `
                <div class="city-option-name">${city.name}, ${city.state}</div>
                <div class="city-option-info">${city.neighborhood_count} bairros disponíveis</div>
            `;

            option.addEventListener('click', () => {
                selectCity(city);
            });

            cityDropdown.appendChild(option);
        });

        cityDropdown.classList.add('active');
    }

    async function selectCity(city) {
        selectedCity = city;
        citySearchInput.value = `${city.name}, ${city.state}`;
        cityDropdown.classList.remove('active');

        // Show selected city info
        selectedCityName.textContent = `${city.name}, ${city.state} (${city.neighborhood_count} bairros)`;
        selectedCityInfo.style.display = 'block';

        // Load neighborhoods
        await loadNeighborhoods(city.id);
    }

    // ========================================================================
    // Discover City (Google Maps API)
    // ========================================================================
    async function discoverCity(cityName) {
        cityDropdown.classList.remove('active');
        cityDropdown.innerHTML = '';

        // Show loading state
        neighborhoodsContainer.innerHTML = '<div class="loading">🔍 Procurando cidade no Google Maps...</div>';
        addLog(`🔍 Procurando "${cityName}" no Google Maps...`, 'info');

        try {
            // Step 1: Discover the city
            const discoverResponse = await fetch('/.netlify/functions/discover-city', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityName: cityName })
            });

            const discoverResult = await discoverResponse.json();

            if (!discoverResponse.ok || !discoverResult.success) {
                throw new Error(discoverResult.error || 'Failed to discover city');
            }

            const city = discoverResult.city;
            addLog(`✅ Cidade encontrada: ${city.name}, ${city.state}`, 'success');

            // Step 2: Discover neighborhoods for this city
            neighborhoodsContainer.innerHTML = '<div class="loading">📍 Descobrindo bairros...</div>';
            addLog(`📍 Descobrindo bairros de ${city.name}...`, 'info');

            const neighborhoodsResponse = await fetch('/.netlify/functions/discover-neighborhoods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityId: city.id })
            });

            const neighborhoodsResult = await neighborhoodsResponse.json();

            if (!neighborhoodsResponse.ok || !neighborhoodsResult.success) {
                throw new Error(neighborhoodsResult.error || 'Failed to discover neighborhoods');
            }

            addLog(`✅ ${neighborhoodsResult.count} bairros descobertos!`, 'success');

            // Step 3: Reload cities list to include the new city
            await loadCities();

            // Step 4: Select the discovered city
            const discoveredCity = {
                id: city.id,
                name: city.name,
                state: city.state,
                country: city.country,
                center_lat: city.center_lat,
                center_lng: city.center_lng,
                neighborhood_count: neighborhoodsResult.count
            };

            await selectCity(discoveredCity);

        } catch (error) {
            console.error('Error discovering city:', error);
            addLog(`❌ Erro ao descobrir cidade: ${error.message}`, 'error');
            neighborhoodsContainer.innerHTML = `<div class="loading" style="color: #dc3545;">Erro: ${error.message}</div>`;
        }
    }

    // ========================================================================
    // Load Neighborhoods
    // ========================================================================
    async function loadNeighborhoods(cityId) {
        try {
            neighborhoodsContainer.innerHTML = '<div class="loading">Carregando bairros...</div>';
            addLog(`📍 Carregando bairros da cidade ${cityId}...`, 'info');

            const response = await fetch(`/.netlify/functions/get-neighborhoods?city_id=${cityId}`);
            if (!response.ok) throw new Error('Failed to fetch neighborhoods');

            const neighborhoods = await response.json();
            allNeighborhoods = neighborhoods;
            selectedNeighborhoods.clear();

            if (neighborhoods.length === 0) {
                neighborhoodsContainer.innerHTML = '<div class="loading">Nenhum bairro encontrado para esta cidade.</div>';
                addLog('⚠️  Nenhum bairro encontrado', 'error');
                return;
            }

            // Render neighborhoods
            neighborhoodsContainer.innerHTML = '';
            neighborhoods.forEach(neighborhood => {
                const card = createNeighborhoodCard(neighborhood);
                neighborhoodsContainer.appendChild(card);
            });

            addLog(`✅ ${neighborhoods.length} bairros carregados`, 'success');
            updateSummary();

        } catch (error) {
            console.error('Error loading neighborhoods:', error);
            neighborhoodsContainer.innerHTML = '<div class="loading">Erro ao carregar bairros</div>';
            addLog('❌ Erro ao carregar bairros', 'error');
        }
    }

    function createNeighborhoodCard(neighborhood) {
        const card = document.createElement('div');
        card.className = 'neighborhood-card';
        card.dataset.neighborhoodId = neighborhood.id;

        const apurationText = neighborhood.apuration_count === 0
            ? 'Primeira apuração'
            : `Apuração #${neighborhood.apuration_count + 1}`;

        card.innerHTML = `
            <label style="display: flex; align-items: start; cursor: pointer;">
                <input type="checkbox" data-neighborhood-id="${neighborhood.id}">
                <div style="flex: 1;">
                    <div class="neighborhood-name">${neighborhood.name}</div>
                    <div class="neighborhood-info">
                        📍 Raio: ${neighborhood.radius}m
                    </div>
                    <div class="neighborhood-info">
                        🔄 ${apurationText}
                    </div>
                    <div class="limit-badge">
                        Próximo limite: ${neighborhood.next_limit} lojas
                    </div>
                </div>
            </label>
        `;

        // Add event listener to checkbox
        const checkbox = card.querySelector('input[type="checkbox"]');
        checkbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                selectedNeighborhoods.add(parseInt(neighborhood.id));
                card.classList.add('selected');
            } else {
                selectedNeighborhoods.delete(parseInt(neighborhood.id));
                card.classList.remove('selected');
            }
            updateSummary();
        });

        // Allow clicking anywhere on card to toggle
        card.addEventListener('click', (e) => {
            if (e.target.type !== 'checkbox') {
                checkbox.checked = !checkbox.checked;
                checkbox.dispatchEvent(new Event('change'));
            }
        });

        return card;
    }

    // ========================================================================
    // Select All Button
    // ========================================================================
    selectAllBtn.addEventListener('click', () => {
        const checkboxes = neighborhoodsContainer.querySelectorAll('input[type="checkbox"]');
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);

        checkboxes.forEach(checkbox => {
            checkbox.checked = !allChecked;
            checkbox.dispatchEvent(new Event('change'));
        });

        selectAllBtn.textContent = allChecked ? 'Selecionar Todos' : 'Desselecionar Todos';
    });

    // ========================================================================
    // Update Summary
    // ========================================================================
    function updateSummary() {
        const selectedCount = selectedNeighborhoods.size;

        // Calculate total limit
        let totalLimit = 0;
        allNeighborhoods.forEach(n => {
            if (selectedNeighborhoods.has(n.id)) {
                totalLimit += n.next_limit;
            }
        });

        // Estimate API calls (approximately 1 call per 20 stores)
        const estimatedApiCalls = Math.ceil(totalLimit / 20) * selectedCount;
        const estimatedCost = (estimatedApiCalls * 0.032).toFixed(2);

        summaryNeighborhoods.textContent = selectedCount;
        summaryTotalLimit.textContent = totalLimit;
        summaryCost.textContent = `$${estimatedCost}`;

        // Enable/disable run button
        runButton.disabled = selectedCount === 0;
    }

    // ========================================================================
    // Run Scoped Auto-Population
    // ========================================================================
    const execUsernameInput = document.getElementById('exec-username');
    const execPasswordInput = document.getElementById('exec-password');

    runButton.addEventListener('click', async () => {
        if (selectedNeighborhoods.size === 0) {
            showMessage('Selecione pelo menos um bairro', 'error');
            return;
        }

        const username = execUsernameInput.value.trim();
        const password = execPasswordInput.value.trim();

        if (!username || !password) {
            showMessage('Por favor, preencha usuário e senha', 'error');
            return;
        }

        if (username !== 'kinEROS') {
            showMessage('Usuário inválido', 'error');
            return;
        }

        // Confirm action
        const confirmMsg = `Tem certeza que deseja executar a apuração para ${selectedNeighborhoods.size} bairros?\n\n` +
                          `Limite total: ${summaryTotalLimit.textContent} lojas\n` +
                          `Custo estimado: ${summaryCost.textContent}`;

        if (!confirm(confirmMsg)) {
            return;
        }

        // Disable button and show loading
        runButton.disabled = true;
        runButton.innerHTML = '<div class="spinner"></div><span>Executando... Isso pode levar alguns minutos</span>';
        clearLog();
        addLog('🚀 Iniciando scoped auto-population...', 'info');
        messageDiv.style.display = 'none';

        try {
            addLog(`📍 Bairros selecionados: ${selectedNeighborhoods.size}`, 'info');
            addLog('📡 Conectando com Google Places API...', 'info');

            const response = await fetch('/.netlify/functions/scoped-auto-populate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: password,
                    neighborhood_ids: Array.from(selectedNeighborhoods)
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro ao executar scoped auto-population');
            }

            // Success!
            addLog('', 'info');
            addLog('✅ SCOPED AUTO-POPULATION CONCLUÍDO COM SUCESSO!', 'success');
            addLog('', 'info');
            addLog(`📊 Resumo Geral:`, 'info');
            addLog(`   🏘️  Bairros pesquisados: ${result.summary.neighborhoods_searched}`, 'info');
            addLog(`   🙃 Lojas adicionadas: ${result.summary.stores_added}`, 'success');
            addLog(`   ⏭️  Lojas ignoradas (duplicadas): ${result.summary.stores_skipped}`, 'info');
            addLog(`   📞 Chamadas API: ${result.summary.api_calls_used}`, 'info');
            addLog(`   💰 Custo estimado: ${result.summary.estimated_cost}`, 'info');
            addLog(`   ⏱️  Tempo de execução: ${(result.summary.execution_time_ms / 1000).toFixed(2)}s`, 'info');

            // Per-neighborhood results
            addLog('', 'info');
            addLog(`📍 Resultados por Bairro:`, 'info');
            result.neighborhoods.forEach(n => {
                if (n.error) {
                    addLog(`   ❌ ${n.neighborhood_name}: ERRO - ${n.error}`, 'error');
                } else {
                    addLog(`   ✓ ${n.neighborhood_name}: +${n.stores_added} lojas (${n.stores_skipped} duplicadas)`, 'success');
                }
            });

            addLog('', 'info');
            addLog(`📈 Estatísticas Gerais:`, 'info');
            addLog(`   🙂 Usuários: ${result.statistics.user_added_count}`, 'info');
            addLog(`   🙃 Auto-populadas: ${result.statistics.auto_added_count}`, 'success');
            addLog(`   📊 Total: ${result.statistics.total_stores}`, 'info');

            if (result.errors && result.errors.length > 0) {
                addLog('', 'info');
                addLog(`⚠️  Alguns erros ocorreram (${result.errors.length}):`, 'error');
                result.errors.forEach(err => {
                    addLog(`   - ${err.store}: ${err.error}`, 'error');
                });
            }

            showMessage(`✅ ${result.summary.stores_added} lojas adicionadas em ${result.summary.neighborhoods_searched} bairros!`, 'success');

            // Reload neighborhoods to show updated apuration counts
            if (selectedCity) {
                setTimeout(() => loadNeighborhoods(selectedCity.id), 2000);
            }

        } catch (error) {
            addLog('', 'info');
            addLog('❌ ERRO AO EXECUTAR SCOPED AUTO-POPULATION', 'error');
            addLog(`   ${error.message}`, 'error');
            showMessage(`❌ Erro: ${error.message}`, 'error');
        } finally {
            runButton.disabled = false;
            runButton.innerHTML = '<i class="fas fa-play"></i><span>Executar Scoped Auto-Population</span>';
        }
    });

    // ========================================================================
    // Helper Functions
    // ========================================================================
    function addLog(message, type = 'info') {
        const entry = document.createElement('div');
        entry.className = `log-entry log-${type}`;
        entry.textContent = message;
        logDiv.appendChild(entry);
        logDiv.scrollTop = logDiv.scrollHeight;
    }

    function clearLog() {
        logDiv.innerHTML = '';
    }

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }
});
