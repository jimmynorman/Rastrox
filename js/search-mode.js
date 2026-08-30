// search-mode.js — Modo búsqueda, registro de cobertura, geolocalización

const SearchMode = {
    init() {
        document.addEventListener('rastro:currentLocation', (e) => {
            this.handleCurrentLocation(e.detail);
        });
    },

    handleCurrentLocation(latlng) {
        // Mostrar ubicación en el mapa (ya lo hace MapManager)
        // Aquí podríamos sugerir rutas o mostrar distancia a zonas prioritarias
    },

    // Marcar zona como revisada en lat/lng específico
    markZoneReviewedAt(lat, lng) {
        const caseData = AppState.currentCase;
        if (!caseData) {
            alert('No hay caso activo');
            return;
        }
        const radius = prompt('Radio de la zona revisada (metros):', '100');
        if (!radius) return;
        const radiusMeters = parseFloat(radius);
        if (isNaN(radiusMeters) || radiusMeters <= 0) return;

        const notes = prompt('Notas (opcional):', '');
        this.addSearchCoverage(caseData, 'circle', { lat, lng }, radiusMeters, null, notes || '');
        alert('Zona revisada registrada.');
        MapManager.drawSearchCoverage(caseData);
        UI.renderCurrentTab();
    },

    // Agregar cobertura de búsqueda (círculo o polígono)
    addSearchCoverage(caseData, type, centerOrPoints, radiusMeters, points, notes) {
        if (!caseData.searchCoverage) caseData.searchCoverage = [];
        const coverage = {
            id: Database.generateId(),
            type: type, // 'circle' o 'polygon'
            center: centerOrPoints, // {lat, lng} para círculo
            radiusMeters: radiusMeters,
            points: points, // array de {lat, lng} para polígono
            notes: notes || '',
            timestamp: new Date().toISOString()
        };
        caseData.searchCoverage.push(coverage);
        Database.updateCase(caseData.id, { searchCoverage: caseData.searchCoverage });
        // Agregar a la cronología
        TimelineManager.addEvent(caseData, {
            datetime: new Date().toISOString(),
            type: 'search',
            description: `Zona revisada: ${notes || 'sin notas'}`,
            lat: centerOrPoints ? centerOrPoints.lat : (points && points[0] ? points[0].lat : null),
            lng: centerOrPoints ? centerOrPoints.lng : (points && points[0] ? points[0].lng : null)
        });
        return coverage;
    },

    // Obtener zonas pendientes (sin revisar) - para compatibilidad
    getPendingZones(caseData) {
        return (caseData.searchZones || []).filter(z => !z.reviewed);
    },

    // Renderizar panel de modo búsqueda
    renderSearchPanel(caseData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const lastSighting = ProbabilityEngine.getLastConfidentSighting(caseData);
        const confidence = ProbabilityEngine.calculateConfidence(caseData);
        const conflicts = ProbabilityEngine.detectConflicts(caseData);

        let html = '<div class="card"><h3>🔎 Modo Búsqueda</h3>';
        html += `<button class="btn" onclick="MapManager.locateUser()">📍 Mi ubicación actual</button>`;
        html += `<button class="btn btn-success" onclick="SearchMode.startQuickCoverage()">🔎 Registrar zona revisada (en mi ubicación)</button>`;

        if (lastSighting) {
            html += `<p><strong>Última evidencia confiable:</strong> ${new Date(lastSighting.datetime).toLocaleString()}</p>`;
        }

        html += `<p>Nivel de confianza: <span class="score-badge confidence-${confidence.level}">${confidence.level.toUpperCase()} (${confidence.percentage}%)</span></p>`;
        if (confidence.reasons && confidence.reasons.length > 0) {
            html += '<p><strong>Razones:</strong> ' + confidence.reasons.join(', ') + '</p>';
        }

        if (conflicts.length > 0) {
            html += '<div class="card" style="border-left: 4px solid #e74c3c; padding: 10px;">';
            html += '<strong>⚠️ POSIBLE CONFLICTO DE EVIDENCIA</strong><br>';
            conflicts.forEach(c => html += `<p>${c.reason}</p>`);
            html += '</div>';
        }

        html += '<h4>Registrar resultado rápido</h4>';
        html += `<button class="btn btn-sm" onclick="SearchMode.registerOutcome('no_evidence')">Sin evidencia</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('clue_found')">Indicio encontrado</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('sighting')">Avistamiento</button>
                 <button class="btn btn-sm" onclick="SearchMode.registerOutcome('found')">¡Encontrado!</button>`;

        html += '</div>';
        container.innerHTML = html;
    },

    // Iniciar registro rápido de cobertura desde la ubicación actual
    startQuickCoverage() {
        if (!navigator.geolocation) {
            alert('Geolocalización no soportada');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const radius = prompt('Radio de la zona revisada (metros):', '100');
                if (!radius) return;
                const radiusMeters = parseFloat(radius);
                if (isNaN(radiusMeters) || radiusMeters <= 0) return;
                const caseData = AppState.currentCase;
                if (!caseData) return;
                this.addSearchCoverage(caseData, 'circle', 
                    { lat: pos.coords.latitude, lng: pos.coords.longitude }, 
                    radiusMeters, null, 'Revisada desde mi ubicación');
                MapManager.drawSearchCoverage(caseData);
                UI.renderCurrentTab();
            },
            (err) => {
                alert('No se pudo obtener tu ubicación: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    // Registrar resultado en la ubicación actual del mapa (mantener compatibilidad)
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
        this.addSearchCoverage(caseData, 'circle', { lat, lng }, 50, null, notes || outcome);
        MapManager.drawSearchCoverage(caseData);
        UI.renderCurrentTab();
        alert('Resultado registrado.');
    }
};

window.SearchMode = SearchMode;