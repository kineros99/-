document.addEventListener('DOMContentLoaded', () => {
    // --- INICIALIZAÇÃO DO MAPA ---
    const map = L.map('map').setView([-22.9068, -43.1729], 12); // Centro do RJ
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);
    const markersLayer = L.markerClusterGroup();
    map.addLayer(markersLayer);
    
    // Cache local para todas as lojas
    let allLojas = [];
    const userLocationMarker = L.icon({
        iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
        iconSize: [25, 41], iconAnchor: [12, 41], popupAnchor: [1, -34],
    });

    // --- FUNÇÕES DE DADOS E RENDERIZAÇÃO ---
    
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
        listDiv.innerHTML = '';
        markersLayer.clearLayers();

        if (lojas.length === 0) {
            listDiv.innerHTML = '<p style="color: white; text-align: center;">Nenhuma loja encontrada.</p>';
            return;
        }

        lojas.forEach(loja => {
            // Adiciona item na lista da sidebar
            const item = document.createElement('div');
            item.className = 'loja-item';
            item.innerHTML = `
                <div class="loja-nome">${loja.nome}</div>
                <div class="loja-endereco">${loja.endereco}</div>
                ${loja.telefone ? `<div class="loja-telefone">📞 ${loja.telefone}</div>` : ''}
            `;
            
            // Adiciona marcador no mapa (se tiver coordenadas)
            if (loja.latitude && loja.longitude) {
                const marker = L.marker([loja.latitude, loja.longitude]);
                const popupContent = `<b>${loja.nome}</b><br>${loja.endereco}${loja.telefone ? `<br>📞 ${loja.telefone}` : ''}`;
                marker.bindPopup(popupContent);
                
                item.addEventListener('click', () => {
                    map.setView([loja.latitude, loja.longitude], 16);
                    marker.openPopup();
                    if (window.innerWidth <= 768) {
                        toggleSidebar(true); // Esconde a sidebar em mobile
                    }
                });
                markersLayer.addLayer(marker);
            }
            listDiv.appendChild(item);
        });
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
    
    // Filtro de lojas
    document.getElementById('filter-btn').addEventListener('click', () => {
        const bairro = document.getElementById('bairro-filter').value;
        fetchLojas(bairro);
    });

    document.getElementById('reset-btn').addEventListener('click', () => {
        document.getElementById('bairro-filter').value = '';
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
            map.setView([latitude, longitude], 15);
            L.marker([latitude, longitude], { icon: userLocationMarker })
                .addTo(map)
                .bindPopup("📍 Você está aqui")
                .openPopup();
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

        try {
            const response = await fetch('/.netlify/functions/auth-register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            });
            const result = await response.json();

            if (!response.ok) throw new Error(result.message);

            formMessage.className = 'success';
            formMessage.textContent = 'Loja cadastrada com sucesso!';
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
            submitButton.disabled = false;
            submitButton.textContent = 'Cadastrar Loja';
        }
    });

    // --- CARGA INICIAL ---
    fetchLojas();
});