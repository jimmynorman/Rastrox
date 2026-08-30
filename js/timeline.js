// timeline.js — Gestión de la cronología del extravío y eventos

const TimelineManager = {
    // Agregar evento a la cronología general
    addEvent(caseData, event) {
        if (!caseData.timeline) caseData.timeline = [];
        const newEvent = {
            id: Database.generateId(),
            ...event
        };
        caseData.timeline.push(newEvent);
        caseData.timeline.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        Database.updateCase(caseData.id, { timeline: caseData.timeline });
        return newEvent;
    },

    removeEvent(caseData, eventId) {
        caseData.timeline = caseData.timeline.filter(e => e.id !== eventId);
        Database.updateCase(caseData.id, { timeline: caseData.timeline });
    },

    getEvents(caseData) {
        return (caseData.timeline || []).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    },

    // Actualizar cronología del extravío (eventos clave separados)
    updateExtravioTimeline(caseData, key, data) {
        if (!caseData.extravioTimeline) {
            caseData.extravioTimeline = {
                lastConfirmed: null,
                detection: null,
                searchStart: null
            };
        }
        caseData.extravioTimeline[key] = data;
        Database.updateCase(caseData.id, { extravioTimeline: caseData.extravioTimeline });
    },

    getExtravioTimeline(caseData) {
        return caseData.extravioTimeline || {
            lastConfirmed: null,
            detection: null,
            searchStart: null
        };
    },

    // Renderizar cronología completa en HTML
    renderTimeline(caseData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const extravio = this.getExtravioTimeline(caseData);
        const events = this.getEvents(caseData);

        let html = '<div class="card"><h3>⏱️ Historia temporal del extravío</h3>';
        
        // Sección de cronología clave
        html += '<h4>Eventos fundamentales</h4>';
        html += '<div class="timeline-key-events">';
        
        // Última ubicación confirmada
        html += '<div class="key-event">';
        html += '<strong>📌 Última vez que se tuvo certeza de dónde estaba</strong><br>';
        if (extravio.lastConfirmed) {
            html += `Fecha: ${new Date(extravio.lastConfirmed.datetime).toLocaleString()}<br>`;
            if (extravio.lastConfirmed.lat && extravio.lastConfirmed.lng) {
                html += `Ubicación: (${extravio.lastConfirmed.lat.toFixed(5)}, ${extravio.lastConfirmed.lng.toFixed(5)})`;
                html += ` <button class="btn btn-sm" onclick="MapManager.setView(${extravio.lastConfirmed.lat}, ${extravio.lastConfirmed.lng}, 16)">📍</button><br>`;
            }
            if (extravio.lastConfirmed.description) html += `Descripción: ${extravio.lastConfirmed.description}<br>`;
            if (extravio.lastConfirmed.precision) html += `Precisión: ${extravio.lastConfirmed.precision}<br>`;
        } else {
            html += 'No registrado. <button class="btn btn-sm" onclick="UI.showLastConfirmedForm(null, null)">Registrar</button><br>';
        }
        html += '</div>';

        // Detección de desaparición
        html += '<div class="key-event">';
        html += '<strong>🚨 Momento en que se detectó la desaparición</strong><br>';
        if (extravio.detection) {
            html += `Fecha: ${new Date(extravio.detection.datetime).toLocaleString()}<br>`;
            if (extravio.detection.lat && extravio.detection.lng) {
                html += `Ubicación: (${extravio.detection.lat.toFixed(5)}, ${extravio.detection.lng.toFixed(5)})`;
                html += ` <button class="btn btn-sm" onclick="MapManager.setView(${extravio.detection.lat}, ${extravio.detection.lng}, 16)">📍</button><br>`;
            }
            if (extravio.detection.description) html += `Descripción: ${extravio.detection.description}<br>`;
        } else {
            html += 'No registrado. <button class="btn btn-sm" onclick="UI.showDetectionForm()">Registrar</button><br>';
        }
        html += '</div>';

        // Inicio de búsqueda
        html += '<div class="key-event">';
        html += '<strong>🔎 Momento en que comenzó la búsqueda</strong><br>';
        if (extravio.searchStart) {
            html += `Fecha: ${new Date(extravio.searchStart.datetime).toLocaleString()}<br>`;
        } else {
            html += 'No registrado. <button class="btn btn-sm" onclick="UI.showSearchStartForm()">Registrar</button><br>';
        }
        html += '</div>';
        html += '</div>'; // fin timeline-key-events

        // Eventos de la cronología general
        html += '<h4>Eventos registrados</h4>';
        if (events.length === 0) {
            html += '<p>No hay eventos adicionales.</p>';
        } else {
            html += '<ul class="timeline-list">';
            events.forEach(e => {
                const icon = e.type === 'sighting' ? '👀' : e.type === 'search' ? '🔎' : e.type === 'evidence' ? '🔍' : '📝';
                const time = new Date(e.datetime).toLocaleString();
                const location = (e.lat && e.lng) ? ` <button class="btn btn-sm" onclick="MapManager.setView(${e.lat}, ${e.lng}, 16)">📍</button>` : '';
                html += `<li class="timeline-item">
                    <span class="timeline-icon">${icon}</span>
                    <div>
                        <strong>${time}</strong> — ${e.description}
                        ${location}
                        <button class="btn btn-sm btn-danger" onclick="TimelineManager.removeEvent(AppState.currentCase, '${e.id}'); UI.renderCurrentTab();">Eliminar</button>
                    </div>
                </li>`;
            });
            html += '</ul>';
        }
        html += '</div>';
        container.innerHTML = html;
    }
};

window.TimelineManager = TimelineManager;