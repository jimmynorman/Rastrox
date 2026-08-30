// search-mode.js — Modo búsqueda, geolocalización, zonas revisadas

const SearchMode = {
    // Inicializar modo búsqueda
    init() {
        // Escuchar evento de ubicación actual
        document.addEventListener('rastro:currentLocation', (e) => {
            this.handleCurrentLocation(e.detail);
        });
    },

    handleCurrentLocation(latlng) {
        // Mostrar ubicación en el mapa (ya lo hace MapManager)
        // Aquí podríamos sugerir rutas o mostrar distancia a zonas prioritarias
    },

    // Marcar zona como revisada
    markZoneReviewed(caseData, lat, lng, outcome, notes = '') {
        if (!caseData.searchZones) caseData.searchZones = [];
        const zone = {
            id: Database.generateId(),
            lat,
            lng,
            reviewed: true,
            outcome: outcome || 'reviewed',
            notes,
            timestamp: new Date().toISOString()
        };
        caseData.searchZones.push(zone);
        Database.updateCase(caseData.id, { searchZones: caseData.searchZones });
        // Agregar a la cronología
        TimelineManager.addEvent(caseData, {
            datetime: new Date().toISOString(),
            type: 'search',
            description: `Zona revisada: ${outcome}`,
            lat,
            lng
        });
        return zone;
    },

    // Obtener zonas pendientes (no revisadas)
    getPendingZones(caseData) {
        return (caseData.searchZones || []).filter(z => !z.reviewed);
    },

    // Renderizar panel de modo búsqueda
    renderSearchPanel(caseData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const pending = this.getPendingZones(caseData);
        const lastSighting = ProbabilityEngine.getLastSighting(caseData);
        const confidence = ProbabilityEngine.calculateConfidence(caseData);
        const conflicts = ProbabilityEngine.detectConflicts(caseData);

        let html = '<div class="card"><h3>🔎 Modo Búsqueda</h3>';

        // Botón para obtener ubicación
        html += `<button class="btn" onclick="MapManager.locateUser()">📍 Mi ubicación actual</button>`;

        // Última evidencia
        if (lastSighting) {
            html += `<p><strong>Última evidencia:</strong> ${lastSighting.description || 'Avistamiento'} a las ${new Date(lastSighting.datetime).toLocaleTimeString()}</p>`;
        }

        // Nivel de confianza
        html += `<p>Nivel de confianza: <span class="score-badge confidence-${confidence.level}">${confidence.level.toUpperCase()} (${confidence.percentage}%)</span></p>`;

        // Conflictos
        if (conflicts.length > 0) {
            html += '<div class="card" style="border-left: 4px solid #e74c3c; padding: 10px;">';
            html += '<strong>⚠️ POSIBLE CONFLICTO DE EVIDENCIA</strong><br>';
            conflicts.forEach(c => html += `<p>${c.reason}</p>`);
            html += '</div>';
        }

        // Zonas pendientes
        html += '<h4>Zonas pendientes de revisión</h4>';
        if (pending.length === 0) {
            html += '<p>No hay zonas pendientes registradas.</p>';
        } else {
            html += '<ul>';
            pending.forEach(z => {
                html += `<li>Zona en (${z.lat.toFixed(5)}, ${z.lng.toFixed(5)}) — <button class="btn btn-sm btn-success" onclick="SearchMode.markZoneReviewed(AppState.currentCase, ${z.lat}, ${z.lng}, 'reviewed', '')">Marcar revisada</button></li>`;
            });
            html += '</ul>';
        }

        // Botones para marcar resultado rápido
        html += '<h4>Registrar resultado en mi posición</h4>';
        html += `<button class="btn btn-sm" onclick="SearchMode.registerOutcome('no_evidence')">Sin evidencia</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('clue_found')">Indicio encontrado</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('sighting')">Avistamiento</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('found')">¡Encontrado!</button>`;

        html += '</div>';
        container.innerHTML = html;
    },

    // Registrar resultado en la ubicación actual (obtenida del mapa)
    registerOutcome(outcome) {
        const mapCenter = MapManager.getCenter();
        const lat = mapCenter.lat;
        const lng = mapCenter.lng;
        const caseData = AppState.currentCase;
        if (!caseData) {
            alert('No hay caso activo');
            return;
        }
        const notes = prompt('Notas adicionales (opcional):', '');
        this.markZoneReviewed(caseData, lat, lng, outcome, notes || '');
        UI.renderCurrentTab();
        MapManager.drawSearchZones(caseData);
        alert('Resultado registrado.');
    }
};

window.SearchMode = SearchMode;