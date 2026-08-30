// timeline.js — Gestión de la cronología del caso

const TimelineManager = {
    // Agregar evento a la cronología
    addEvent(caseData, event) {
        if (!caseData.timeline) caseData.timeline = [];
        const newEvent = {
            id: Database.generateId(),
            ...event
        };
        caseData.timeline.push(newEvent);
        // Ordenar cronológicamente
        caseData.timeline.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        Database.updateCase(caseData.id, { timeline: caseData.timeline });
        return newEvent;
    },

    // Eliminar evento
    removeEvent(caseData, eventId) {
        caseData.timeline = caseData.timeline.filter(e => e.id !== eventId);
        Database.updateCase(caseData.id, { timeline: caseData.timeline });
    },

    // Obtener todos los eventos ordenados
    getEvents(caseData) {
        return (caseData.timeline || []).sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
    },

    // Renderizar línea temporal en HTML
    renderTimeline(caseData, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        const events = this.getEvents(caseData);
        if (events.length === 0) {
            container.innerHTML = '<p>No hay eventos registrados.</p>';
            return;
        }
        let html = '<ul class="timeline-list">';
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
        container.innerHTML = html;
    }
};

window.TimelineManager = TimelineManager;