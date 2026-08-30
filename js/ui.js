// ui.js — Renderizado de interfaz, paneles, formularios, dashboard, filtros

const UI = {
    currentTab: 'dashboard',

    init() {
        // Inicializar pestañas
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Botón menú móvil
        document.getElementById('menu-toggle').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('hidden-mobile');
        });

        // Botón tema
        document.getElementById('theme-toggle').addEventListener('click', () => {
            this.toggleTheme();
        });

        // Cerrar modal
        document.getElementById('modal-close').addEventListener('click', () => {
            this.hideModal();
        });

        // Escuchar clic en mapa para formularios
        document.addEventListener('rastro:mapClick', (e) => {
            this.handleMapClickForForm(e.detail);
        });
    },

    switchTab(tabName) {
        this.currentTab = tabName;
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelector(`.tab[data-tab="${tabName}"]`).classList.add('active');
        this.renderCurrentTab();
        // En móvil, ocultar sidebar
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
            case 'sightings': this.renderSightings(caseData, container); break;
            case 'routes': this.renderRoutes(caseData, container); break;
            case 'poi': this.renderPOIs(caseData, container); break;
            case 'timeline': this.renderTimelineTab(caseData, container); break;
            case 'evidence': this.renderEvidence(caseData, container); break;
            case 'search': this.renderSearchTab(caseData, container); break;
            case 'config': this.renderConfig(container); break;
            case 'case': this.renderCaseManagement(container); break;
            default: container.innerHTML = '<p>Selecciona una pestaña</p>';
        }
    },

    renderDashboard(caseData, container) {
        if (!caseData) return;
        const lastSighting = ProbabilityEngine.getLastSighting(caseData);
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
            html += `<p><strong>📍 Última ubicación conocida:</strong> (${lastSighting.lat.toFixed(5)}, ${lastSighting.lng.toFixed(5)})</p>`;
            html += `<p><strong>👀 Último avistamiento:</strong> ${new Date(lastSighting.datetime).toLocaleString()}</p>`;
        }
        if (distToHome !== null) {
            html += `<p><strong>🏠 Distancia al hogar:</strong> ${distToHome.toFixed(2)} km</p>`;
        }
        html += `<p><strong>📊 Nivel de confianza:</strong> <span class="score-badge confidence-${confidence.level}">${confidence.level.toUpperCase()} (${confidence.percentage}%)</span></p>`;
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

        // Botón para recalcular y mostrar zonas
        html += `<button class="btn" onclick="UI.recalculateZones()">🔄 Recalcular zonas de búsqueda</button>`;

        container.innerHTML = html;
    },

    recalculateZones() {
        const caseData = AppState.currentCase;
        if (!caseData) return;
        const scores = ProbabilityEngine.calculateGridScores(caseData);
        MapManager.showPriorityZones(scores);
        // También dibujar corredor de retorno
        const corridor = ProbabilityEngine.calculateReturnCorridor(caseData);
        if (corridor) {
            MapManager.drawReturnCorridor(corridor.points, corridor.bufferKm);
        }
    },

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

        html += '<h4>Comportamiento (0 = nada, 1 = mucho)</h4>';
        const behaviorFields = [
            ['sociability', 'Sociabilidad'], ['fearPeople', 'Miedo a personas'], ['fearTraffic', 'Miedo al tráfico'],
            ['fearVehicles', 'Miedo a vehículos'], ['followPeople', 'Tiende a seguir personas'], ['followDogs', 'Tiende a seguir perros'],
            ['territorial', 'Territorialidad'], ['hideTendency', 'Tendencia a esconderse'], ['foodMotivated', 'Motivado por comida'],
            ['waterMotivated', 'Busca agua'], ['returnHome', 'Tiende a regresar al hogar'], ['walkingExperience', 'Experiencia caminando solo'],
            ['neighborhoodKnowledge', 'Conocimiento del barrio'], ['activityLevel', 'Nivel de actividad']
        ];
        behaviorFields.forEach(([key, label]) => {
            const val = b[key] !== undefined ? b[key] : 0.5;
            html += `<div class="form-group"><label>${label}</label><input type="range" min="0" max="1" step="0.1" name="behavior_${key}" value="${val}" oninput="this.nextElementSibling.textContent = this.value"><span>${val}</span></div>`;
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
    },

    renderSightings(caseData, container) {
        let html = '<div class="card"><h3>👀 Avistamientos</h3>';
        html += '<button class="btn" onclick="UI.showAddSightingForm()">➕ Agregar avistamiento</button>';
        html += '<table><tr><th>Fecha/Hora</th><th>Ubicación</th><th>Certeza</th><th>Descripción</th><th>Acciones</th></tr>';
        (caseData.sightings || []).forEach(s => {
            const certaintyClass = { confirmed: 'priority-very-high', very_likely: 'priority-high', possible: 'priority-medium', doubtful: 'priority-very-low' }[s.certainty] || '';
            html += `<tr>
                <td>${new Date(s.datetime).toLocaleString()}</td>
                <td>(${s.lat.toFixed(5)}, ${s.lng.toFixed(5)})</td>
                <td><span class="score-badge ${certaintyClass}">${s.certainty}</span></td>
                <td>${s.description || ''}</td>
                <td><button class="btn btn-sm btn-danger" onclick="UI.deleteSighting('${s.id}')">Eliminar</button></td>
            </tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showAddSightingForm() {
        const html = `
            <h3>Nuevo avistamiento</h3>
            <form onsubmit="UI.addSighting(event)">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Latitud</label><input type="number" step="any" name="lat" required placeholder="ej. -7.1638"></div>
                <div class="form-group"><label>Longitud</label><input type="number" step="any" name="lng" required placeholder="ej. -78.5004"></div>
                <div class="form-group"><label>Reportado por</label><input type="text" name="reporter"></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Distancia estimada (m)</label><input type="number" name="estimatedDistance" value="10"></div>
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
                <div class="form-group"><label>Fotografía (URL o base64)</label><textarea name="photo"></textarea></div>
                <div class="form-group"><label>Notas</label><textarea name="notes"></textarea></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    addSighting(event) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const sighting = {
            id: Database.generateId(),
            datetime: form.datetime.value,
            lat: parseFloat(form.lat.value),
            lng: parseFloat(form.lng.value),
            reporter: form.reporter.value,
            description: form.description.value,
            estimatedDistance: parseFloat(form.estimatedDistance.value) || 0,
            direction: form.direction.value,
            speed: parseFloat(form.speed.value) || 0,
            certainty: form.certainty.value,
            photo: form.photo.value,
            notes: form.notes.value
        };
        caseData.sightings = caseData.sightings || [];
        caseData.sightings.push(sighting);
        Database.updateCase(caseData.id, { sightings: caseData.sightings });
        // Agregar a cronología
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

    renderRoutes(caseData, container) {
        let html = '<div class="card"><h3>🛤 Rutas habituales</h3>';
        html += '<button class="btn" onclick="UI.showAddRouteForm()">➕ Agregar ruta</button>';
        html += '<table><tr><th>Nombre</th><th>Frecuencia</th><th>Horario</th><th>Distancia (km)</th><th>Confianza</th><th>Acciones</th></tr>';
        (caseData.habitualRoutes || []).forEach(r => {
            html += `<tr><td>${r.name}</td><td>${r.frequency || ''}</td><td>${r.schedule || ''}</td><td>${r.distance || ''}</td><td>${r.confidence || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deleteRoute('${r.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showAddRouteForm() {
        const html = `
            <h3>Nueva ruta habitual</h3>
            <form onsubmit="UI.addRoute(event)">
                <div class="form-group"><label>Nombre</label><input type="text" name="name" required></div>
                <div class="form-group"><label>Frecuencia</label><input type="text" name="frequency" placeholder="Diaria, Semanal"></div>
                <div class="form-group"><label>Horario</label><input type="text" name="schedule" placeholder="07:00-07:40"></div>
                <div class="form-group"><label>Días</label><input type="text" name="days" placeholder="Todos, Lunes a Viernes"></div>
                <div class="form-group"><label>Distancia (km)</label><input type="number" step="0.1" name="distance"></div>
                <div class="form-group"><label>Duración (min)</label><input type="number" name="duration"></div>
                <div class="form-group"><label>Nivel de confianza (0-1)</label><input type="range" min="0" max="1" step="0.1" name="confidence" value="0.8" oninput="this.nextElementSibling.textContent = this.value"><span>0.8</span></div>
                <div class="form-group"><label>Puntos (JSON array de {lat,lng})</label><textarea name="points" rows="4" placeholder='[{"lat":-7.156,"lng":-78.493},{"lat":-7.158,"lng":-78.495}]'></textarea></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    addRoute(event) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        let points;
        try {
            points = JSON.parse(form.points.value);
        } catch (e) {
            alert('Formato de puntos inválido. Use JSON array.');
            return;
        }
        const route = {
            id: Database.generateId(),
            name: form.name.value,
            frequency: form.frequency.value,
            schedule: form.schedule.value,
            days: form.days.value,
            distance: parseFloat(form.distance.value) || 0,
            duration: parseFloat(form.duration.value) || 0,
            confidence: parseFloat(form.confidence.value) || 0.8,
            points
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

    renderPOIs(caseData, container) {
        let html = '<div class="card"><h3>📍 Puntos de interés</h3>';
        html += '<button class="btn" onclick="UI.showAddPOIForm()">➕ Agregar punto</button>';
        html += '<table><tr><th>Categoría</th><th>Descripción</th><th>Coordenadas</th><th>Importancia</th><th>Acciones</th></tr>';
        (caseData.poi || []).forEach(p => {
            html += `<tr><td>${p.category}</td><td>${p.description || ''}</td><td>(${p.lat.toFixed(5)}, ${p.lng.toFixed(5)})</td><td>${p.importance || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deletePOI('${p.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showAddPOIForm() {
        const categories = ['food','water','park','market','restaurant','known_house','empty_land','abandoned','vegetation','quiet','traffic','dangerous_crossing','barrier','river','canal','wall','fence','other_animal','refuge'];
        const html = `
            <h3>Nuevo punto de interés</h3>
            <form onsubmit="UI.addPOI(event)">
                <div class="form-group"><label>Categoría</label>
                    <select name="category">${categories.map(c => `<option value="${c}">${c}</option>`).join('')}</select>
                </div>
                <div class="form-group"><label>Latitud</label><input type="number" step="any" name="lat" required></div>
                <div class="form-group"><label>Longitud</label><input type="number" step="any" name="lng" required></div>
                <div class="form-group"><label>Descripción</label><textarea name="description"></textarea></div>
                <div class="form-group"><label>Importancia (0-1)</label><input type="range" min="0" max="1" step="0.1" name="importance" value="0.5" oninput="this.nextElementSibling.textContent = this.value"><span>0.5</span></div>
                <button type="submit" class="btn">Guardar</button>
            </form>
        `;
        this.showModal(html);
    },

    addPOI(event) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const poi = {
            id: Database.generateId(),
            category: form.category.value,
            lat: parseFloat(form.lat.value),
            lng: parseFloat(form.lng.value),
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

    renderTimelineTab(caseData, container) {
        let html = '<div class="card"><h3>🕒 Cronología</h3>';
        html += '<div id="timeline-container"></div>';
        html += '</div>';
        container.innerHTML = html;
        TimelineManager.renderTimeline(caseData, 'timeline-container');
    },

    renderEvidence(caseData, container) {
        let html = '<div class="card"><h3>🔍 Evidencias</h3>';
        html += '<button class="btn" onclick="UI.showAddEvidenceForm()">➕ Agregar evidencia</button>';
        html += '<table><tr><th>Fecha</th><th>Ubicación</th><th>Descripción</th><th>Hecho</th><th>Interpretación</th><th>Acciones</th></tr>';
        (caseData.evidence || []).forEach(e => {
            html += `<tr><td>${new Date(e.datetime).toLocaleString()}</td><td>(${e.lat.toFixed(5)}, ${e.lng.toFixed(5)})</td><td>${e.description || ''}</td><td>${e.fact || ''}</td><td>${e.interpretation || ''}</td>
            <td><button class="btn btn-sm btn-danger" onclick="UI.deleteEvidence('${e.id}')">Eliminar</button></td></tr>`;
        });
        html += '</table></div>';
        container.innerHTML = html;
    },

    showAddEvidenceForm() {
        const html = `
            <h3>Nueva evidencia</h3>
            <form onsubmit="UI.addEvidence(event)">
                <div class="form-group"><label>Fecha y hora</label><input type="datetime-local" name="datetime" required></div>
                <div class="form-group"><label>Latitud</label><input type="number" step="any" name="lat" required></div>
                <div class="form-group"><label>Longitud</label><input type="number" step="any" name="lng" required></div>
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

    addEvidence(event) {
        event.preventDefault();
        const caseData = AppState.currentCase;
        const form = event.target;
        const evidence = {
            id: Database.generateId(),
            datetime: form.datetime.value,
            lat: parseFloat(form.lat.value),
            lng: parseFloat(form.lng.value),
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
        // Agregar a cronología
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

    renderSearchTab(caseData, container) {
        SearchMode.renderSearchPanel(caseData, container.id);
    },

    renderConfig(container) {
        const config = Database.getConfig();
        let html = '<div class="card"><h3>⚙️ Configuración</h3>';
        html += '<h4>Velocidades (km/h)</h4>';
        html += `<form onsubmit="UI.saveConfig(event)">`;
        html += `<div class="form-group"><label>Velocidad mínima</label><input type="number" step="0.1" name="vMin" value="${config.velocities.min}"></div>`;
        html += `<div class="form-group"><label>Velocidad típica</label><input type="number" step="0.1" name="vTypical" value="${config.velocities.typical}"></div>`;
        html += `<div class="form-group"><label>Velocidad máxima</label><input type="number" step="0.1" name="vMax" value="${config.velocities.max}"></div>`;
        html += '<h4>Pesos del modelo</h4>';
        Object.entries(config.weights).forEach(([key, val]) => {
            html += `<div class="form-group"><label>${key}</label><input type="number" name="weight_${key}" value="${val}"></div>`;
        });
        html += '<h4>Parámetros de decaimiento (km)</h4>';
        html += `<div class="form-group"><label>Sigma general</label><input type="number" step="0.1" name="sigma" value="${config.sigma}"></div>`;
        html += `<div class="form-group"><label>Sigma hogar</label><input type="number" step="0.1" name="sigmaHome" value="${config.sigmaHome}"></div>`;
        html += `<div class="form-group"><label>Sigma ruta</label><input type="number" step="0.1" name="sigmaRoute" value="${config.sigmaRoute}"></div>`;
        html += `<div class="form-group"><label>Sigma POI</label><input type="number" step="0.1" name="sigmaPOI" value="${config.sigmaPOI}"></div>`;
        html += '<button type="submit" class="btn">Guardar configuración</button>';
        html += '</form></div>';
        container.innerHTML = html;
    },

    saveConfig(event) {
        event.preventDefault();
        const form = event.target;
        const config = Database.getConfig();
        config.velocities.min = parseFloat(form.vMin.value);
        config.velocities.typical = parseFloat(form.vTypical.value);
        config.velocities.max = parseFloat(form.vMax.value);
        Object.keys(config.weights).forEach(key => {
            config.weights[key] = parseFloat(form[`weight_${key}`].value);
        });
        config.sigma = parseFloat(form.sigma.value);
        config.sigmaHome = parseFloat(form.sigmaHome.value);
        config.sigmaRoute = parseFloat(form.sigmaRoute.value);
        config.sigmaPOI = parseFloat(form.sigmaPOI.value);
        Database.setConfig(config);
        ProbabilityEngine.config = config;
        alert('Configuración guardada');
    },

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
        const html = `
            <h3>Nuevo caso</h3>
            <form onsubmit="UI.createCase(event)">
                <div class="form-group"><label>Nombre del caso</label><input type="text" name="name" required placeholder="Max — Cajamarca — 30/08/2026"></div>
                <div class="form-group"><label>Latitud lugar de extravío</label><input type="number" step="any" name="lostLat" required></div>
                <div class="form-group"><label>Longitud lugar de extravío</label><input type="number" step="any" name="lostLng" required></div>
                <div class="form-group"><label>Latitud hogar</label><input type="number" step="any" name="homeLat"></div>
                <div class="form-group"><label>Longitud hogar</label><input type="number" step="any" name="homeLng"></div>
                <div class="form-group"><label>Nombre del animal</label><input type="text" name="animalName" required></div>
                <button type="submit" class="btn">Crear</button>
            </form>
        `;
        this.showModal(html);
    },

    createCase(event) {
        event.preventDefault();
        const form = event.target;
        const caseData = {
            name: form.name.value,
            animal: {
                name: form.animalName.value,
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
            locations: {
                lost: { lat: parseFloat(form.lostLat.value), lng: parseFloat(form.lostLng.value), description: 'Lugar de extravío' },
                home: form.homeLat.value ? { lat: parseFloat(form.homeLat.value), lng: parseFloat(form.homeLng.value), description: 'Hogar' } : null,
                base: form.homeLat.value ? { lat: parseFloat(form.homeLat.value), lng: parseFloat(form.homeLng.value), description: 'Hogar' } : null
            },
            habitualRoutes: [],
            sightings: [],
            poi: [],
            timeline: [],
            evidence: [],
            searchZones: []
        };
        const newCase = Database.createCase(caseData);
        AppState.currentCase = newCase;
        this.hideModal();
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
        // Si hay un formulario modal abierto con campos lat/lng, rellenarlos
        const modal = document.getElementById('modal-overlay');
        if (modal.classList.contains('hidden')) return;
        const latInput = modal.querySelector('input[name="lat"]');
        const lngInput = modal.querySelector('input[name="lng"]');
        if (latInput && lngInput) {
            latInput.value = latlng.lat.toFixed(6);
            lngInput.value = latlng.lng.toFixed(6);
            alert('Coordenadas capturadas del mapa');
        }
    }
};

window.UI = UI;