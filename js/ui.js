// ui.js — Renderizado de interfaz, formularios descriptivos sin coordenadas manuales, ayuda contextual

const UI = {
    currentTab: 'dashboard',

    init() {
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('hidden-mobile');
        });

        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        document.addEventListener('rastro:mapClick', (e) => {
            this.handleMapClickForForm(e.detail);
        });
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        this.renderCurrentTab();
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.add('hidden-mobile');
        }
    },

    renderCurrentTab() {
        const container = document.getElementById('tab-content');
        const caseData = AppState.currentCase;
        if (!caseData && this.currentTab !== 'case' && this.currentTab !== 'config') {
            container.innerHTML = '<div class="card"><h3>No hay caso activo</h3><p>Selecciona un caso en "Gestión de caso" o crea uno nuevo.</p></div>';
            return;
        }

        switch (this.currentTab) {
            case 'dashboard': this.renderDashboard(caseData, container); break;
            case 'animal': this.renderAnimalForm(caseData, container); break;
            case 'timeline': this.renderTimelineTab(caseData, container); break;
            case 'sightings': this.renderSightings(caseData, container); break;
            case 'zones': this.renderSafeZones(caseData, container); break;
            case 'routes': this.renderRoutes(caseData, container); break;
            case 'poi': this.renderPOIs(caseData, container); break;
            case 'evidence': this.renderEvidence(caseData, container); break;
            case 'search': this.renderSearchTab(caseData, container); break;
            case 'config': this.renderConfig(container); break;
            case 'case': this.renderCaseManagement(container); break;
            default: container.innerHTML = '<p>Selecciona una pestaña</p>';
        }
    },

    // ========== DASHBOARD ==========
    renderDashboard(caseData, container) {
        if (!caseData) return;
        const lastSighting = ProbabilityEngine.getLastConfidentSighting(caseData);
        const timeElapsed = ProbabilityEngine.getTimeElapsedHours(caseData);
        const confidence = ProbabilityEngine.calculateConfidence(caseData);
        const conflicts = ProbabilityEngine.detectConflicts(caseData);
        const direction = ProbabilityEngine.calculateDirectionVector(caseData);
        const home = caseData.locations?.home;
        const distToHome = home && lastSighting ? Calculations.distance(lastSighting.lat, lastSighting.lng, home.lat, home.lng) : null;

        let html = '<div class="card"><h3>📊 Dashboard</h3>';
        html += `<p><strong>🐕 Animal:</strong> ${caseData.animal?.name || 'Sin nombre'}</p>`;
        html += `<p><strong>⏱ Tiempo transcurrido:</strong> ${timeElapsed.toFixed(1)} horas</p>`;
        if (lastSighting) {
            html += `<p><strong>📍 Última ubicación confiable:</strong> (${lastSighting.lat.toFixed(5)}, ${lastSighting.lng.toFixed(5)})</p>`;
            html += `<p><strong>👀 Último avistamiento:</strong> ${new Date(lastSighting.datetime).toLocaleString()}</p>`;
        }
        if (distToHome !== null) {
            html += `<p><strong>🏠 Distancia al hogar:</strong> ${distToHome.toFixed(2)} km</p>`;
        }
        html += `<p><strong>📊 Nivel de confianza:</strong> <span class="score-badge confidence-${confidence.level}">${confidence.level.toUpperCase()} (${confidence.percentage}%)</span></p>`;
        if (confidence.reasons && confidence.reasons.length > 0) {
            html += `<p><small>${confidence.reasons.join(', ')}</small></p>`;
        }
        if (direction) {
            html += `<p><strong>🧭 Dirección probable:</strong> ${direction.bearing.toFixed(0)}° (velocidad estimada ${direction.speed.toFixed(1)} km/h)</p>`;
        } else {
            html += `<p><strong>🧭 Dirección probable:</strong> Datos insuficientes</p>`;
        }
        if (conflicts.length > 0) {
            html += '<div class="card" style="border-left: 4px solid #e74c3c; padding: 10px;">';
            html += '<strong>⚠️ POSIBLE CONFLICTO DE EVIDENCIA</strong><br>';
            conflicts.forEach(c => html += `<p>${c.reason}</p>`);
            html += '</div>';
        }
        html += '</div>';

        html += `<button class="btn" onclick="UI.recalculateZones()">🔄 Recalcular zonas de búsqueda</button>`;

        container.innerHTML = html;
    },

    recalculateZones() {
        const caseData = AppState.currentCase;
        if (!caseData) return;
        const scores = ProbabilityEngine.calculateGridScores(caseData);
        MapManager.showPriorityZones(scores);
        const corridor = ProbabilityEngine.calculateReturnCorridor(caseData);
        if (corridor) {
            MapManager.drawReturnCorridor(corridor.points, corridor.bufferKm);
        }
    },

    // ========== FICHA DEL ANIMAL (con descripciones) ==========
    renderAnimalForm(caseData, container) {
        if (!caseData) return;
        const a = caseData.animal || {};
        const b = a.behavior || {};
        let html = '<div class="card"><h3>🐕 Ficha del animal</h3>';
        html += `<form id="animal-form" onsubmit="UI.saveAnimal(event)">`;
        html += `<div class="form-group"><label>Nombre</label><input type="text" name="name" value="${a.name || ''}" required></div>`;
        html += `<div class="form-group"><label>Foto (URL o base64)</label><textarea name="photo" rows="2">${a.photo || ''}</textarea></div>`;
        html += `<div class="form-group"><label>Especie</label><input type="text" name="species" value="${a.species || 'Perro'}"></div>`;
        html += `<div class="form-group"><label>Raza</label><input type="text" name="breed" value="${a.breed || ''}"></div>`;
        html += `<div class="form-group"><label>Edad aproximada</label><input type="text" name="age" value="${a.age || ''}"></div>`;
        html += `<div class="form-group"><label>Sexo</label><select name="sex"><option>Macho</option><option>Hembra</option></select></div>`;
        html += `<div class="form-group"><label>Tamaño</label><input type="text" name="size" value="${a.size || ''}"></div>`;
        html += `<div class="form-group"><label>Peso aproximado</label><input type="text" name="weight" value="${a.weight || ''}"></div>`;
        html += `<div class="form-group"><label>Color</label><input type="text" name="color" value="${a.color || ''}"></div>`;
        html += `<div class="form-group"><label>Características distintivas</label><textarea name="distinctive">${a.distinctive || ''}</textarea></div>`;

        html += '<h4>Comportamiento</h4>';
        const behaviorDescriptions = {
            sociability: '¿Cómo suele reaccionar ante personas desconocidas?',
            fearPeople: '¿Muestra miedo o evita a las personas?',
            fearTraffic: '¿Le asusta el tráfico?',
            fearVehicles: '¿Le asustan los vehículos en movimiento?',
            followPeople: '¿Tiende a seguir a personas?',
            followDogs: '¿Tiende a seguir a otros perros?',
            territorial: '¿Es territorial con su espacio?',
            hideTendency: '¿Tiende a esconderse en lugares poco visibles?',
            foodMotivated: '¿Se siente atraído por la comida?',
            waterMotivated: '¿Busca agua con frecuencia?',
            returnHome: '¿Suele intentar regresar a casa?',
            walkingExperience: '¿Tiene experiencia caminando solo por la zona?',
            neighborhoodKnowledge: '¿Conoce bien el vecindario?',
            activityLevel: '¿Qué tan activo es?'
        };
        const behaviorFields = Object.keys(behaviorDescriptions);
        behaviorFields.forEach(key => {
            const label = behaviorDescriptions[key];
            const val = b[key] !== undefined ? b[key] : 0.5;
            html += `<div class="form-group"><label>${label}</label>`;
            html += `<input type="range" min="0" max="1" step="0.1" name="behavior_${key}" value="${val}" oninput="this.nextElementSibling.textContent = this.value"><span>${val}</span>`;
            html += `<div class="help-text">¿Por qué importa? Afecta el modelo de probabilidad: un perro sociable podría acercarse a personas, uno miedoso buscaría refugios.</div>`;
            html += `</div>`;
        });

        html += '<button type="submit" class="btn">Guardar ficha</button>';
        html += '</form></div>';
        container.innerHTML = html;
    },

    saveAnimal(event) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const animal = {
            name: form.name.value,
            photo: form.photo.value,
            species: form.species.value,
            breed: form.breed.value,
            age: form.age.value,
            sex: form.sex.value,
            size: form.size.value,
            weight: form.weight.value,
            color: form.color.value,
            distinctive: form.distinctive.value,
            behavior: {}
        };
        const behaviorFields = ['sociability', 'fearPeople', 'fearTraffic', 'fearVehicles', 'followPeople', 'followDogs', 'territorial', 'hideTendency', 'foodMotivated', 'waterMotivated', 'returnHome', 'walkingExperience', 'neighborhoodKnowledge', 'activityLevel'];
        behaviorFields.forEach(key => {
            animal.behavior[key] = parseFloat(form[`behavior_${key}`].value);
        });
        Database.updateCase(caseData.id, { animal });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== CRONOLOGÍA ==========
    renderTimelineTab(caseData, container) {
        container.innerHTML = '<div id="timeline-container"></div>';
        TimelineManager.renderTimeline(caseData, 'timeline-container');
    },

    // ========== AVISTAMIENTOS ==========
    renderSightings(caseData, container) {
        let html = '<div class="card"><h3>👀 Avistamientos</h3>';
        html += '<button class="btn" onclick="UI.showSightingForm(null, null)">➕ Agregar avistamiento (elegir en mapa)</button>';
        html += '<table><tr><th>Fecha/Hora</th><th>Ubicación</th><th>Certeza</th><th>Precisión</th><th>Descripción</th><th>Acciones</th></tr>';
        (caseData.sightings || []).forEach(s => {
            const certaintyClass = { confirmed: 'priority-very-high', very_likely: 'priority-high', possible: 'priority-medium', doubtful: 'priority-very-low' }[s.certainty] || '';
            html += `<tr>
                <td>${new Date(s.datetime).toLocaleString()}</td>
                <td>(${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})</td>
                <td><span class="score-badge ${certaintyClass}">${s.certainty}</span></td>
                <td>${s.precision || 'Exacta'}</td>
                <td>${s.description || ''}</td>
                <td><button class="btn btn-sm btn-danger" onclick="UI.deleteSighting('${s.id}')">Eliminar</button></td>
            </tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showSightingForm(lat, lng) {
        // Si no se proporcionan lat/lng, pedir al usuario que haga clic en el mapa
        if (lat === null || lat === undefined || lng === null || lng === undefined) {
            alert('Haz clic en el mapa para seleccionar la ubicación del avistamiento.');
            this.pendingAction = { type: 'sighting' };
            return;
        }
        const html = `
            <h3>Nuevo avistamiento</h3>
            <p><strong>📍 Ubicación seleccionada:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)} <button class="btn btn-sm" onclick="MapManager.setView(${lat}, ${lng}, 16)">Ver</button></p>
            <form onsubmit="UI.addSighting(event, ${lat}, ${lng})">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Reportado por</label><input type="text" name="reporter"></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Dirección observada</label><input type="text" name="direction" placeholder="Norte, Sur, etc."></div>
                <div class="form-group"><label>Velocidad estimada (km/h)</label><input type="number" name="speed" value="0"></div>
                <div class="form-group"><label>Nivel de certeza</label>
                    <select name="certainty">
                        <option value="confirmed">🔴 Confirmado</option>
                        <option value="very_likely">🟠 Muy probable</option>
                        <option value="possible">🟡 Posible</option>
                        <option value="doubtful">⚪ Dudoso</option>
                    </select>
                </div>
                <div class="form-group"><label>Precisión geográfica</label>
                    <select name="precision">
                        <option value="Exacta">Exacta</option>
                        <option value="±50m">±50 m</option>
                        <option value="±200m">±200 m</option>
                        <option value="±500m">±500 m</option>
                        <option value="±1km">±1 km</option>
                    </select>
                    <div class="help-text">Selecciona la incertidumbre estimada del testigo.</div>
                </div>
                <div class="form-group"><label>Fotografía (URL o base64)</label><textarea name="photo"></textarea></div>
                <div class="form-group"><label>Notas</label><textarea name="notes"></textarea></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    addSighting(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const precision = form.precision.value;
        const uncertaintyMap = { 'Exacta': 0, '±50m': 50, '±200m': 200, '±500m': 500, '±1km': 1000 };
        const sighting = {
            id: Database.generateId(),
            datetime: form.datetime.value,
            lat: lat,
            lng: lng,
            reporter: form.reporter.value,
            description: form.description.value,
            estimatedDistance: 0,
            direction: form.direction.value,
            speed: parseFloat(form.speed.value) || 0,
            certainty: form.certainty.value,
            precision: precision,
            uncertaintyRadius: uncertaintyMap[precision] || 0,
            photo: form.photo.value,
            notes: form.notes.value
        };
        caseData.sightings = caseData.sightings || [];
        caseData.sightings.push(sighting);
        Database.updateCase(caseData.id, { sightings: caseData.sightings });
        TimelineManager.addEvent(caseData, {
            datetime: sighting.datetime,
            type: 'sighting',
            description: sighting.description || 'Avistamiento',
            lat: sighting.lat,
            lng: sighting.lng
        });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    deleteSighting(sightingId) {
        if (!confirm('¿Eliminar este avistamiento?')) return;
        const caseData = AppState.currentCase;
        caseData.sightings = caseData.sightings.filter(s => s.id !== sightingId);
        Database.updateCase(caseData.id, { sightings: caseData.sightings });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== ZONAS SEGURAS ==========
    renderSafeZones(caseData, container) {
        let html = '<div class="card"><h3>🛡️ Zonas seguras conocidas</h3>';
        html += '<button class="btn" onclick="UI.startDrawSafeZone()">➕ Dibujar zona segura</button>';
        html += '<table><tr><th>Nombre</th><th>Tipo</th><th>Familiaridad</th><th>Frecuencia</th><th>Acciones</th></tr>';
        (caseData.safeZones || []).forEach(z => {
            html += `<tr><td>${z.name}</td><td>${z.type === 'circle' ? 'Círculo' : 'Polígono'}</td><td>${z.familiarity || ''}</td><td>${z.frequency || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deleteSafeZone('${z.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    startDrawSafeZone() {
        alert('Usa el menú contextual (mantén presionado en el mapa) y selecciona "Zona segura (círculo)" o "Zona segura (polígono)".');
    },

    showSafeZoneForm(centerLat, centerLng, type, points, radiusMeters) {
        const caseData = AppState.currentCase;
        if (!caseData) return;

        let locationDesc = '';
        if (type === 'circle' && centerLat !== null) {
            locationDesc = `Centro: ${centerLat.toFixed(5)}, ${centerLng.toFixed(5)}, Radio: ${radiusMeters} m`;
        } else if (type === 'polygon' && points) {
            locationDesc = `Polígono con ${points.length} vértices`;
        }

        const html = `
            <h3>🛡️ Nueva zona segura conocida</h3>
            <p><strong>📍 Área:</strong> ${locationDesc}</p>
            <form onsubmit="UI.saveSafeZone(event, ${type === 'circle' ? `{lat: ${centerLat}, lng: ${centerLng}}` : 'null'}, ${type === 'polygon' ? JSON.stringify(points) : 'null'}, ${radiusMeters || 'null'}, '${type}')">
                <div class="form-group"><label>Nombre de la zona</label><input type="text" name="name" required placeholder="Ej: Barrio donde creció"></div>
                <div class="form-group"><label>Tipo</label>
                    <select name="zoneType">
                        <option>Hogar</option><option>Barrio conocido</option><option>Parque habitual</option>
                        <option>Zona de paseo</option><option>Casa conocida</option><option>Lugar de comida</option>
                        <option>Lugar de descanso</option><option>Territorio habitual</option><option>Otra</option>
                    </select>
                </div>
                <div class="form-group"><label>Nivel de familiaridad</label>
                    <select name="familiarity">
                        <option>Muy bajo</option><option>Bajo</option><option>Medio</option><option>Alto</option><option>Muy alto</option>
                    </select>
                </div>
                <div class="form-group"><label>Frecuencia de visita</label>
                    <select name="frequency">
                        <option>Ocasional</option><option>Semanal</option><option>Frecuente</option><option>Diaria</option>
                    </select>
                </div>
                <div class="form-group"><label>¿El perro suele regresar por sí mismo?</label>
                    <select name="returnAlone"><option>No se sabe</option><option>Sí</option><option>No</option></select>
                </div>
                <div class="form-group"><label>¿Es una zona donde suele sentirse seguro?</label>
                    <select name="isSafe"><option>No se sabe</option><option>Sí</option><option>No</option></select>
                </div>
                <div class="form-group"><label>Observaciones</label><textarea name="observations"></textarea></div>
                <button type="submit" class="btn">Guardar zona segura</button>
            </form>
        `;
        this.showModal(html);
    },

    saveSafeZone(event, center, points, radiusMeters, type) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const zone = {
            id: Database.generateId(),
            name: form.name.value,
            type: type,
            zoneType: form.zoneType.value,
            familiarity: form.familiarity.value,
            frequency: form.frequency.value,
            returnAlone: form.returnAlone.value === 'Sí' ? true : form.returnAlone.value === 'No' ? false : null,
            isSafe: form.isSafe.value === 'Sí' ? true : form.isSafe.value === 'No' ? false : null,
            observations: form.observations.value
        };
        if (type === 'circle') {
            zone.center = center;
            zone.radiusMeters = radiusMeters;
        } else if (type === 'polygon') {
            zone.points = points;
        }
        caseData.safeZones = caseData.safeZones || [];
        caseData.safeZones.push(zone);
        Database.updateCase(caseData.id, { safeZones: caseData.safeZones });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    deleteSafeZone(zoneId) {
        if (!confirm('¿Eliminar esta zona segura?')) return;
        const caseData = AppState.currentCase;
        caseData.safeZones = caseData.safeZones.filter(z => z.id !== zoneId);
        Database.updateCase(caseData.id, { safeZones: caseData.safeZones });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== LUGAR DE EXTRAVÍO ==========
    showLostForm(lat, lng) {
        const html = `
            <h3>🔴 Lugar donde se extravió</h3>
            <p><strong>📍 Ubicación seleccionada:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveLostLocation(event, ${lat}, ${lng})">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Precisión de ubicación</label>
                    <select name="precision"><option>Exacta</option><option>±50m</option><option>±200m</option><option>±500m</option><option>±1km</option></select>
                </div>
                <div class="form-group"><label>Observaciones</label><textarea name="notes"></textarea></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    saveLostLocation(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        caseData.locations = caseData.locations || {};
        caseData.locations.lost = {
            lat: lat,
            lng: lng,
            description: form.description.value,
            datetime: form.datetime.value,
            precision: form.precision.value
        };
        Database.updateCase(caseData.id, { locations: caseData.locations });
        // También actualizar cronología del extravío si no existe lastConfirmed
        if (!caseData.extravioTimeline?.lastConfirmed) {
            TimelineManager.updateExtravioTimeline(caseData, 'lastConfirmed', {
                datetime: form.datetime.value,
                lat: lat,
                lng: lng,
                description: form.description.value,
                precision: form.precision.value
            });
        }
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== ÚLTIMA UBICACIÓN CONFIRMADA ==========
    showLastConfirmedForm(lat, lng) {
        if (lat === null || lat === undefined) {
            alert('Haz clic en el mapa para seleccionar la ubicación.');
            this.pendingAction = { type: 'lastConfirmed' };
            return;
        }
        const html = `
            <h3>👀 Última ubicación confirmada</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveLastConfirmed(event, ${lat}, ${lng})">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Precisión</label>
                    <select name="precision"><option>Exacta</option><option>±50m</option><option>±200m</option><option>±500m</option><option>±1km</option></select>
                </div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    saveLastConfirmed(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        TimelineManager.updateExtravioTimeline(caseData, 'lastConfirmed', {
            datetime: form.datetime.value,
            lat: lat,
            lng: lng,
            description: form.description.value,
            precision: form.precision.value
        });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== HOGAR / BASE ==========
    showHomeForm(lat, lng) {
        const html = `
            <h3>🏠 Hogar</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveHome(event, ${lat}, ${lng})">
                <div class="form-group"><label>Descripción</label><input type="text" name="description" value="Hogar"></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    saveHome(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        caseData.locations = caseData.locations || {};
        caseData.locations.home = { lat, lng, description: form.description.value };
        Database.updateCase(caseData.id, { locations: caseData.locations });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    showBaseForm(lat, lng) {
        const html = `
            <h3>📍 Lugar base</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveBase(event, ${lat}, ${lng})">
                <div class="form-group"><label>Descripción</label><input type="text" name="description" value="Lugar base"></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    saveBase(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        caseData.locations = caseData.locations || {};
        caseData.locations.base = { lat, lng, description: form.description.value };
        Database.updateCase(caseData.id, { locations: caseData.locations });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== PUNTOS DE INTERÉS ==========
    showPOIForm(lat, lng, category) {
        const categoryNames = {
            water: '💧 Agua', food: '🍖 Comida', refuge: '🏚️ Refugio', barrier: '🚧 Barrera',
            dangerous_crossing: '⚠️ Zona peligrosa', other: '📌 Otro lugar de interés'
        };
        const catName = categoryNames[category] || category;
        const html = `
            <h3>${catName}</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.savePOI(event, ${lat}, ${lng}, '${category}')">
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Importancia (0-1)</label><input type="range" min="0" max="1" step="0.1" name="importance" value="0.5" oninput="this.nextElementSibling.textContent = this.value"><span>0.5</span></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    savePOI(event, lat, lng, category) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const poi = {
            id: Database.generateId(),
            category: category,
            lat: lat,
            lng: lng,
            description: form.description.value,
            importance: parseFloat(form.importance.value) || 0.5,
            photo: '',
            date: new Date().toISOString().split('T')[0]
        };
        caseData.poi = caseData.poi || [];
        caseData.poi.push(poi);
        Database.updateCase(caseData.id, { poi: caseData.poi });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    renderPOIs(caseData, container) {
        let html = '<div class="card"><h3>📍 Puntos de interés</h3>';
        html += '<button class="btn" onclick="UI.showGenericPOIForm()">➕ Agregar punto (elegir en mapa)</button>';
        html += '<table><tr><th>Categoría</th><th>Descripción</th><th>Coordenadas</th><th>Importancia</th><th>Acciones</th></tr>';
        (caseData.poi || []).forEach(p => {
            html += `<tr><td>${p.category}</td><td>${p.description || ''}</td><td>(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})</td><td>${p.importance || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deletePOI('${p.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showGenericPOIForm() {
        alert('Haz clic en el mapa para seleccionar la ubicación y luego elige la categoría desde el menú contextual (pulsación larga).');
        this.pendingAction = { type: 'poi' };
    },

    deletePOI(poiId) {
        if (!confirm('¿Eliminar este punto?')) return;
        const caseData = AppState.currentCase;
        caseData.poi = caseData.poi.filter(p => p.id !== poiId);
        Database.updateCase(caseData.id, { poi: caseData.poi });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== RUTAS ==========
    renderRoutes(caseData, container) {
        let html = '<div class="card"><h3>🛤️ Rutas</h3>';
        html += '<button class="btn" onclick="MapManager.startDrawingRoute()">➕ Dibujar ruta</button>';
        html += '<table><tr><th>Nombre</th><th>Tipo</th><th>Frecuencia</th><th>Distancia (km)</th><th>Acciones</th></tr>';
        (caseData.habitualRoutes || []).forEach(r => {
            html += `<tr><td>${r.name}</td><td>${r.type || 'Habitual'}</td><td>${r.frequency || ''}</td><td>${r.distance ? r.distance.toFixed(2) : ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deleteRoute('${r.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showRouteFormFromPoints(points) {
        const distance = this.calculateRouteDistance(points);
        const html = `
            <h3>Nueva ruta</h3>
            <p>Puntos: ${points.length}, Distancia: ${distance.toFixed(2)} km</p>
            <form onsubmit="UI.saveRoute(event, ${JSON.stringify(points)}, ${distance})">
                <div class="form-group"><label>Nombre</label><input type="text" name="name" required></div>
                <div class="form-group"><label>Tipo</label>
                    <select name="type"><option>Habitual</option><option>Observada</option><option>Posible</option><option>Retorno</option><option>Otra</option></select>
                </div>
                <div class="form-group"><label>Frecuencia</label><input type="text" name="frequency" placeholder="Diaria, Semanal"></div>
                <div class="form-group"><label>Horario</label><input type="text" name="schedule"></div>
                <div class="form-group"><label>Días</label><input type="text" name="days"></div>
                <div class="form-group"><label>Nivel de confianza (0-1)</label><input type="range" min="0" max="1" step="0.1" name="confidence" value="0.8" oninput="this.nextElementSibling.textContent = this.value"><span>0.8</span></div>
                <div class="form-group"><label>Observaciones</label><textarea name="observations"></textarea></div>
                <button type="submit" class="btn">Guardar ruta</button>
            </form>
        `;
        this.showModal(html);
    },

    calculateRouteDistance(points) {
        let dist = 0;
        for (let i = 0; i < points.length - 1; i++) {
            dist += Calculations.distance(points[i].lat, points[i].lng, points[i+1].lat, points[i+1].lng);
        }
        return dist;
    },

    saveRoute(event, points, distance) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const route = {
            id: Database.generateId(),
            name: form.name.value,
            type: form.type.value,
            frequency: form.frequency.value,
            schedule: form.schedule.value,
            days: form.days.value,
            distance: distance,
            duration: 0,
            confidence: parseFloat(form.confidence.value) || 0.8,
            observations: form.observations.value,
            points: points
        };
        caseData.habitualRoutes = caseData.habitualRoutes || [];
        caseData.habitualRoutes.push(route);
        Database.updateCase(caseData.id, { habitualRoutes: caseData.habitualRoutes });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    deleteRoute(routeId) {
        if (!confirm('¿Eliminar esta ruta?')) return;
        const caseData = AppState.currentCase;
        caseData.habitualRoutes = caseData.habitualRoutes.filter(r => r.id !== routeId);
        Database.updateCase(caseData.id, { habitualRoutes: caseData.habitualRoutes });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
        this.recalculateZones();
    },

    // ========== EVIDENCIA ==========
    renderEvidence(caseData, container) {
        let html = '<div class="card"><h3>🔍 Evidencias</h3>';
        html += '<button class="btn" onclick="UI.showEvidenceForm(null, null)">➕ Agregar evidencia (elegir en mapa)</button>';
        html += '<table><tr><th>Fecha</th><th>Ubicación</th><th>Hecho</th><th>Interpretación</th><th>Acciones</th></tr>';
        (caseData.evidence || []).forEach(e => {
            html += `<tr><td>${new Date(e.datetime).toLocaleString()}</td><td>(${e.lat.toFixed(5)}, ${e.lng.toFixed(5)})</td><td>${e.fact || ''}</td><td>${e.interpretation || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deleteEvidence('${e.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showEvidenceForm(lat, lng) {
        if (lat === null || lat === undefined) {
            alert('Haz clic en el mapa para seleccionar la ubicación de la evidencia.');
            this.pendingAction = { type: 'evidence' };
            return;
        }
        const html = `
            <h3>Nueva evidencia</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveEvidence(event, ${lat}, ${lng})">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Fuente</label><input type="text" name="source"></div>
                <div class="form-group"><label>Confiabilidad (0-1)</label><input type="range" min="0" max="1" step="0.1" name="reliability" value="0.8" oninput="this.nextElementSibling.textContent = this.value"><span>0.8</span></div>
                <div class="form-group"><label>Hecho (solo lo observado)</label><textarea name="fact" required></textarea></div>
                <div class="form-group"><label>Interpretación (tu análisis)</label><textarea name="interpretation"></textarea></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    saveEvidence(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const evidence = {
            id: Database.generateId(),
            datetime: form.datetime.value,
            lat: lat,
            lng: lng,
            description: form.description.value,
            source: form.source.value,
            reliability: parseFloat(form.reliability.value) || 0.8,
            fact: form.fact.value,
            interpretation: form.interpretation.value,
            photo: ''
        };
        caseData.evidence = caseData.evidence || [];
        caseData.evidence.push(evidence);
        Database.updateCase(caseData.id, { evidence: caseData.evidence });
        TimelineManager.addEvent(caseData, {
            datetime: evidence.datetime,
            type: 'evidence',
            description: `Evidencia: ${evidence.fact}`,
            lat: evidence.lat,
            lng: evidence.lng
        });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
    },

    deleteEvidence(evidenceId) {
        if (!confirm('¿Eliminar esta evidencia?')) return;
        const caseData = AppState.currentCase;
        caseData.evidence = caseData.evidence.filter(e => e.id !== evidenceId);
        Database.updateCase(caseData.id, { evidence: caseData.evidence });
        AppState.currentCase = Database.getCase(caseData.id);
        this.renderCurrentTab();
    },

    // ========== TESTIMONIO ==========
    showTestimonyForm(lat, lng) {
        const html = `
            <h3>🗣️ Testimonio</h3>
            <p><strong>📍 Ubicación:</strong> ${lat.toFixed(5)}, ${lng.toFixed(5)}</p>
            <form onsubmit="UI.saveTestimony(event, ${lat}, ${lng})">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Persona que reporta</label><input type="text" name="reporter"></div>
                <div class="form-group"><label>Descripción del testimonio</label><textarea name="description" required></textarea></div>
                <div class="form-group"><label>Nivel de confiabilidad (0-1)</label><input type="range" min="0" max="1" step="0.1" name="reliability" value="0.7" oninput="this.nextElementSibling.textContent = this.value"><span>0.7</span></div>
                <button type="submit" class="btn">Guardar testimonio</button>
            </form>
        `;
        this.showModal(html);
    },

    saveTestimony(event, lat, lng) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        // Guardar como evidencia
        const evidence = {
            id: Database.generateId(),
            datetime: form.datetime.value,
            lat: lat,
            lng: lng,
            description: `Testimonio de ${form.reporter.value}`,
            source: form.reporter.value,
            reliability: parseFloat(form.reliability.value) || 0.7,
            fact: form.description.value,
            interpretation: 'Testimonio registrado',
            photo: ''
        };
        caseData.evidence = caseData.evidence || [];
        caseData.evidence.push(evidence);
        Database.updateCase(caseData.id, { evidence: caseData.evidence });
        TimelineManager.addEvent(caseData, {
            datetime: evidence.datetime,
            type: 'evidence',
            description: `Testimonio: ${form.description.value.substring(0, 50)}`,
            lat: lat,
            lng: lng
        });
        AppState.currentCase = Database.getCase(caseData.id);
        this.hideModal();
        this.renderCurrentTab();
        MapManager.setCase(AppState.currentCase);
    },

    // ========== CONFIGURACIÓN ==========
    renderConfig(container) {
        const config = Database.getConfig();
        let html = '<div class="card"><h3>⚙️ Configuración</h3>';
        html += '<h4>🚶 Velocidades</h4>';
        html += '<div class="form-group"><label>Velocidad mínima (caminando tranquilamente)</label>';
        html += `<input type="number" step="0.1" id="vMin" value="${config.velocities.min}">`;
        html += '<div class="help-text">Incluye pausas. Se usa para calcular el radio mínimo probable.</div></div>';
        html += '<div class="form-group"><label>Velocidad habitual (desplazamiento normal)</label>';
        html += `<input type="number" step="0.1" id="vTypical" value="${config.velocities.typical}">`;
        html += '<div class="help-text">Se usa para la estimación central del desplazamiento.</div></div>';
        html += '<div class="form-group"><label>Velocidad máxima (huida o carrera)</label>';
        html += `<input type="number" step="0.1" id="vMax" value="${config.velocities.max}">`;
        html += '<div class="help-text">Límite superior del radio de búsqueda probable.</div></div>';
        html += '<button class="btn" onclick="UI.saveConfig()">Guardar configuración</button>';
        html += '</div>';
        container.innerHTML = html;
    },

    saveConfig() {
        const config = Database.getConfig();
        config.velocities.min = parseFloat(document.getElementById('vMin').value);
        config.velocities.typical = parseFloat(document.getElementById('vTypical').value);
        config.velocities.max = parseFloat(document.getElementById('vMax').value);
        Database.setConfig(config);
        ProbabilityEngine.config = config;
        alert('Configuración guardada');
        this.renderCurrentTab();
    },

    // ========== GESTIÓN DE CASO ==========
    renderCaseManagement(container) {
        const cases = Database.getCases();
        let html = '<div class="card"><h3>📁 Gestión de caso</h3>';
        html += '<button class="btn" onclick="UI.showCreateCaseForm()">➕ Nuevo caso</button> ';
        html += '<button class="btn" onclick="UI.importCaseDialog()">📥 Importar</button>';
        html += '<h4>Casos guardados</h4>';
        if (cases.length === 0) {
            html += '<p>No hay casos. Crea uno nuevo o importa.</p>';
        } else {
            html += '<table><tr><th>Nombre</th><th>Estado</th><th>Acciones</th></tr>';
            cases.forEach(c => {
                html += `<tr><td>${c.name}</td><td>${c.status || 'active'}</td>
                <td>
                    <button class="btn btn-sm" onclick="UI.loadCase('${c.id}')">Cargar</button>
                    <button class="btn btn-sm" onclick="UI.exportCase('${c.id}')">Exportar</button>
                    <button class="btn btn-sm btn-danger" onclick="UI.deleteCase('${c.id}')">Eliminar</button>
                </td></tr>`;
            });
            html += '</table>';
        }
        html += '</div>';
        container.innerHTML = html;
    },

    showCreateCaseForm() {
        alert('Para crear un caso, primero selecciona en el mapa la ubicación del lugar de extravío (pulsación larga). Luego podrás completar los datos.');
        // Simplificación: pedir nombre y luego usar el mapa
        const name = prompt('Nombre del caso (ej: Max — Cajamarca — 30/08/2026):');
        if (!name) return;
        const animalName = prompt('Nombre del animal:');
        if (!animalName) return;
        const caseData = {
            name: name,
            animal: {
                name: animalName,
                photo: '',
                species: 'Perro',
                breed: '',
                age: '',
                sex: '',
                size: '',
                weight: '',
                color: '',
                distinctive: '',
                behavior: {
                    sociability: 0.5, fearPeople: 0.5, fearTraffic: 0.5, fearVehicles: 0.5,
                    followPeople: 0.5, followDogs: 0.5, territorial: 0.5, hideTendency: 0.5,
                    foodMotivated: 0.5, waterMotivated: 0.5, returnHome: 0.5, walkingExperience: 0.5,
                    neighborhoodKnowledge: 0.5, activityLevel: 0.5
                }
            },
            locations: {},
            habitualRoutes: [],
            sightings: [],
            poi: [],
            safeZones: [],
            extravioTimeline: { lastConfirmed: null, detection: null, searchStart: null },
            timeline: [],
            evidence: [],
            searchZones: [],
            searchCoverage: []
        };
        const newCase = Database.createCase(caseData);
        AppState.currentCase = newCase;
        document.getElementById('case-indicator').textContent = newCase.name;
        MapManager.setCase(newCase);
        this.switchTab('dashboard');
    },

    loadCase(caseId) {
        const caseData = Database.getCase(caseId);
        if (caseData) {
            AppState.currentCase = caseData;
            document.getElementById('case-indicator').textContent = caseData.name;
            MapManager.setCase(caseData);
            this.switchTab('dashboard');
        }
    },

    exportCase(caseId) {
        const json = Database.exportCase(caseId);
        if (!json) {
            alert('Caso no encontrado');
            return;
        }
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `rastro_case_${caseId}.json`;
        a.click();
        URL.revokeObjectURL(url);
    },

    importCaseDialog() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const text = await file.text();
            try {
                const imported = Database.importCase(text, false);
                alert('Caso importado correctamente');
                this.renderCaseManagement(document.getElementById('tab-content'));
                document.getElementById('case-indicator').textContent = imported.name;
                MapManager.setCase(imported);
                AppState.currentCase = imported;
            } catch (err) {
                alert('Error al importar: ' + err.message);
            }
        };
        input.click();
    },

    deleteCase(caseId) {
        if (!confirm('¿Seguro que deseas eliminar este caso? Esta acción no se puede deshacer.')) return;
        Database.deleteCase(caseId);
        if (AppState.currentCase && AppState.currentCase.id === caseId) {
            AppState.currentCase = null;
            document.getElementById('case-indicator').textContent = 'Sin caso activo';
            MapManager.setCase(null);
        }
        this.renderCaseManagement(document.getElementById('tab-content'));
    },

    showModal(html) {
        document.getElementById('modal-body').innerHTML = html;
        document.getElementById('modal-overlay').classList.remove('hidden');
    },

    hideModal() {
        document.getElementById('modal-overlay').classList.add('hidden');
    },

    toggleTheme() {
        document.body.classList.toggle('dark');
        const theme = document.body.classList.contains('dark') ? 'dark' : 'light';
        const config = Database.getConfig();
        config.theme = theme;
        Database.setConfig(config);
    },

    handleMapClickForForm(latlng) {
        // Si hay una acción pendiente, ejecutarla con las coordenadas
        if (this.pendingAction) {
            const action = this.pendingAction;
            this.pendingAction = null;
            switch (action.type) {
                case 'sighting': this.showSightingForm(latlng.lat, latlng.lng); break;
                case 'evidence': this.showEvidenceForm(latlng.lat, latlng.lng); break;
                case 'lastConfirmed': this.showLastConfirmedForm(latlng.lat, latlng.lng); break;
                case 'poi': this.showGenericPOIForm(); break;
                default: break;
            }
        } else {
            // Si hay un modal abierto con campos lat/lng, rellenarlos (por compatibilidad)
            const modal = document.getElementById('modal-overlay');
            if (!modal.classList.contains('hidden')) {
                const latInput = modal.querySelector('input[name="lat"]');
                const lngInput = modal.querySelector('input[name="lng"]');
                if (latInput && lngInput) {
                    latInput.value = latlng.lat.toFixed(6);
                    lngInput.value = latlng.lng.toFixed(6);
                    alert('Coordenadas capturadas');
                }
            }
        }
    }
};

window.UI = UI;