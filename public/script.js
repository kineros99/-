document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO DO MAPA ---
    const map = L.map('map').setView([-22.9068, -43.1729], 13); // Centro do RJ (zoom 13 para melhor visualização)

    // Using Google Maps tiles (Roadmap style)
    // Note: This is a free-to-use tile layer that doesn't require API key
    // For production, consider using official Google Maps JavaScript API
    L.tileLayer('https://mt1.google.com/vt/lyrs=r&x={x}&y={y}&z={z}', {
        attribution: '© Google Maps',
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
    }).addTo(map);

    // Force Leaflet to recalculate map size after DOM is fully rendered
    // This is needed because the sidebar is position:fixed which can affect initial layout calculations
    setTimeout(() => {
        map.invalidateSize();
        console.log('[Map] Map size recalculated after initialization');
    }, 100);

    // Enable clustering for better performance with many markers
    const markersLayer = L.markerClusterGroup({
        maxClusterRadius: 50, // Cluster markers within 50 pixels
        spiderfyOnMaxZoom: true, // Show all markers when fully zoomed in
        showCoverageOnHover: false, // Don't show cluster coverage area on hover
        zoomToBoundsOnClick: true // Zoom in when clicking a cluster
    });
    map.addLayer(markersLayer);
    
    // Cache local para todas as lojas
    let allLojas = [];
    let userLocation = null; // Store user's location
    let radiusCircle = null; // Store radius circle overlay
    const userLocationMarker = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
    });

    // Calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in km
    };

    // Function to show route to a loja
    const showRoute = (destLat, destLng, lojaName) => {
        if (!userLocation) {
            alert("Primeiro localize sua posição usando o botão 📍 Minha Localização!");
            return;
        }

        // Open Google Maps with directions
        const origin = `${userLocation.latitude},${userLocation.longitude}`;
        const destination = `${destLat},${destLng}`;
        const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${destination}&travelmode=driving`;

        window.open(url, '_blank');

        console.log(`[Route] Opening directions to ${lojaName}`);
    };

    // --- FUNÇÕES DE DADOS E RENDERIZAÇÃO ---

    // Popula o dropdown de bairros com todos os bairros únicos do banco de dados
    const populateBairrosDropdown = (lojas) => {
        const bairroSelect = document.getElementById('bairro-filter');

        // Extrai todos os bairros únicos (remove duplicados e valores vazios)
        const bairrosUnicos = [...new Set(
            lojas
                .map(loja => loja.bairro)
                .filter(bairro => bairro && bairro.trim() !== '')
        )].sort(); // Ordena alfabeticamente

        // Remove opções antigas (exceto "Todos os bairros")
        while (bairroSelect.options.length > 1) {
            bairroSelect.remove(1);
        }

        // Adiciona cada bairro único como opção
        bairrosUnicos.forEach(bairro => {
            const option = document.createElement('option');
            option.value = bairro;
            option.textContent = bairro;
            bairroSelect.appendChild(option);
        });

        console.log(`[Bairros] ${bairrosUnicos.length} bairros únicos carregados:`, bairrosUnicos);
    };

    // Busca lojas da nossa API (Netlify Function)
    const fetchLojas = async (bairro = '') => {
        const listDiv = document.getElementById('lojasList');
        listDiv.innerHTML = '<p style="color: white; text-align: center;">Carregando lojas...</p>';
        try {
            const endpoint = bairro
                ? `/.netlify/functions/get-lojas?bairro=${encodeURIComponent(bairro)}`
                : '/.netlify/functions/get-lojas';

            const response = await fetch(endpoint);
            if (!response.ok) throw new Error('Falha ao carregar dados.');

            const lojas = await response.json();
            if (bairro === '') { // Apenas atualiza o cache na carga inicial
                allLojas = lojas;
                populateBairrosDropdown(lojas); // Popula dropdown após carregar todas as lojas
            }
            renderLojas(lojas);

        } catch (error) {
            console.error('Erro ao buscar lojas:', error);
            listDiv.innerHTML = '<p style="color: #ffcccc; text-align: center;">Erro ao carregar lojas.</p>';
        }
    };

    // Renderiza a lista de lojas na sidebar e os marcadores no mapa
    const renderLojas = (lojas) => {
        const listDiv = document.getElementById('lojasList');
        const resultsCount = document.getElementById('resultsCount');
        listDiv.innerHTML = '';
        markersLayer.clearLayers();

        // Update results counter
        resultsCount.textContent = lojas.length;

        if (lojas.length === 0) {
            listDiv.innerHTML = '<p style="color: white; text-align: center;">Nenhuma loja encontrada.</p>';
            return;
        }

        console.log(`[Map] Rendering ${lojas.length} lojas on map`);

        lojas.forEach((loja, index) => {
            // Adiciona item na lista da sidebar
            const item = document.createElement('div');
            item.className = 'loja-item';

            // Adiciona marcador no mapa (se tiver coordenadas)
            if (loja.latitude && loja.longitude) {
                const lat = parseFloat(loja.latitude);
                const lng = parseFloat(loja.longitude);

                // Validate coordinates
                if (isNaN(lat) || isNaN(lng)) {
                    console.error(`[Map] Invalid coordinates for ${loja.nome}: lat=${loja.latitude}, lng=${loja.longitude}`);
                    listDiv.appendChild(item);
                    return;
                }

                console.log(`[Map] Adding marker ${index + 1}: ${loja.nome} at [${lat}, ${lng}]`);

                // Create custom icon with different colors based on store category
                const categoryColors = {
                    'paint': 'red',        // 🎨 Tintas
                    'lumber': 'orange',    // 🪵 Madeira
                    'plumbing': 'blue',    // 🔧 Hidráulica
                    'hardware': 'yellow',  // 🔨 Ferragens
                    'general': 'green',    // 🏗️ Geral
                    'unknown': 'grey'      // ❓ Indefinido
                };

                const categoryIcons = {
                    'paint': '🎨',
                    'lumber': '🪵',
                    'plumbing': '🔧',
                    'hardware': '🔨',
                    'general': '🏗️',
                    'unknown': '❓'
                };

                const categoryNames = {
                    'paint': 'Tintas',
                    'lumber': 'Madeira',
                    'plumbing': 'Hidráulica',
                    'hardware': 'Ferragens',
                    'general': 'Material de Construção',
                    'unknown': 'Não categorizado'
                };

                const storeCategory = loja.store_category || 'unknown';
                const iconColor = categoryColors[storeCategory];
                const customIcon = L.icon({
                    iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${iconColor}.png`,
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png`,
                    iconSize: [25, 41],
                    iconAnchor: [12, 41],
                    popupAnchor: [1, -34],
                    shadowSize: [41, 41]
                });

                const marker = L.marker([lat, lng], { icon: customIcon });

                const popupContent = `
                    <div style="min-width: 200px;">
                        <b>${loja.nome}</b><br>
                        ${categoryIcons[storeCategory]} <strong>${categoryNames[storeCategory]}</strong><br>
                        ${loja.endereco}<br>
                        ${loja.bairro ? `📍 ${loja.bairro}<br>` : ''}
                        ${loja.telefone ? `📞 ${loja.telefone}<br>` : ''}
                        <br><small>Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</small>
                    </div>
                `;
                marker.bindPopup(popupContent);

                // Determine source badge
                let sourceBadge, sourceTitle;
                if (loja.source === 'verified') {
                    sourceBadge = '🧵';
                    sourceTitle = 'Verificada por usuário (Google + Usuário)';
                } else if (loja.source === 'auto') {
                    sourceBadge = '🙃';
                    sourceTitle = 'Auto-populada (Google Places)';
                } else {
                    sourceBadge = '🙂';
                    sourceTitle = 'Adicionada por usuário';
                }

                // Create loja item content with action buttons
                item.innerHTML = `
                    <div class="loja-nome">
                        <span class="source-badge" title="${sourceTitle}">${sourceBadge}</span>
                        ${loja.nome}
                    </div>
                    <div class="loja-endereco">${loja.endereco}</div>
                    ${loja.telefone ? `<div class="loja-telefone">📞 ${loja.telefone}</div>` : ''}
                    <div class="loja-actions">
                        <button class="action-btn" data-loja-id="${index}" data-action="route">
                            <i class="fas fa-route"></i> Rota
                        </button>
                        <button class="action-btn" data-loja-id="${index}" data-action="view">
                            <i class="fas fa-map-marker-alt"></i> Ver no Mapa
                        </button>
                    </div>
                `;

                // Add event listeners for action buttons
                setTimeout(() => {
                    const routeBtn = item.querySelector('[data-action="route"]');
                    const viewBtn = item.querySelector('[data-action="view"]');

                    if (routeBtn) {
                        routeBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showRoute(lat, lng, loja.nome);
                        });
                    }

                    if (viewBtn) {
                        viewBtn.addEventListener('click', (e) => {
                            e.stopPropagation();
                            map.setView([lat, lng], 17);
                            marker.openPopup();
                            if (window.innerWidth <= 768) {
                                toggleSidebar(true);
                            }
                        });
                    }
                }, 0);

                markersLayer.addLayer(marker);
            } else {
                console.warn(`[Map] No coordinates for ${loja.nome}`);
            }
            listDiv.appendChild(item);
        });

        console.log(`[Map] Total markers added: ${markersLayer.getLayers().length}`);
    };

    // --- LÓGICA DA UI ---

    // Controla a visibilidade da sidebar e do overlay
    const toggleSidebar = (forceCollapse = false) => {
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('overlay');
        const shouldCollapse = forceCollapse || !sidebar.classList.contains('collapsed');
        
        sidebar.classList.toggle('collapsed', shouldCollapse);
        overlay.classList.toggle('active', !shouldCollapse);
        
        // Ajusta o tamanho do mapa para preencher o espaço
        setTimeout(() => map.invalidateSize(), 400);
    };

    document.getElementById('toggle-sidebar-btn').addEventListener('click', () => toggleSidebar());
    document.getElementById('overlay').addEventListener('click', () => toggleSidebar(true));

    // Radius slider update
    const radiusSlider = document.getElementById('radius-slider');
    const radiusValue = document.getElementById('radius-value');
    radiusSlider.addEventListener('input', (e) => {
        radiusValue.textContent = `${e.target.value} km`;
        if (userLocation && radiusCircle) {
            // Update circle radius
            radiusCircle.setRadius(parseFloat(e.target.value) * 1000); // Convert km to meters
            filterLojas(); // Re-filter with new radius
        }
    });

    // Função para filtrar lojas localmente por busca, bairro, categoria, fonte e raio
    const filterLojas = () => {
        const searchTerm = document.getElementById('searchInput').value.toLowerCase();
        const bairroFilter = document.getElementById('bairro-filter').value.toLowerCase();
        const categoryFilter = document.getElementById('category-filter').value;
        const sourceFilter = document.getElementById('source-filter').value;
        const radiusKm = parseFloat(radiusSlider.value);

        const filteredLojas = allLojas.filter(loja => {
            const matchSearch = !searchTerm ||
                loja.nome.toLowerCase().includes(searchTerm) ||
                loja.endereco.toLowerCase().includes(searchTerm) ||
                (loja.bairro && loja.bairro.toLowerCase().includes(searchTerm));

            const matchBairro = !bairroFilter ||
                (loja.bairro && loja.bairro.toLowerCase().includes(bairroFilter));

            const matchCategory = categoryFilter === 'all' ||
                (loja.store_category || 'unknown') === categoryFilter;

            const matchSource = sourceFilter === 'all' ||
                loja.source === sourceFilter;

            // Radius filter (only apply if user has set location)
            let matchRadius = true;
            if (userLocation && loja.latitude && loja.longitude) {
                const distance = calculateDistance(
                    userLocation.latitude,
                    userLocation.longitude,
                    parseFloat(loja.latitude),
                    parseFloat(loja.longitude)
                );
                matchRadius = distance <= radiusKm;
            }

            return matchSearch && matchBairro && matchCategory && matchSource && matchRadius;
        });

        renderLojas(filteredLojas);

        // Adjust map view to show filtered results
        if (filteredLojas.length > 0) {
            const coords = filteredLojas
                .filter(l => l.latitude && l.longitude)
                .map(l => [parseFloat(l.latitude), parseFloat(l.longitude)]);
            if (coords.length > 0) {
                map.fitBounds(coords, { padding: [50, 50] });
            }
        }
    };

    // Search input - real-time filtering
    document.getElementById('searchInput').addEventListener('input', filterLojas);

    // Filtro de lojas
    document.getElementById('filter-btn').addEventListener('click', () => {
        filterLojas();
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('bairro-filter').value = '';
        document.getElementById('searchInput').value = '';
        document.getElementById('category-filter').value = 'all';
        document.getElementById('source-filter').value = 'all';
        renderLojas(allLojas); // Renderiza a partir do cache
        map.setView([-22.9068, -43.1729], 12);
    });

    // Geolocalização do usuário
    document.getElementById('geolocate-btn').addEventListener('click', () => {
        if (!navigator.geolocation) {
            alert("Geolocalização não é suportada pelo seu navegador.");
            return;
        }
        navigator.geolocation.getCurrentPosition(position => {
            const { latitude, longitude } = position.coords;
            userLocation = { latitude, longitude }; // Store location

            // Remove old circle if exists
            if (radiusCircle) {
                map.removeLayer(radiusCircle);
            }

            // Draw radius circle
            const radiusKm = parseFloat(radiusSlider.value);
            radiusCircle = L.circle([latitude, longitude], {
                color: '#FF6F00',
                fillColor: '#FF6F00',
                fillOpacity: 0.1,
                radius: radiusKm * 1000 // Convert km to meters
            }).addTo(map);

            map.setView([latitude, longitude], 13);
            L.marker([latitude, longitude], { icon: userLocationMarker })
                .addTo(map)
                .bindPopup("📍 Você está aqui")
                .openPopup();

            console.log(`[Geolocation] User location stored: ${latitude}, ${longitude}`);
            console.log(`[Geolocation] Radius: ${radiusKm} km`);

            // Apply radius filter
            filterLojas();
        }, () => {
            alert("Não foi possível obter sua localização.");
        });
    });

    // --- LÓGICA DO MODAL DE CADASTRO ---
    const modal = document.getElementById('register-modal');
    const openModalBtn = document.getElementById('open-register-modal-btn');
    const closeModalBtn = document.querySelector('.close-button');
    const form = document.getElementById('register-form');
    const formMessage = document.getElementById('form-message');
    const submitButton = document.getElementById('submit-button');
    
    openModalBtn.onclick = () => { modal.style.display = 'block'; };
    closeModalBtn.onclick = () => { modal.style.display = 'none'; };
    window.onclick = (event) => {
        if (event.target === modal) modal.style.display = 'none';
    };

    // Variable to store pending coordinate validation
    let pendingValidation = null;
    let pendingGoogleData = null;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        submitButton.disabled = true;
        submitButton.textContent = 'Enviando...';
        formMessage.style.display = 'none';

        const formData = new FormData(form);
        const data = {
            username: formData.get('username'),
            store: {
                nome: formData.get('nome'),
                endereco: formData.get('endereco'),
                categoria: formData.get('categoria'),
                telefone: formData.get('telefone'),
                website: formData.get('website'),
            }
        };

        // If we have a pending validation and user made a choice
        if (pendingValidation && formData.get('coordinate_choice')) {
            data.confirmCoordinates = formData.get('coordinate_choice');
        }

        // If user chose to use Google data
        if (pendingGoogleData && formData.get('use_google_data')) {
            data.useGoogleData = formData.get('use_google_data') === 'true';
        }

        try {
            const response = await fetch('/.netlify/functions/auth-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();

            // Handle Google business found (200 status with googleBusinessFound flag)
            if (response.ok && result.googleBusinessFound) {
                pendingGoogleData = result;

                // Show Google business data with comparison
                formMessage.className = 'warning';
                formMessage.innerHTML = `
                    <strong>🎯 Encontramos um negócio cadastrado no Google!</strong><br>
                    <p>${result.message}</p>

                    <div style="margin-top: 15px; padding: 10px; background: #e7f3ff; border-radius: 5px;">
                        <p><strong>📊 Dados do Google:</strong></p>
                        <p><strong>Nome:</strong> ${result.googleData.name || 'N/A'}</p>
                        <p><strong>Telefone:</strong> ${result.googleData.phone || 'N/A'}</p>
                        <p><strong>Website:</strong> ${result.googleData.website || 'N/A'}</p>
                        <p><strong>Status:</strong> ${result.googleData.businessStatus === 'OPERATIONAL' ? '✅ Operacional' : result.googleData.businessStatus}</p>
                        <button type="button" class="coord-choice-btn" data-google-choice="true">Usar Dados do Google</button>
                    </div>

                    <div style="margin-top: 10px; padding: 10px; background: #fff3e0; border-radius: 5px;">
                        <p><strong>📝 Seus Dados:</strong></p>
                        <p><strong>Nome:</strong> ${result.userProvidedData.name}</p>
                        <p><strong>Telefone:</strong> ${result.userProvidedData.phone || 'N/A'}</p>
                        <p><strong>Website:</strong> ${result.userProvidedData.website || 'N/A'}</p>
                        <button type="button" class="coord-choice-btn" data-google-choice="false">Usar Meus Dados</button>
                    </div>
                `;
                formMessage.style.display = 'block';

                // Add event listeners to choice buttons
                document.querySelectorAll('[data-google-choice]').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const useGoogle = btn.getAttribute('data-google-choice') === 'true';

                        // If using Google data, pre-fill form fields
                        if (useGoogle) {
                            document.getElementById('nome').value = result.googleData.name || result.userProvidedData.name;
                            document.getElementById('telefone').value = result.googleData.phone || result.userProvidedData.phone || '';
                            document.getElementById('website').value = result.googleData.website || result.userProvidedData.website || '';
                        }

                        // Add hidden input with choice
                        let choiceInput = document.getElementById('use_google_data');
                        if (!choiceInput) {
                            choiceInput = document.createElement('input');
                            choiceInput.type = 'hidden';
                            choiceInput.id = 'use_google_data';
                            choiceInput.name = 'use_google_data';
                            form.appendChild(choiceInput);
                        }
                        choiceInput.value = useGoogle.toString();

                        // Resubmit form
                        form.dispatchEvent(new Event('submit'));
                    });
                });

                submitButton.disabled = false;
                submitButton.textContent = 'Cadastrar Loja';
                return;
            }

            // Handle coordinate validation required (409 status)
            if (response.status === 409 && result.error === 'Coordinate validation required') {
                pendingValidation = result.validation;

                // Show validation message with options
                formMessage.className = 'warning';
                formMessage.innerHTML = `
                    <strong>Validação de Coordenadas Necessária</strong><br>
                    <p>${result.message}</p>
                    <p><strong>Distância:</strong> ${result.validation.distanceKm} km</p>
                    <div style="margin-top: 10px;">
                        <p><strong>Opção 1 (Recomendado):</strong> Usar coordenadas geocodificadas automaticamente</p>
                        <p>Lat: ${result.validation.geocoded.latitude}, Lng: ${result.validation.geocoded.longitude}</p>
                        <p>Confiança: ${result.validation.geocoded.confidence}/10</p>
                        <button type="button" class="coord-choice-btn" data-choice="use_geocoded">Usar Geocodificadas</button>
                    </div>
                    <div style="margin-top: 10px;">
                        <p><strong>Opção 2:</strong> Manter suas coordenadas fornecidas</p>
                        <p>Lat: ${result.validation.userProvided.latitude}, Lng: ${result.validation.userProvided.longitude}</p>
                        <button type="button" class="coord-choice-btn" data-choice="use_provided">Manter Minhas</button>
                    </div>
                `;
                formMessage.style.display = 'block';

                // Add event listeners to choice buttons
                document.querySelectorAll('.coord-choice-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const choice = btn.getAttribute('data-choice');

                        // Add hidden input with choice
                        let choiceInput = document.getElementById('coordinate_choice');
                        if (!choiceInput) {
                            choiceInput = document.createElement('input');
                            choiceInput.type = 'hidden';
                            choiceInput.id = 'coordinate_choice';
                            choiceInput.name = 'coordinate_choice';
                            form.appendChild(choiceInput);
                        }
                        choiceInput.value = choice;

                        // Resubmit form
                        form.dispatchEvent(new Event('submit'));
                    });
                });

                submitButton.disabled = false;
                submitButton.textContent = 'Cadastrar Loja';
                return;
            }

            if (!response.ok) throw new Error(result.message || 'Erro ao cadastrar loja');

            // Success!
            pendingValidation = null;
            pendingGoogleData = null;
            const coordChoice = document.getElementById('coordinate_choice');
            if (coordChoice) coordChoice.remove();
            const googleChoice = document.getElementById('use_google_data');
            if (googleChoice) googleChoice.remove();

            const dataSourceText = result.dataSource === 'google_places'
                ? '📊 Dados do Google Places'
                : '📝 Dados fornecidos pelo usuário';

            formMessage.className = 'success';
            formMessage.innerHTML = `
                <strong>✅ Loja cadastrada com sucesso!</strong><br>
                <p><strong>Fonte dos dados:</strong> ${dataSourceText}</p>
                ${result.geocoding ? `<p><strong>Coordenadas:</strong> ${result.geocoding.source === 'geocoded' ? 'Geocodificadas automaticamente pelo Google Maps' : 'Fornecidas pelo usuário'}</p>` : ''}
            `;
            formMessage.style.display = 'block';

            // Recarrega todas as lojas para incluir a nova
            setTimeout(() => {
                modal.style.display = 'none';
                form.reset();
                fetchLojas();
            }, 2000);

        } catch (error) {
            formMessage.className = 'error';
            formMessage.textContent = `Erro: ${error.message}`;
            formMessage.style.display = 'block';
        } finally {
            if (!pendingValidation) {
                submitButton.disabled = false;
                submitButton.textContent = 'Cadastrar Loja';
            }
        }
    });

    // --- CARGA INICIAL ---
    fetchLojas();
});