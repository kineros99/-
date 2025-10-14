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
    const resetApurationBtn = document.getElementById('reset-apuration-btn');
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

        // Enable reset button when city is selected
        resetApurationBtn.disabled = false;

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
    // Reset Apuration Counts
    // ========================================================================
    resetApurationBtn.addEventListener('click', async () => {
        if (!selectedCity) {
            showMessage('Selecione uma cidade primeiro', 'error');
            return;
        }

        const confirmMsg = `⚠️ ATENÇÃO: Esta ação irá resetar os contadores de apuração para TODOS os ${allNeighborhoods.length} bairros de ${selectedCity.name}.\n\n` +
                          `Todos os bairros voltarão para "Primeira apuração" com limite de 666 lojas.\n\n` +
                          `Deseja continuar?`;

        if (!confirm(confirmMsg)) {
            return;
        }

        // Get credentials
        const username = document.getElementById('exec-username').value.trim();
        const password = document.getElementById('exec-password').value.trim();

        if (!username || !password) {
            showMessage('Por favor, preencha usuário e senha primeiro', 'error');
            return;
        }

        if (username !== 'kinEROS') {
            showMessage('Usuário inválido', 'error');
            return;
        }

        // Disable button and show loading
        resetApurationBtn.disabled = true;
        const originalText = resetApurationBtn.innerHTML;
        resetApurationBtn.innerHTML = '<div class="spinner"></div><span>Resetando...</span>';

        try {
            addLog('🔄 Resetando contadores de apuração...', 'info');

            const response = await fetch('/.netlify/functions/reset-apuration-counts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    password: password,
                    cityId: selectedCity.id
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.message || 'Erro ao resetar contadores');
            }

            addLog(`✅ ${result.neighborhoods_reset} bairros resetados com sucesso!`, 'success');
            addLog(`⏱️  Tempo de execução: ${result.execution_time_ms}ms`, 'info');
            showMessage(`✅ Contadores resetados com sucesso! ${result.neighborhoods_reset} bairros voltaram para primeira apuração.`, 'success');

            // Reload neighborhoods to show updated counts
            setTimeout(() => {
                addLog('🔄 Recarregando bairros...', 'info');
                loadNeighborhoods(selectedCity.id);
            }, 1000);

        } catch (error) {
            addLog(`❌ Erro ao resetar contadores: ${error.message}`, 'error');
            showMessage(`❌ Erro: ${error.message}`, 'error');
        } finally {
            resetApurationBtn.innerHTML = originalText;
            resetApurationBtn.disabled = false;
        }
    });

    // ========================================================================
    // Run Scoped Auto-Population
    // ========================================================================
    const execUsernameInput = document.getElementById('exec-username');
    const execPasswordInput = document.getElementById('exec-password');

    // Batch configuration to prevent timeouts
    const BATCH_SIZE = 12; // 12 neighborhoods = ~24 seconds, safe under 30s limit

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
            const neighborhoodArray = Array.from(selectedNeighborhoods);
            addLog(`📍 Bairros selecionados: ${neighborhoodArray.length}`, 'info');

            // Determine if batching is needed
            const needsBatching = neighborhoodArray.length > BATCH_SIZE;
            const batches = [];

            if (needsBatching) {
                // Split into batches
                for (let i = 0; i < neighborhoodArray.length; i += BATCH_SIZE) {
                    batches.push(neighborhoodArray.slice(i, i + BATCH_SIZE));
                }
                addLog(`⚙️  Dividindo em ${batches.length} lotes para evitar timeout`, 'info');
                batches.forEach((batch, idx) => {
                    addLog(`   Lote ${idx + 1}: ${batch.length} bairros`, 'info');
                });
                addLog('', 'info');
            } else {
                batches.push(neighborhoodArray);
            }

            addLog('📡 Conectando com Google Places API...', 'info');
            addLog('', 'info');

            // Track cumulative results across all batches
            let totalStoresAdded = 0;
            let totalStoresSkipped = 0;
            let totalApiCalls = 0;
            let totalExecutionTime = 0;
            let allNeighborhoodResults = [];
            let allErrors = [];
            let finalStatistics = null;

            // Process each batch sequentially
            for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
                const batch = batches[batchIndex];
                const batchNum = batchIndex + 1;

                if (needsBatching) {
                    addLog(`📦 Processando Lote ${batchNum}/${batches.length} (${batch.length} bairros)...`, 'info');
                } else {
                    addLog(`📦 Processando ${batch.length} bairros...`, 'info');
                }

                try {
                    const response = await fetch('/.netlify/functions/scoped-auto-populate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            password: password,
                            neighborhood_ids: batch
                        })
                    });

                    // Try to parse JSON, but handle timeout errors gracefully
                    let result;
                    try {
                        result = await response.json();
                    } catch (parseError) {
                        // If JSON parsing fails, it's likely a timeout error
                        if (response.status === 500) {
                            addLog('', 'info');
                            addLog(`⚠️  Lote ${batchNum} TIMEOUT (30 segundos)`, 'error');
                            addLog('ℹ️  O lote pode ainda estar processando em segundo plano', 'info');
                            addLog('', 'info');

                            // Continue with next batch instead of stopping
                            if (batchIndex < batches.length - 1) {
                                addLog('⏭️  Continuando com próximo lote...', 'info');
                                continue;
                            } else {
                                // Last batch timed out
                                addLog('⚠️  Último lote com timeout. Recarregando para verificar resultados...', 'info');
                                break;
                            }
                        }
                        throw new Error(`Erro ao processar resposta do lote ${batchNum}: ${parseError.message}`);
                    }

                    if (!response.ok) {
                        throw new Error(result.message || `Erro ao executar lote ${batchNum}`);
                    }

                    // Aggregate results from this batch
                    totalStoresAdded += result.summary.stores_added;
                    totalStoresSkipped += result.summary.stores_skipped;
                    totalApiCalls += result.summary.api_calls_used;
                    totalExecutionTime += result.summary.execution_time_ms;
                    allNeighborhoodResults.push(...result.neighborhoods);
                    if (result.errors && result.errors.length > 0) {
                        allErrors.push(...result.errors);
                    }
                    finalStatistics = result.statistics; // Keep updating with latest

                    // Show batch summary
                    addLog(`   ✅ Lote ${batchNum}: +${result.summary.stores_added} lojas, ${result.summary.stores_skipped} duplicadas`, 'success');
                    addLog(`   ⏱️  Tempo: ${(result.summary.execution_time_ms / 1000).toFixed(2)}s`, 'info');
                    addLog('', 'info');

                    // Small delay between batches to avoid overwhelming the API
                    if (batchIndex < batches.length - 1) {
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }

                } catch (batchError) {
                    addLog(`   ❌ Erro no lote ${batchNum}: ${batchError.message}`, 'error');
                    addLog('', 'info');

                    // Continue with next batch instead of stopping everything
                    if (batchIndex < batches.length - 1) {
                        addLog('⏭️  Continuando com próximo lote...', 'info');
                    }
                }
            }

            // Display final combined results
            addLog('', 'info');
            addLog('✅ SCOPED AUTO-POPULATION CONCLUÍDO!', 'success');
            addLog('', 'info');
            addLog(`📊 Resumo Total (todos os lotes):`, 'info');
            addLog(`   🏘️  Bairros processados: ${allNeighborhoodResults.length}`, 'info');
            addLog(`   🙃 Total de lojas adicionadas: ${totalStoresAdded}`, 'success');
            addLog(`   ⏭️  Total de lojas ignoradas (duplicadas): ${totalStoresSkipped}`, 'info');
            addLog(`   📞 Total de chamadas API: ${totalApiCalls}`, 'info');
            addLog(`   💰 Custo total estimado: $${(totalApiCalls * 0.032).toFixed(4)}`, 'info');
            addLog(`   ⏱️  Tempo total de execução: ${(totalExecutionTime / 1000).toFixed(2)}s`, 'info');

            // Per-neighborhood results
            if (allNeighborhoodResults.length > 0) {
                addLog('', 'info');
                addLog(`📍 Resultados por Bairro:`, 'info');
                allNeighborhoodResults.forEach(n => {
                    if (n.error) {
                        addLog(`   ❌ ${n.neighborhood_name}: ERRO - ${n.error}`, 'error');
                    } else {
                        addLog(`   ✓ ${n.neighborhood_name}: +${n.stores_added} lojas (${n.stores_skipped} duplicadas)`, 'success');
                    }
                });
            }

            if (finalStatistics) {
                addLog('', 'info');
                addLog(`📈 Estatísticas Gerais:`, 'info');
                addLog(`   🙂 Usuários: ${finalStatistics.user_added_count}`, 'info');
                addLog(`   🙃 Auto-populadas: ${finalStatistics.auto_added_count}`, 'success');
                addLog(`   📊 Total: ${finalStatistics.total_stores}`, 'info');
            }

            if (allErrors.length > 0) {
                addLog('', 'info');
                addLog(`⚠️  Alguns erros ocorreram (${allErrors.length}):`, 'error');
                allErrors.slice(0, 10).forEach(err => {
                    addLog(`   - ${err.store}: ${err.error}`, 'error');
                });
                if (allErrors.length > 10) {
                    addLog(`   ... e mais ${allErrors.length - 10} erros`, 'error');
                }
            }

            showMessage(`✅ ${totalStoresAdded} lojas adicionadas em ${allNeighborhoodResults.length} bairros!`, 'success');

            // Reload neighborhoods to show updated apuration counts
            if (selectedCity) {
                setTimeout(() => loadNeighborhoods(selectedCity.id), 2000);
            }

        } catch (error) {
            addLog('', 'info');
            addLog('❌ ERRO AO EXECUTAR SCOPED AUTO-POPULATION', 'error');
            addLog(`   ${error.message}`, 'error');

            // Show console logs for debugging
            addLog('', 'info');
            addLog('💡 Dica: Verifique os logs do console do servidor para mais detalhes', 'info');

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
