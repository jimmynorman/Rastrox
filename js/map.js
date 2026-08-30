// map.js — Gestión del mapa Leaflet con pulsación larga, menú contextual, dibujo de áreas

const MapManager = {
    map: null,
    layers: {},
    markers: {},
    polylines: [],
    currentCase: null,
    searchLayerGroup: null,
    zoneLayerGroup: null,
    safeZoneLayerGroup: null,
    coverageLayerGroup: null,
    longPressTimer: null,
    longPressDuration: 650,
    contextMenuVisible: false,
    contextMenuLatLng: null,
    drawingMode: null, // 'route', 'zone_circle', 'zone_polygon'
    drawPoints: [],
    drawCircleCenter: null,
    drawCircleRadius: null,
    tempDrawLayer: null,

    init() {
        this.map = L.map('map', {
            center: [-7.16, -78.49],
            zoom: 14,
            zoomControl: false
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);

        // Grupos de capas
        this.layers = {
            sightings: L.layerGroup().addTo(this.map),
            lastPoint: L.layerGroup().addTo(this.map),
            home: L.layerGroup().addTo(this.map),
            base: L.layerGroup().addTo(this.map),
            routes: L.layerGroup().addTo(this.map),
            returnCorridor: L.layerGroup().addTo(this.map),
            water: L.layerGroup().addTo(this.map),
            food: L.layerGroup().addTo(this.map),
            refuges: L.layerGroup().addTo(this.map),
            barriers: L.layerGroup().addTo(this.map),
            priorityZones: L.layerGroup().addTo(this.map),
            reviewedZones: L.layerGroup().addTo(this.map),
            currentLocation: L.layerGroup().addTo(this.map),
            poi: L.layerGroup().addTo(this.map),
            safeZones: L.layerGroup().addTo(this.map),
            coverage: L.layerGroup().addTo(this.map)
        };

        // Controles
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.map.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.map.zoomOut());
        document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());
        document.getElementById('btn-add').addEventListener('click', (e) => this.toggleContextMenuAtCenter(e));
        document.getElementById('btn-draw-route').addEventListener('click', () => this.startDrawingRoute());
        document.getElementById('btn-draw-zone').addEventListener('click', () => this.showZoneDrawingOptions());
        document.getElementById('btn-layers').addEventListener('click', () => this.toggleLayersPanel());

        // Eventos de pulsación larga
        this.setupLongPress();

        // Evento de clic normal para cerrar menú contextual
        this.map.on('click', (e) => {
            this.hideContextMenu();
            if (this.drawingMode) {
                this.handleDrawClick(e.latlng);
            } else {
                this.onMapClick(e.latlng);
            }
        });

        // Evento de doble clic para cerrar polígono
        this.map.on('dblclick', (e) => {
            if (this.drawingMode === 'zone_polygon' && this.drawPoints.length >= 3) {
                this.finishPolygonZone();
            } else if (this.drawingMode === 'route' && this.drawPoints.length >= 2) {
                this.finishRoute();
            }
        });

        // Cerrar menú contextual al mover el mapa
        this.map.on('dragstart', () => this.hideContextMenu());

        this.tempDrawLayer = L.layerGroup().addTo(this.map);

        console.log('Mapa inicializado con soporte táctil');
    },

    setupLongPress() {
        const mapElement = this.map.getContainer();
        let startX, startY, startTime;
        let longPressTriggered = false;

        mapElement.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                const touch = e.touches[0];
                startX = touch.clientX;
                startY = touch.clientY;
                startTime = Date.now();
                longPressTriggered = false;
                this.longPressTimer = setTimeout(() => {
                    longPressTriggered = true;
                    const latlng = this.map.mouseEventToLatLng({ clientX: startX, clientY: startY });
                    this.showContextMenu(latlng.lat, latlng.lng, startX, startY);
                }, this.longPressDuration);
            }
        }, { passive: true });

        mapElement.addEventListener('touchmove', (e) => {
            if (this.longPressTimer) {
                // Si se mueve más de 10px, cancelar pulsación larga
                const touch = e.touches[0];
                const dx = touch.clientX - startX;
                const dy = touch.clientY - startY;
                if (Math.sqrt(dx*dx + dy*dy) > 10) {
                    clearTimeout(this.longPressTimer);
                    this.longPressTimer = null;
                }
            }
        }, { passive: true });

        mapElement.addEventListener('touchend', (e) => {
            clearTimeout(this.longPressTimer);
            this.longPressTimer = null;
        }, { passive: true });

        // Para escritorio: clic derecho
        mapElement.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = mapElement.getBoundingClientRect();
            const latlng = this.map.mouseEventToLatLng({ clientX: e.clientX, clientY: e.clientY });
            this.showContextMenu(latlng.lat, latlng.lng, e.clientX - rect.left, e.clientY - rect.top);
        });
    },

    showContextMenu(lat, lng, screenX, screenY) {
        this.hideContextMenu();
        this.contextMenuLatLng = { lat, lng };
        const menu = document.getElementById('context-menu');
        menu.classList.remove('hidden');
        // Posicionar dentro del contenedor del mapa
        const mapContainer = document.getElementById('map-container');
        const containerRect = mapContainer.getBoundingClientRect();
        menu.style.left = screenX + 'px';
        menu.style.top = screenY + 'px';
        // Ajustar si se sale del contenedor
        const menuRect = menu.getBoundingClientRect();
        if (screenX + menuRect.width > containerRect.width) {
            menu.style.left = (screenX - menuRect.width) + 'px';
        }
        if (screenY + menuRect.height > containerRect.height) {
            menu.style.top = (screenY - menuRect.height) + 'px';
        }
        this.contextMenuVisible = true;

        // Configurar acciones del menú
        menu.querySelectorAll('.context-item').forEach(item => {
            item.onclick = (e) => {
                const action = item.dataset.action;
                this.handleContextAction(action, lat, lng);
                this.hideContextMenu();
            };
        });
    },

    hideContextMenu() {
        const menu = document.getElementById('context-menu');
        if (menu) {
            menu.classList.add('hidden');
        }
        this.contextMenuVisible = false;
    },

    toggleContextMenuAtCenter(e) {
        const center = this.map.getCenter();
        const point = this.map.latLngToContainerPoint(center);
        this.showContextMenu(center.lat, center.lng, point.x, point.y);
    },

    handleContextAction(action, lat, lng) {
        const caseData = this.currentCase;
        if (!caseData) {
            alert('No hay caso activo');
            return;
        }
        switch (action) {
            case 'lost': UI.showLostForm(lat, lng); break;
            case 'last_confirmed': UI.showLastConfirmedForm(lat, lng); break;
            case 'home': UI.showHomeForm(lat, lng); break;
            case 'base': UI.showBaseForm(lat, lng); break;
            case 'safe_zone_circle': this.startDrawingZoneCircle(lat, lng); break;
            case 'safe_zone_polygon': this.startDrawingZonePolygon(lat, lng); break;
            case 'sighting': UI.showSightingForm(lat, lng); break;
            case 'evidence': UI.showEvidenceForm(lat, lng); break;
            case 'testimony': UI.showTestimonyForm(lat, lng); break;
            case 'water': UI.showPOIForm(lat, lng, 'water'); break;
            case 'food': UI.showPOIForm(lat, lng, 'food'); break;
            case 'refuge': UI.showPOIForm(lat, lng, 'refuge'); break;
            case 'barrier': UI.showPOIForm(lat, lng, 'barrier'); break;
            case 'danger': UI.showPOIForm(lat, lng, 'dangerous_crossing'); break;
            case 'other_poi': UI.showPOIForm(lat, lng, 'other'); break;
            case 'mark_reviewed': SearchMode.markZoneReviewedAt(lat, lng); break;
            case 'new_sighting_quick': UI.showSightingForm(lat, lng); break;
            case 'start_route': this.startDrawingRoute(lat, lng); break;
        }
    },

    startDrawingRoute(startLat, startLng) {
        this.drawingMode = 'route';
        this.drawPoints = [];
        if (startLat && startLng) {
            this.drawPoints.push({ lat: startLat, lng: startLng });
        }
        this.tempDrawLayer.clearLayers();
        alert('Modo dibujo de ruta activado. Toca en el mapa para añadir puntos. Doble clic para finalizar.');
        // Añadir botón de finalizar
        const finishBtn = document.createElement('button');
        finishBtn.textContent = '✓ Finalizar ruta';
        finishBtn.className = 'btn btn-sm btn-success';
        finishBtn.style.position = 'absolute';
        finishBtn.style.bottom = '10px';
        finishBtn.style.right = '10px';
        finishBtn.style.zIndex = '1200';
        finishBtn.onclick = () => this.finishRoute();
        document.getElementById('map-container').appendChild(finishBtn);
        this._finishRouteBtn = finishBtn;
    },

    handleDrawClick(latlng) {
        if (this.drawingMode === 'route') {
            this.drawPoints.push({ lat: latlng.lat, lng: latlng.lng });
            this.redrawTempDraw();
        } else if (this.drawingMode === 'zone_polygon') {
            this.drawPoints.push({ lat: latlng.lat, lng: latlng.lng });
            this.redrawTempDraw();
        } else if (this.drawingMode === 'zone_circle') {
            if (!this.drawCircleCenter) {
                this.drawCircleCenter = { lat: latlng.lat, lng: latlng.lng };
                alert('Centro establecido. Ahora toca un punto para definir el radio.');
            } else {
                const radius = Calculations.distance(this.drawCircleCenter.lat, this.drawCircleCenter.lng, latlng.lat, latlng.lng) * 1000; // metros
                this.finishZoneCircle(radius);
            }
        }
    },

    redrawTempDraw() {
        this.tempDrawLayer.clearLayers();
        if (this.drawPoints.length >= 2) {
            L.polyline(this.drawPoints.map(p => [p.lat, p.lng]), {
                color: '#2c7fb8', weight: 2, dashArray: '5, 5'
            }).addTo(this.tempDrawLayer);
        }
        this.drawPoints.forEach(p => {
            L.circleMarker([p.lat, p.lng], { radius: 5, color: '#2c7fb8' }).addTo(this.tempDrawLayer);
        });
    },

    finishRoute() {
        if (this.drawPoints.length < 2) {
            alert('Necesitas al menos 2 puntos para crear una ruta');
            return;
        }
        const points = [...this.drawPoints];
        this.cleanupDrawingMode();
        UI.showRouteFormFromPoints(points);
    },

    startDrawingZoneCircle(lat, lng) {
        this.drawingMode = 'zone_circle';
        this.drawCircleCenter = { lat, lng };
        this.drawCircleRadius = null;
        this.tempDrawLayer.clearLayers();
        L.circleMarker([lat, lng], { radius: 8, color: '#3366cc' }).addTo(this.tempDrawLayer);
        alert('Centro de zona segura establecido. Ahora toca un punto para definir el radio.');
    },

    finishZoneCircle(radiusMeters) {
        const center = this.drawCircleCenter;
        this.cleanupDrawingMode();
        UI.showSafeZoneForm(center.lat, center.lng, 'circle', null, radiusMeters);
    },

    startDrawingZonePolygon(lat, lng) {
        this.drawingMode = 'zone_polygon';
        this.drawPoints = [{ lat, lng }];
        this.tempDrawLayer.clearLayers();
        L.circleMarker([lat, lng], { radius: 6, color: '#3366cc' }).addTo(this.tempDrawLayer);
        alert('Modo polígono activado. Toca para añadir vértices. Doble clic para cerrar (mínimo 3 puntos).');
        const finishBtn = document.createElement('button');
        finishBtn.textContent = '✓ Cerrar polígono';
        finishBtn.className = 'btn btn-sm btn-success';
        finishBtn.style.position = 'absolute';
        finishBtn.style.bottom = '10px';
        finishBtn.style.right = '10px';
        finishBtn.style.zIndex = '1200';
        finishBtn.onclick = () => this.finishPolygonZone();
        document.getElementById('map-container').appendChild(finishBtn);
        this._finishPolygonBtn = finishBtn;
    },

    finishPolygonZone() {
        if (this.drawPoints.length < 3) {
            alert('Necesitas al menos 3 puntos para cerrar el polígono');
            return;
        }
        const points = [...this.drawPoints];
        this.cleanupDrawingMode();
        UI.showSafeZoneForm(null, null, 'polygon', points, null);
    },

    cleanupDrawingMode() {
        this.drawingMode = null;
        this.drawPoints = [];
        this.drawCircleCenter = null;
        this.drawCircleRadius = null;
        this.tempDrawLayer.clearLayers();
        if (this._finishRouteBtn) {
            this._finishRouteBtn.remove();
            this._finishRouteBtn = null;
        }
        if (this._finishPolygonBtn) {
            this._finishPolygonBtn.remove();
            this._finishPolygonBtn = null;
        }
    },

    setCase(caseData) {
        this.clearAll();
        this.currentCase = caseData;
        if (!caseData) return;

        const centerPoint = caseData.locations?.lost || caseData.locations?.home || { lat: 0, lng: 0 };
        this.map.setView([centerPoint.lat, centerPoint.lng], 14);

        this.drawLocations(caseData);
        this.drawSightings(caseData);
        this.drawRoutes(caseData);
        this.drawPOIs(caseData);
        this.drawSafeZones(caseData);
        this.drawSearchCoverage(caseData);
    },

    clearAll() {
        Object.values(this.layers).forEach(layer => layer.clearLayers());
        this.polylines = [];
        this.markers = {};
    },

    drawLocations(caseData) {
        if (caseData.locations?.home) {
            const marker = L.marker([caseData.locations.home.lat, caseData.locations.home.lng], {
                icon: this.createIcon('home', '#2c7fb8')
            }).bindPopup('🏠 Hogar');
            marker.addTo(this.layers.home);
            this.markers.home = marker;
        }
        if (caseData.locations?.base) {
            const marker = L.marker([caseData.locations.base.lat, caseData.locations.base.lng], {
                icon: this.createIcon('base', '#8e44ad')
            }).bindPopup('📍 Lugar base');
            marker.addTo(this.layers.base);
            this.markers.base = marker;
        }
        // Último punto confirmado (puede ser de extravioTimeline o sightings)
        const lastConfirmed = caseData.extravioTimeline?.lastConfirmed;
        const lastPoint = lastConfirmed || caseData.locations?.lost;
        if (lastPoint) {
            const marker = L.marker([lastPoint.lat, lastPoint.lng], {
                icon: this.createIcon('lost', '#e74c3c')
            }).bindPopup('🔴 Última ubicación confirmada');
            marker.addTo(this.layers.lastPoint);
            this.markers.lastPoint = marker;
        }
    },

    drawSightings(caseData) {
        if (!caseData.sightings || caseData.sightings.length === 0) return;
        const certaintyColors = {
            confirmed: '#e74c3c',
            very_likely: '#ff9900',
            possible: '#ffcc00',
            doubtful: '#999999'
        };
        caseData.sightings.forEach(s => {
            const color = certaintyColors[s.certainty] || '#666';
            const radius = s.uncertaintyRadius && s.uncertaintyRadius > 0 ? s.uncertaintyRadius : 8;
            const marker = L.circle([s.lat, s.lng], {
                radius: radius,
                color: color,
                fillColor: color,
                fillOpacity: 0.3,
                weight: 2
            }).bindPopup(`
                <strong>Avistamiento (${s.certainty})</strong><br>
                Fecha: ${new Date(s.datetime).toLocaleString()}<br>
                ${s.description || ''}
                ${s.uncertaintyRadius > 0 ? `<br>Incertidumbre: ±${s.uncertaintyRadius}m` : ''}
            `);
            marker.addTo(this.layers.sightings);
            // Si la incertidumbre es grande, añadir círculo adicional
            if (s.uncertaintyRadius > 50) {
                L.circle([s.lat, s.lng], {
                    radius: s.uncertaintyRadius,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.1,
                    weight: 0,
                    interactive: false
                }).addTo(this.layers.sightings);
            }
        });
    },

    drawRoutes(caseData) {
        if (!caseData.habitualRoutes) return;
        caseData.habitualRoutes.forEach(route => {
            if (route.points && route.points.length >= 2) {
                const polyline = L.polyline(route.points.map(p => [p.lat, p.lng]), {
                    color: '#2c7fb8',
                    weight: 3,
                    dashArray: '5, 5',
                    opacity: 0.8
                }).bindPopup(`<strong>${route.name}</strong><br>${route.frequency || ''}`);
                polyline.addTo(this.layers.routes);
                this.polylines.push(polyline);
            }
        });
    },

    drawPOIs(caseData) {
        if (!caseData.poi) return;
        const categoryIcons = {
            water: '💧', food: '🍖', park: '🌳', market: '🏪', restaurant: '🍽️',
            known_house: '🏠', empty_land: '🏞️', abandoned: '🏚️', vegetation: '🌿',
            quiet: '🤫', traffic: '🚗', dangerous_crossing: '⚠️', barrier: '🚧',
            river: '🌊', canal: '🏞️', wall: '🧱', fence: '🚧', other_animal: '🐕', refuge: '🛖'
        };
        caseData.poi.forEach(poi => {
            const icon = categoryIcons[poi.category] || '📍';
            const marker = L.marker([poi.lat, poi.lng], {
                icon: this.createIcon(poi.category, '#666')
            }).bindPopup(`<strong>${poi.category}</strong><br>${poi.description || ''}`);
            marker.addTo(this.layers.poi);
            if (poi.category === 'water') marker.addTo(this.layers.water);
            else if (poi.category === 'food') marker.addTo(this.layers.food);
            else if (['refuge', 'vegetation', 'abandoned', 'quiet'].includes(poi.category)) marker.addTo(this.layers.refuges);
            else if (['barrier', 'river', 'canal', 'wall', 'fence', 'dangerous_crossing'].includes(poi.category)) marker.addTo(this.layers.barriers);
        });
    },

    drawSafeZones(caseData) {
        if (!caseData.safeZones) return;
        caseData.safeZones.forEach(zone => {
            if (zone.type === 'circle' && zone.center && zone.radiusMeters) {
                const circle = L.circle([zone.center.lat, zone.center.lng], {
                    radius: zone.radiusMeters,
                    className: 'safe-zone-circle'
                }).bindPopup(`<strong>🛡️ ${zone.name}</strong><br>Familiaridad: ${zone.familiarity || 'Media'}`);
                circle.addTo(this.layers.safeZones);
            } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
                const polygon = L.polygon(zone.points.map(p => [p.lat, p.lng]), {
                    className: 'safe-zone-polygon'
                }).bindPopup(`<strong>🛡️ ${zone.name}</strong><br>Familiaridad: ${zone.familiarity || 'Media'}`);
                polygon.addTo(this.layers.safeZones);
            }
        });
    },

    drawSearchCoverage(caseData) {
        if (!caseData.searchCoverage) return;
        caseData.searchCoverage.forEach(cov => {
            const color = '#66cc66';
            if (cov.type === 'circle' && cov.center && cov.radiusMeters) {
                L.circle([cov.center.lat, cov.center.lng], {
                    radius: cov.radiusMeters,
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.15,
                    weight: 1,
                    className: 'reviewed-area'
                }).bindPopup(`<strong>🔎 Zona revisada</strong><br>${cov.notes || ''}`).addTo(this.layers.coverage);
            } else if (cov.type === 'polygon' && cov.points && cov.points.length >= 3) {
                L.polygon(cov.points.map(p => [p.lat, p.lng]), {
                    color: color,
                    fillColor: color,
                    fillOpacity: 0.15,
                    weight: 1,
                    className: 'reviewed-area'
                }).bindPopup(`<strong>🔎 Zona revisada</strong><br>${cov.notes || ''}`).addTo(this.layers.coverage);
            }
        });
    },

    showPriorityZones(gridScores) {
        this.layers.priorityZones.clearLayers();
        if (!gridScores || gridScores.length === 0) return;
        gridScores.forEach(cell => {
            const score = cell.score;
            let color, radius;
            if (score >= 80) { color = '#ff0000'; radius = 150; }
            else if (score >= 60) { color = '#ff9900'; radius = 120; }
            else if (score >= 40) { color = '#ffff00'; radius = 90; }
            else if (score >= 20) { color = '#00cc00'; radius = 60; }
            else { color = '#cccccc'; radius = 30; }
            const circle = L.circle([cell.lat, cell.lng], {
                radius: radius,
                color: color,
                fillColor: color,
                fillOpacity: 0.2,
                weight: 1,
                interactive: false
            });
            circle.addTo(this.layers.priorityZones);
        });
    },

    drawReturnCorridor(polylinePoints, bufferKm = 0.2) {
        this.layers.returnCorridor.clearLayers();
        if (!polylinePoints || polylinePoints.length < 2) return;
        const line = L.polyline(polylinePoints.map(p => [p.lat, p.lng]), {
            color: '#e67e22',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.8
        });
        line.addTo(this.layers.returnCorridor);
        const sampled = Calculations.samplePolyline(polylinePoints, 0.05);
        sampled.forEach(p => {
            L.circle([p.lat, p.lng], {
                radius: bufferKm * 1000,
                color: '#e67e22',
                fillColor: '#e67e22',
                fillOpacity: 0.08,
                weight: 0,
                interactive: false
            }).addTo(this.layers.returnCorridor);
        });
    },

    showCurrentLocation(lat, lng) {
        this.layers.currentLocation.clearLayers();
        const marker = L.marker([lat, lng], {
            icon: this.createIcon('current', '#2ecc71')
        }).bindPopup('📍 Mi ubicación actual');
        marker.addTo(this.layers.currentLocation);
        this.map.setView([lat, lng], 15);
    },

    locateUser() {
        if (!navigator.geolocation) {
            alert('Geolocalización no soportada');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.showCurrentLocation(pos.coords.latitude, pos.coords.longitude);
                document.dispatchEvent(new CustomEvent('rastro:currentLocation', {
                    detail: { lat: pos.coords.latitude, lng: pos.coords.longitude }
                }));
            },
            (err) => {
                alert('No se pudo obtener tu ubicación: ' + err.message);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    },

    toggleFullscreen() {
        const mapContainer = document.getElementById('map-container');
        if (!document.fullscreenElement) {
            mapContainer.requestFullscreen?.();
        } else {
            document.exitFullscreen?.();
        }
    },

    toggleLayersPanel() {
        const panel = document.getElementById('layers-panel');
        if (panel) {
            panel.classList.toggle('hidden');
        }
    },

    toggleLayer(layerName, visible) {
        if (this.layers[layerName]) {
            if (visible) {
                this.layers[layerName].addTo(this.map);
            } else {
                this.map.removeLayer(this.layers[layerName]);
            }
        }
    },

    createIcon(type, color) {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    },

    onMapClick(latlng) {
        document.dispatchEvent(new CustomEvent('rastro:mapClick', { detail: latlng }));
    },

    getCenter() { return this.map.getCenter(); },
    setView(lat, lng, zoom = 14) { this.map.setView([lat, lng], zoom); },

    // Método para hacer editable un marcador (mover, eliminar)
    makeEditable(marker, onUpdate) {
        marker.on('contextmenu', (e) => {
            // Mostrar opciones de edición
            const action = prompt('¿Qué deseas hacer? (editar / mover / eliminar)', 'editar');
            if (action === 'mover') {
                marker.dragging.enable();
                alert('Arrastra el marcador a la nueva ubicación y haz clic para confirmar.');
                marker.once('dragend', () => {
                    const pos = marker.getLatLng();
                    if (onUpdate) onUpdate(pos.lat, pos.lng);
                    marker.dragging.disable();
                });
            } else if (action === 'eliminar') {
                if (confirm('¿Eliminar este marcador?')) {
                    marker.remove();
                }
            }
        });
    }
};

window.MapManager = MapManager;