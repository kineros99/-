document.addEventListener('DOMContentLoaded', () => {
    // ========================================================================
    // Main Application
    // ========================================================================
    let allCountries = [];
    let allStates = [];
    let allCities = [];
    let allNeighborhoods = [];
    let selectedCountry = null;
    let selectedState = null;
    let selectedCity = null;
    let selectedNeighborhoods = new Set();

    // DOM Elements - Country & State
    const countrySelect = document.getElementById('country-select');
    const confirmCountryBtn = document.getElementById('confirm-country-btn');
    const selectedCountryInfo = document.getElementById('selected-country-info');
    const selectedCountryName = document.getElementById('selected-country-name');
    const deselectCountryBtn = document.getElementById('deselect-country-btn');
    const stateSection = document.getElementById('state-section');
    const stateSelect = document.getElementById('state-select');
    const confirmStateBtn = document.getElementById('confirm-state-btn');
    const selectedStateInfo = document.getElementById('selected-state-info');
    const selectedStateName = document.getElementById('selected-state-name');
    const deselectStateBtn = document.getElementById('deselect-state-btn');

    // DOM Elements - City
    const cityFilterInfo = document.getElementById('city-filter-info');
    const cityFilterText = document.getElementById('city-filter-text');
    const citySelect = document.getElementById('city-select');
    const confirmCityBtn = document.getElementById('confirm-city-btn');
    const selectedCityInfo = document.getElementById('selected-city-info');
    const selectedCityName = document.getElementById('selected-city-name');
    const deselectCityBtn = document.getElementById('deselect-city-btn');

    // DOM Elements - Neighborhoods & Execution
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

    // Category selection elements
    const categoryRadios = document.getElementsByName('categoryChoice');
    const customCategoriesDiv = document.getElementById('custom-categories');
    const categoryCheckboxes = document.querySelectorAll('.category-checkbox');
    const estimateApiCalls = document.getElementById('estimate-api-calls');
    const estimateTime = document.getElementById('estimate-time');
    const timeoutWarning = document.getElementById('timeout-warning');

    // Initialize app on load
    loadCountries();
    setupCountrySelector();
    setupStateSelector();
    setupCitySelector();
    setupCategorySelector();

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
    // Category Selector Setup
    // ========================================================================
    function setupCategorySelector() {
        // Show/hide custom categories based on radio selection
        categoryRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.value === 'custom') {
                    customCategoriesDiv.style.display = 'block';
                } else {
                    customCategoriesDiv.style.display = 'none';
                }
                updateApiEstimate();
            });
        });

        // Update estimate when custom categories are checked/unchecked
        categoryCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', (e) => {
                // Prevent unchecking all categories
                const customRadio = document.querySelector('input[name="categoryChoice"][value="custom"]');
                if (customRadio && customRadio.checked) {
                    const checkedCount = Array.from(categoryCheckboxes).filter(cb => cb.checked).length;

                    if (checkedCount === 0) {
                        // Don't allow unchecking the last checkbox
                        e.target.checked = true;
                        showMessage('⚠️ Pelo menos uma categoria deve estar selecionada', 'error');
                        return;
                    }
                }

                updateApiEstimate();
            });
        });
    }

    function getSelectedCategories() {
        const categoryChoice = document.querySelector('input[name="categoryChoice"]:checked');

        if (!categoryChoice) {
            return ['general', 'plumbing', 'hardware']; // Default fallback
        }

        if (categoryChoice.value === 'all') {
            return ['general', 'plumbing', 'hardware', 'paint', 'electrical'];
        }

        if (categoryChoice.value === 'general') {
            return ['general'];
        }

        if (categoryChoice.value === 'custom') {
            const selected = [];
            categoryCheckboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selected.push(checkbox.value);
                }
            });
            return selected.length > 0 ? selected : ['general']; // Default to general if none selected
        }

        return ['general', 'plumbing', 'hardware']; // Fallback
    }

    function updateApiEstimate() {
        const selectedCategories = getSelectedCategories();
        const neighborhoodCount = selectedNeighborhoods.size;

        // Calculate API calls: each category makes 2 API calls (2 keywords per category)
        // Each neighborhood × number of categories × 2 keywords
        const keywordsPerCategory = 2;
        const apiCallsPerNeighborhood = selectedCategories.length * keywordsPerCategory;
        const totalApiCalls = neighborhoodCount * apiCallsPerNeighborhood;

        // Estimate time: ~2 seconds per API call (including delays and processing)
        const estimatedTimeSeconds = totalApiCalls * 2;

        // Update display
        estimateApiCalls.textContent = totalApiCalls;
        estimateTime.textContent = `${estimatedTimeSeconds}s (~${Math.ceil(estimatedTimeSeconds / 60)} min)`;

        // Show timeout warning if exceeds 20 seconds (safe limit)
        if (estimatedTimeSeconds > 20) {
            timeoutWarning.style.display = 'block';
        } else {
            timeoutWarning.style.display = 'none';
        }

        // Note: updateSummary() already calls updateApiEstimate(), so we don't call it here to avoid infinite loop
    }

    // ========================================================================
    // Load Countries
    // ========================================================================
    async function loadCountries() {
        try {
            addLog('🌍 Carregando países...', 'info');

            const response = await fetch('/.netlify/functions/get-countries');
            if (!response.ok) throw new Error('Failed to fetch countries');

            allCountries = await response.json();

            // Populate country dropdown
            countrySelect.innerHTML = '<option value="">Selecione um país...</option>';
            allCountries.forEach(country => {
                const option = document.createElement('option');
                option.value = country.country_code;
                option.textContent = `${country.name} (${country.country_code}) - ${country.city_count} cidades`;
                option.dataset.countryData = JSON.stringify(country);

                // Select Brazil by default
                if (country.country_code === 'BR') {
                    option.selected = true;
                    selectedCountry = country;
                }

                countrySelect.appendChild(option);
            });

            // Enable confirm button if Brazil is selected by default
            if (selectedCountry) {
                confirmCountryBtn.disabled = false;
            }

            addLog(`✅ ${allCountries.length} países carregados`, 'success');

            // Check for URL parameters to auto-select country
            checkUrlParameters();

        } catch (error) {
            console.error('Error loading countries:', error);
            addLog('❌ Erro ao carregar países', 'error');
            countrySelect.innerHTML = '<option value="">Erro ao carregar países</option>';
        }
    }

    // ========================================================================
    // Check URL Parameters for Auto-Selection
    // ========================================================================
    function checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const countryParam = urlParams.get('country');

        if (countryParam) {
            // Find matching country in dropdown
            const countryOption = Array.from(countrySelect.options).find(
                option => option.value.toUpperCase() === countryParam.toUpperCase()
            );

            if (countryOption) {
                // Select the country
                countrySelect.value = countryOption.value;
                selectedCountry = JSON.parse(countryOption.dataset.countryData);
                confirmCountryBtn.disabled = false;
                deselectCountryBtn.style.display = 'inline-flex';

                addLog(`🔗 País pré-selecionado via URL: ${selectedCountry.name}`, 'info');

                // Auto-click confirm button after a brief delay
                setTimeout(() => {
                    confirmCountryBtn.click();
                }, 500);
            } else {
                addLog(`⚠️ País '${countryParam}' não encontrado nos parâmetros da URL`, 'error');
            }
        }
    }

    // ========================================================================
    // Setup Country Selector
    // ========================================================================
    function setupCountrySelector() {
        // Enable/disable confirm button when country changes
        countrySelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption.value) {
                selectedCountry = JSON.parse(selectedOption.dataset.countryData);
                confirmCountryBtn.disabled = false;
                // Show deselect button
                if (!countrySelect.disabled) {
                    deselectCountryBtn.style.display = 'inline-flex';
                }
            } else {
                selectedCountry = null;
                confirmCountryBtn.disabled = true;
                deselectCountryBtn.style.display = 'none';
            }
        });

        // Deselect country button
        deselectCountryBtn.addEventListener('click', () => {
            countrySelect.value = '';
            selectedCountry = null;
            confirmCountryBtn.disabled = true;
            deselectCountryBtn.style.display = 'none';

            // Hide state section and reset
            stateSection.style.display = 'none';
            selectedCountryInfo.style.display = 'none';
            stateSelect.value = '';
            stateSelect.disabled = true;
            selectedState = null;

            addLog('↩️ País deselecionado', 'info');
        });

        // Confirm country selection button
        confirmCountryBtn.addEventListener('click', async () => {
            if (!selectedCountry) return;

            addLog(`🌍 País selecionado: ${selectedCountry.name} (${selectedCountry.country_code})`, 'info');

            // Show selected country info
            selectedCountryName.textContent = `${selectedCountry.name} - ${selectedCountry.city_count} cidades disponíveis`;
            selectedCountryInfo.style.display = 'block';

            // Disable country selector after confirmation
            countrySelect.disabled = true;
            confirmCountryBtn.disabled = true;
            deselectCountryBtn.style.display = 'none'; // Hide deselect button after confirm

            // Load states for this country
            await loadStates(selectedCountry.country_code);

            // Show state section
            stateSection.style.display = 'block';
        });
    }

    // ========================================================================
    // Load States
    // ========================================================================
    async function loadStates(countryCode) {
        try {
            addLog(`📍 Carregando estados de ${selectedCountry.name}...`, 'info');

            const response = await fetch(`/.netlify/functions/get-states?country_code=${countryCode}`);
            if (!response.ok) throw new Error('Failed to fetch states');

            const data = await response.json();
            allStates = data.states || data || []; // Handle both old and new response formats

            // Check if states need to be discovered
            if (data.needsDiscovery || allStates.length === 0) {
                addLog(`⚠️  Nenhum estado encontrado para ${selectedCountry.name}`, 'info');
                addLog(`💡 Clique em "Descobrir Estados" para buscar estados automaticamente`, 'info');

                // Show discover states button
                stateSelect.innerHTML = '<option value="">Nenhum estado disponível</option>';
                stateSelect.disabled = true;

                // Create and show discover button
                const discoverBtn = document.createElement('button');
                discoverBtn.id = 'discover-states-btn';
                discoverBtn.className = 'run-button';
                discoverBtn.style.marginTop = '15px';
                discoverBtn.style.padding = '12px';
                discoverBtn.innerHTML = '<i class="fas fa-search-location"></i><span>Descobrir Estados de ' + selectedCountry.name + '</span>';

                discoverBtn.addEventListener('click', async () => {
                    await discoverStates(countryCode);
                });

                // Insert button after state select
                if (!document.getElementById('discover-states-btn')) {
                    stateSelect.parentElement.insertBefore(discoverBtn, confirmStateBtn);
                }

                return;
            }

            // Populate state dropdown
            stateSelect.innerHTML = '<option value="">Selecione um estado...</option>';
            allStates.forEach(state => {
                const option = document.createElement('option');
                option.value = state.state;

                const cityCountText = state.city_count > 0
                    ? `${state.city_count} cidades`
                    : 'sem cidades';

                option.textContent = `${state.state} (${state.state_code}) - ${cityCountText}`;
                option.dataset.stateData = JSON.stringify(state);
                stateSelect.appendChild(option);
            });

            stateSelect.disabled = false;
            addLog(`✅ ${allStates.length} estados carregados`, 'success');

            // Remove discover button if it exists
            const existingBtn = document.getElementById('discover-states-btn');
            if (existingBtn) {
                existingBtn.remove();
            }

        } catch (error) {
            console.error('Error loading states:', error);
            addLog(`❌ Erro de rede ao carregar estados: ${error.message}`, 'error');
            addLog(`💡 Verifique sua conexão e tente novamente`, 'info');
            stateSelect.innerHTML = '<option value="">Erro de conexão</option>';
            stateSelect.disabled = true;
        }
    }

    // ========================================================================
    // Discover States (NEW)
    // ========================================================================
    async function discoverStates(countryCode) {
        const discoverBtn = document.getElementById('discover-states-btn');
        if (!discoverBtn) return;

        try {
            // Floating log
            clearFloatingLog();
            showFloatingLog('Descobrindo Estados');

            // Disable button and show loading
            discoverBtn.disabled = true;
            const originalHTML = discoverBtn.innerHTML;
            discoverBtn.innerHTML = '<div class="spinner"></div><span>Descobrindo estados...</span>';

            addLog(`🔍 Iniciando descoberta de estados para ${selectedCountry.name}...`, 'info');
            addLog(`⏱️  Isso pode levar até 30 segundos...`, 'info');

            const response = await fetch('/.netlify/functions/discover-states', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ countryCode: countryCode })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Failed to discover states');
            }

            addLog(`✅ ${result.count} estados descobertos!`, 'success');
            addLog(`📊 Fonte: ${result.source === 'geonames' ? 'Geonames API' : 'OpenStreetMap'}`, 'info');

            // Reload states
            await loadStates(countryCode);

            // Stop floating log operation
            stopFloatingLogOperation();
            setTimeout(() => {
                if (!floatingLogMinimized) {
                    closeFloatingLog();
                }
            }, 3000);

        } catch (error) {
            console.error('Error discovering states:', error);
            addLog(`❌ Erro ao descobrir estados: ${error.message}`, 'error');

            // Re-enable button
            if (discoverBtn) {
                discoverBtn.disabled = false;
                discoverBtn.innerHTML = '<i class="fas fa-search-location"></i><span>Tentar Novamente</span>';
            }
        }
    }

    // ========================================================================
    // Setup State Selector
    // ========================================================================
    function setupStateSelector() {
        // Enable/disable confirm button when state changes
        stateSelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption.value && selectedOption.dataset.stateData) {
                selectedState = JSON.parse(selectedOption.dataset.stateData);
                confirmStateBtn.disabled = false;
                // Show deselect button
                if (!stateSelect.disabled) {
                    deselectStateBtn.style.display = 'inline-flex';
                }
            } else {
                selectedState = null;
                confirmStateBtn.disabled = true;
                deselectStateBtn.style.display = 'none';
            }
        });

        // Deselect state button
        deselectStateBtn.addEventListener('click', () => {
            stateSelect.value = '';
            selectedState = null;
            confirmStateBtn.disabled = false;
            deselectStateBtn.style.display = 'none';
            selectedStateInfo.style.display = 'none';

            // Clear city and neighborhoods
            citySelect.value = '';
            citySelect.disabled = true;
            citySelect.innerHTML = '<option value="">Selecione um estado primeiro...</option>';
            confirmCityBtn.disabled = true;
            selectedCity = null;
            selectedCityInfo.style.display = 'none';
            cityFilterInfo.style.display = 'none';
            deselectCityBtn.style.display = 'none';

            // Clear neighborhoods
            neighborhoodsContainer.innerHTML = '<div class="loading">Selecione uma cidade primeiro...</div>';
            selectedNeighborhoods.clear();
            resetApurationBtn.disabled = true;
            updateSummary();

            addLog('↩️ Estado deselecionado', 'info');
        });

        // Confirm state selection button
        confirmStateBtn.addEventListener('click', async () => {
            if (!selectedState) return;

            addLog(`📍 Estado selecionado: ${selectedState.state} (${selectedState.state_code})`, 'info');

            // Show selected state info
            selectedStateName.textContent = `${selectedState.state} - ${selectedState.city_count} cidades disponíveis`;
            selectedStateInfo.style.display = 'block';

            // Disable state selector after confirmation
            stateSelect.disabled = true;
            confirmStateBtn.disabled = true;
            deselectStateBtn.style.display = 'none'; // Hide deselect button after confirm

            // Load cities for this state
            await loadCities(selectedState.state);

            // Show filter info
            cityFilterText.textContent = `${selectedCountry.name} > ${selectedState.state}`;
            cityFilterInfo.style.display = 'block';
        });
    }

    // ========================================================================
    // Load Cities (updated to use state filter and populate dropdown)
    // ========================================================================
    async function loadCities(state) {
        try {
            addLog(`🏙️  Carregando cidades de ${state}...`, 'info');

            citySelect.innerHTML = '<option value="">Carregando cidades...</option>';
            citySelect.disabled = true;

            const response = await fetch(`/.netlify/functions/get-cities?state=${encodeURIComponent(state)}`);
            if (!response.ok) throw new Error('Failed to fetch cities');

            allCities = await response.json();

            citySelect.innerHTML = '<option value="">Selecione uma cidade...</option>';

            if (allCities.length === 0) {
                // No cities found - show discover button
                addLog(`⚠️  Nenhuma cidade encontrada para ${state}`, 'info');
                addLog(`💡 Clique em "Descobrir Cidades" para popular o banco de dados`, 'info');

                citySelect.innerHTML = '<option value="">Nenhuma cidade disponível</option>';
                citySelect.disabled = true;
                confirmCityBtn.style.display = 'none';

                // Create and show discover cities button
                const discoverBtn = document.createElement('button');
                discoverBtn.id = 'discover-cities-btn';
                discoverBtn.className = 'run-button';
                discoverBtn.style.marginTop = '15px';
                discoverBtn.style.padding = '12px';
                discoverBtn.innerHTML = '<i class="fas fa-search-location"></i><span>Descobrir Cidades de ' + state + '</span>';

                discoverBtn.addEventListener('click', async () => {
                    await discoverCitiesForState(selectedCountry.country_code, state);
                });

                // Insert button before confirm button
                if (!document.getElementById('discover-cities-btn')) {
                    confirmCityBtn.parentElement.insertBefore(discoverBtn, confirmCityBtn);
                }

                return;
            }

            // Populate city dropdown
            allCities.forEach(city => {
                const option = document.createElement('option');
                option.value = city.id;
                option.textContent = `${city.name} - ${city.neighborhood_count} bairros`;
                option.dataset.cityData = JSON.stringify(city);
                citySelect.appendChild(option);
            });

            citySelect.disabled = false;
            confirmCityBtn.style.display = 'block';
            addLog(`✅ ${allCities.length} cidades carregadas para ${state}`, 'success');

            // Remove discover button if it exists
            const existingBtn = document.getElementById('discover-cities-btn');
            if (existingBtn) {
                existingBtn.remove();
            }

        } catch (error) {
            console.error('Error loading cities:', error);
            addLog('❌ Erro ao carregar cidades', 'error');
            citySelect.innerHTML = '<option value="">Erro ao carregar cidades</option>';
            citySelect.disabled = true;
        }
    }

    // ========================================================================
    // Setup City Selector
    // ========================================================================
    function setupCitySelector() {
        // Enable/disable confirm button when city changes
        citySelect.addEventListener('change', (e) => {
            const selectedOption = e.target.options[e.target.selectedIndex];
            if (selectedOption.value && selectedOption.dataset.cityData) {
                const cityData = JSON.parse(selectedOption.dataset.cityData);
                selectedCity = cityData;
                confirmCityBtn.disabled = false;
                // Show deselect button
                if (!citySelect.disabled) {
                    deselectCityBtn.style.display = 'inline-flex';
                }
            } else {
                selectedCity = null;
                confirmCityBtn.disabled = true;
                deselectCityBtn.style.display = 'none';
            }
        });

        // Deselect city button
        deselectCityBtn.addEventListener('click', () => {
            citySelect.value = '';
            selectedCity = null;
            confirmCityBtn.disabled = true;
            deselectCityBtn.style.display = 'none';
            selectedCityInfo.style.display = 'none';

            // Clear neighborhoods
            neighborhoodsContainer.innerHTML = '<div class="loading">Selecione uma cidade primeiro...</div>';
            selectedNeighborhoods.clear();
            resetApurationBtn.disabled = true;
            updateSummary();

            addLog('↩️ Cidade desselecionada', 'info');
        });

        // Confirm city selection button
        confirmCityBtn.addEventListener('click', async () => {
            if (!selectedCity) return;

            addLog(`🏙️  Cidade selecionada: ${selectedCity.name}`, 'info');

            // Show selected city info
            selectedCityName.textContent = `${selectedCity.name}, ${selectedCity.state} (${selectedCity.neighborhood_count} bairros)`;
            selectedCityInfo.style.display = 'block';

            // Disable city selector after confirmation
            citySelect.disabled = true;
            confirmCityBtn.disabled = true;
            deselectCityBtn.style.display = 'none'; // Hide deselect button after confirm

            // Enable reset button when city is selected
            resetApurationBtn.disabled = false;

            // Load neighborhoods
            await loadNeighborhoods(selectedCity.id);
        });
    }

    // ========================================================================
    // Discover Cities for State (Bulk Discovery)
    // ========================================================================
    async function discoverCitiesForState(countryCode, stateName) {
        const discoverBtn = document.getElementById('discover-cities-btn');
        if (!discoverBtn) return;

        try {
            // Floating log
            clearFloatingLog();
            showFloatingLog('Descobrindo Cidades');

            // Disable button and show loading
            discoverBtn.disabled = true;
            const originalHTML = discoverBtn.innerHTML;
            discoverBtn.innerHTML = '<div class="spinner"></div><span>Descobrindo cidades...</span>';

            addLog(`🔍 Iniciando descoberta de cidades para ${stateName}...`, 'info');
            addLog(`⏱️  Isso pode levar alguns minutos dependendo do tamanho do estado...`, 'info');

            const response = await fetch('/.netlify/functions/discover-cities-bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    countryCode: countryCode,
                    stateFilter: stateName,
                    populationMin: 1000,
                    batchSize: 100
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Failed to discover cities');
            }

            addLog(`✅ ${result.citiesAdded} cidades descobertas!`, 'success');
            addLog(`📊 Tempo: ${result.timeElapsed}`, 'info');

            // Reload cities for this state
            await loadCities(stateName);

            // Stop floating log operation
            stopFloatingLogOperation();
            setTimeout(() => {
                if (!floatingLogMinimized) {
                    closeFloatingLog();
                }
            }, 3000);

        } catch (error) {
            console.error('Error discovering cities:', error);
            addLog(`❌ Erro ao descobrir cidades: ${error.message}`, 'error');

            // Re-enable button
            if (discoverBtn) {
                discoverBtn.disabled = false;
                discoverBtn.innerHTML = '<i class="fas fa-search-location"></i><span>Tentar Novamente</span>';
            }
        }
    }

    // ========================================================================
    // Load Neighborhoods
    // ========================================================================
    async function loadNeighborhoods(cityId) {
        try {
            // Show loading spinner with clear message
            neighborhoodsContainer.innerHTML = `
                <div class="loading" style="display: flex; flex-direction: column; align-items: center; gap: 15px; padding: 40px;">
                    <div class="spinner" style="width: 40px; height: 40px; border-width: 4px;"></div>
                    <div style="font-size: 16px; font-weight: 600; color: #667eea;">Carregando bairros...</div>
                    <div style="font-size: 14px; color: #666;">Aguarde, estamos buscando os dados</div>
                </div>
            `;
            addLog(`📍 Carregando bairros da cidade ${cityId}...`, 'info');

            const response = await fetch(`/.netlify/functions/get-neighborhoods?city_id=${cityId}`);
            if (!response.ok) throw new Error('Failed to fetch neighborhoods');

            const neighborhoods = await response.json();
            allNeighborhoods = neighborhoods;
            selectedNeighborhoods.clear();

            if (neighborhoods.length === 0) {
                // Show warning message
                addLog(`⚠️  Nenhum bairro encontrado para ${selectedCity.name}`, 'info');
                addLog(`💡 Clique em "Descobrir Bairros" para buscar bairros automaticamente`, 'info');

                // Show empty state with discover button
                neighborhoodsContainer.innerHTML = `
                    <div class="loading" style="padding: 40px; text-align: center;">
                        <div style="font-size: 48px; margin-bottom: 15px;">📭</div>
                        <div style="font-size: 16px; font-weight: 600; color: #666; margin-bottom: 15px;">Nenhum bairro encontrado</div>
                        <div style="font-size: 14px; color: #999; margin-bottom: 20px;">Esta cidade não possui bairros cadastrados</div>
                        <button id="discover-neighborhoods-btn" class="run-button" style="max-width: 400px; margin: 0 auto; padding: 12px;">
                            <i class="fas fa-search-location"></i>
                            <span>Descobrir Bairros de ${selectedCity.name}</span>
                        </button>
                    </div>
                `;

                // Add event listener to discover button
                const discoverBtn = document.getElementById('discover-neighborhoods-btn');
                if (discoverBtn) {
                    discoverBtn.addEventListener('click', async () => {
                        await discoverNeighborhoodsForCity(selectedCity.id, selectedCity.name);
                    });
                }

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

        // Get selected categories for API call estimation
        const selectedCategories = getSelectedCategories();
        const keywordsPerCategory = 2; // Each category has 2 keywords
        const apiCallsPerNeighborhood = selectedCategories.length * keywordsPerCategory;
        const estimatedApiCalls = selectedCount * apiCallsPerNeighborhood;
        const estimatedCost = (estimatedApiCalls * 0.032).toFixed(2);

        summaryNeighborhoods.textContent = selectedCount;
        summaryTotalLimit.textContent = totalLimit;
        summaryCost.textContent = `$${estimatedCost}`;

        // Enable/disable run button
        runButton.disabled = selectedCount === 0;

        // Update API estimate in the category section
        updateApiEstimate();
    }

    // ========================================================================
    // Reset Apuration Counts
    // ========================================================================
    resetApurationBtn.addEventListener('click', async () => {
        if (!selectedCity) {
            showMessage('Selecione uma cidade primeiro', 'error');
            return;
        }

        // Enhanced confirmation with typed confirmation
        const confirmWord = 'RESETAR';
        const userInput = prompt(
            `⚠️⚠️⚠️ ATENÇÃO - AÇÃO DESTRUTIVA ⚠️⚠️⚠️\n\n` +
            `Esta ação irá RESETAR os contadores de apuração para TODOS os ${allNeighborhoods.length} bairros de ${selectedCity.name}.\n\n` +
            `CONSEQUÊNCIAS:\n` +
            `• Todos os bairros voltarão para "Primeira apuração"\n` +
            `• Limite de cada bairro será resetado para 666 lojas\n` +
            `• Histórico de apuração será perdido\n\n` +
            `Esta ação NÃO PODE SER DESFEITA!\n\n` +
            `Para confirmar, digite: ${confirmWord}`
        );

        if (userInput !== confirmWord) {
            if (userInput !== null) { // User didn't cancel, but typed wrong word
                showMessage('❌ Confirmação incorreta. Ação cancelada por segurança.', 'error');
            }
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
        // Floating log
        clearFloatingLog();
        showFloatingLog('Scoped Auto-Population');

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
                    // Get selected categories to send to backend
                    const storeCategories = getSelectedCategories();

                    const response = await fetch('/.netlify/functions/scoped-auto-populate', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            password: password,
                            neighborhood_ids: batch,
                            store_categories: storeCategories
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

                    // Check for timeout prevention
                    if (result.metadata && result.metadata.timeout_prevented) {
                        addLog('', 'info');
                        addLog(`⏱️  TEMPO LIMITE ATINGIDO (${result.metadata.time_budget_ms / 1000}s)`, 'error');
                        addLog(`   Bairros completados: ${result.metadata.neighborhoods_completed}/${result.metadata.neighborhoods_total}`, 'info');
                        addLog(`   💡 Dica: Reduza o número de bairros ou categorias para completar todos`, 'info');
                        addLog('', 'info');
                    }

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

            // Stop floating log operation and close
            stopFloatingLogOperation();
            setTimeout(() => {
                if (!floatingLogMinimized) {
                    closeFloatingLog();
                }
            }, 5000);

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

    // ========================================================================
    // ========================================================================
    // Floating Log Overlay Functions
    // ========================================================================

    let floatingLogActive = false;
    let floatingLogMinimized = false;
    let floatingLogCount = 0;

    window.showFloatingLog = function(title = 'Progresso') {
        const floatingLog = document.getElementById('floating-log');
        const floatingTitle = document.getElementById('floating-log-title');
        floatingTitle.textContent = title;
        floatingLog.classList.add('active');
        floatingLog.classList.add('active-operation');
        floatingLogActive = true;
        floatingLogMinimized = false;
        floatingLogCount = 0;
        updateFloatingLogBadge();
    };

    window.closeFloatingLog = function() {
        const floatingLog = document.getElementById('floating-log');
        floatingLog.classList.remove('active');
        floatingLog.classList.remove('active-operation');
        floatingLogActive = false;
        floatingLogMinimized = false;
    };

    window.minimizeFloatingLog = function() {
        const floatingLog = document.getElementById('floating-log');
        floatingLog.classList.toggle('minimized');
        floatingLogMinimized = !floatingLogMinimized;
        updateFloatingLogBadge();
    };

    window.toggleFloatingLog = function() {
        if (floatingLogMinimized) {
            minimizeFloatingLog();
        }
    };

    function addFloatingLog(message, type = 'info') {
        const content = document.getElementById('floating-log-content');
        const entry = document.createElement('div');
        entry.className = `floating-log-entry ${type}`;
        entry.textContent = message;
        content.appendChild(entry);
        content.scrollTop = content.scrollHeight;

        floatingLogCount++;
        updateFloatingLogBadge();

        if (!floatingLogActive) {
            showFloatingLog();
        }
    }

    function clearFloatingLog() {
        const content = document.getElementById('floating-log-content');
        content.innerHTML = '';
        floatingLogCount = 0;
        updateFloatingLogBadge();
    }

    function stopFloatingLogOperation() {
        const floatingLog = document.getElementById('floating-log');
        floatingLog.classList.remove('active-operation');
    }

    function updateFloatingLogBadge() {
        const badge = document.getElementById('floating-log-badge');
        if (floatingLogMinimized && floatingLogCount > 0) {
            badge.textContent = floatingLogCount;
            badge.style.display = 'inline-block';
        } else {
            badge.style.display = 'none';
        }
    }

    // Modify existing addLog to sync with floating log
    const originalAddLog = addLog;
    addLog = function(message, type = 'info') {
        originalAddLog(message, type);

        // Also add to floating log if active
        if (floatingLogActive) {
            addFloatingLog(message, type);
        }
    };

    // Discover Neighborhoods for City (NEW)
    // ========================================================================
    async function discoverNeighborhoodsForCity(cityId, cityName) {
        const discoverBtn = document.getElementById('discover-neighborhoods-btn');
        if (!discoverBtn) return;

        try {
            // Floating log
            clearFloatingLog();
            showFloatingLog('Descobrindo Bairros');

            // Disable button and show loading
            discoverBtn.disabled = true;
            const originalHTML = discoverBtn.innerHTML;
            discoverBtn.innerHTML = '<div class="spinner"></div><span>Descobrindo bairros...</span>';

            addLog(`🔍 Iniciando descoberta de bairros para ${cityName}...`, 'info');
            addLog(`⏱️  Isso pode levar até 30 segundos...`, 'info');

            const response = await fetch('/.netlify/functions/discover-neighborhoods', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cityId: cityId })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || result.error || 'Failed to discover neighborhoods');
            }

            addLog(`✅ ${result.count} bairros descobertos!`, 'success');
            addLog(`📊 Fonte: ${result.source || 'OpenStreetMap'}`, 'info');

            // Reload neighborhoods
            await loadNeighborhoods(cityId);

            // Stop floating log operation
            stopFloatingLogOperation();
            setTimeout(() => {
                if (!floatingLogMinimized) {
                    closeFloatingLog();
                }
            }, 3000);

        } catch (error) {
            console.error('Error discovering neighborhoods:', error);
            addLog(`❌ Erro ao descobrir bairros: ${error.message}`, 'error');

            // Re-enable button
            if (discoverBtn) {
                discoverBtn.disabled = false;
                discoverBtn.innerHTML = '<i class="fas fa-search-location"></i><span>Tentar Novamente</span>';
            }
        }
    }

    // ========================================================================
    // Tutorial Banner Functions
    // ========================================================================

    // Toggle tutorial visibility (called by help button)
    window.toggleTutorial = function() {
        const tutorialBanner = document.getElementById('tutorial-banner');
        if (tutorialBanner) {
            if (tutorialBanner.style.display === 'none' || tutorialBanner.style.display === '') {
                tutorialBanner.style.display = 'block';
                // Smooth scroll to tutorial
                tutorialBanner.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                tutorialBanner.style.display = 'none';
            }
        }
    };

    // Dismiss tutorial (called by skip or close buttons)
    window.dismissTutorial = function() {
        const tutorialBanner = document.getElementById('tutorial-banner');
        if (tutorialBanner) {
            tutorialBanner.style.display = 'none';
        }
    };
});
