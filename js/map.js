// map.js — Gestión del mapa Leaflet, capas, marcadores, dibujo

const MapManager = {
    map: null,
    layers: {},
    markers: {},
    polylines: [],
    currentCase: null,
    searchLayerGroup: null,
    zoneLayerGroup: null,

    init() {
        this.map = L.map('map', {
            center: [-7.16, -78.49],
            zoom: 14,
            zoomControl: false
        });

        // Capa base de OpenStreetMap
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
            poi: L.layerGroup().addTo(this.map)
        };

        // Controles personalizados
        document.getElementById('btn-zoom-in').addEventListener('click', () => this.map.zoomIn());
        document.getElementById('btn-zoom-out').addEventListener('click', () => this.map.zoomOut());
        document.getElementById('btn-locate').addEventListener('click', () => this.locateUser());
        document.getElementById('btn-fullscreen').addEventListener('click', () => this.toggleFullscreen());

        // Manejo de clic en el mapa (para capturar coordenadas)
        this.map.on('click', (e) => {
            this.onMapClick(e.latlng);
        });

        console.log('Mapa inicializado');
    },

    // Establecer el caso activo y actualizar el mapa
    setCase(caseData) {
        this.clearAll();
        this.currentCase = caseData;
        if (!caseData) return;

        // Centrar en el último punto conocido o en el hogar
        const centerPoint = caseData.locations?.lost || caseData.locations?.home || { lat: 0, lng: 0 };
        this.map.setView([centerPoint.lat, centerPoint.lng], 14);

        // Dibujar elementos
        this.drawLocations(caseData);
        this.drawSightings(caseData);
        this.drawRoutes(caseData);
        this.drawPOIs(caseData);
        this.drawSearchZones(caseData);
    },

    clearAll() {
        Object.values(this.layers).forEach(layer => layer.clearLayers());
        this.polylines = [];
        this.markers = {};
    },

    drawLocations(caseData) {
        // Hogar
        if (caseData.locations?.home) {
            const marker = L.marker([caseData.locations.home.lat, caseData.locations.home.lng], {
                icon: this.createIcon('home', '#2c7fb8')
            }).bindPopup('🏠 Hogar');
            marker.addTo(this.layers.home);
            this.markers.home = marker;
        }
        // Lugar base
        if (caseData.locations?.base) {
            const marker = L.marker([caseData.locations.base.lat, caseData.locations.base.lng], {
                icon: this.createIcon('base', '#8e44ad')
            }).bindPopup('📍 Lugar base');
            marker.addTo(this.layers.base);
            this.markers.base = marker;
        }
        // Último punto conocido (lugar de extravío o último avistamiento)
        const lastPoint = caseData.locations?.lost || (caseData.sightings && caseData.sightings.length > 0 ? caseData.sightings[caseData.sightings.length - 1] : null);
        if (lastPoint) {
            const marker = L.marker([lastPoint.lat, lastPoint.lng], {
                icon: this.createIcon('lost', '#e74c3c')
            }).bindPopup('🔴 Último punto conocido');
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
            const marker = L.circleMarker([s.lat, s.lng], {
                radius: 8,
                color: color,
                fillColor: color,
                fillOpacity: 0.7,
                weight: 2
            }).bindPopup(`
                <strong>Avistamiento (${s.certainty})</strong><br>
                Fecha: ${new Date(s.datetime).toLocaleString()}<br>
                ${s.description || ''}
            `);
            marker.addTo(this.layers.sightings);
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
            water: '💧',
            food: '🍖',
            park: '🌳',
            market: '🏪',
            restaurant: '🍽️',
            known_house: '🏠',
            empty_land: '🏞️',
            abandoned: '🏚️',
            vegetation: '🌿',
            quiet: '🤫',
            traffic: '🚗',
            dangerous_crossing: '⚠️',
            barrier: '🚧',
            river: '🌊',
            canal: '🏞️',
            wall: '🧱',
            fence: '🚧',
            other_animal: '🐕',
            refuge: '🛖'
        };
        caseData.poi.forEach(poi => {
            const icon = categoryIcons[poi.category] || '📍';
            const marker = L.marker([poi.lat, poi.lng], {
                icon: this.createIcon(poi.category, '#666')
            }).bindPopup(`<strong>${poi.category}</strong><br>${poi.description || ''}`);
            marker.addTo(this.layers.poi);
            // También agregar a capas específicas para filtros
            if (poi.category === 'water') marker.addTo(this.layers.water);
            else if (poi.category === 'food') marker.addTo(this.layers.food);
            else if (['refuge', 'vegetation', 'abandoned', 'quiet'].includes(poi.category)) marker.addTo(this.layers.refuges);
            else if (['barrier', 'river', 'canal', 'wall', 'fence', 'dangerous_crossing'].includes(poi.category)) marker.addTo(this.layers.barriers);
        });
    },

    drawSearchZones(caseData) {
        if (!caseData.searchZones) return;
        caseData.searchZones.forEach(zone => {
            const color = zone.reviewed ? '#2ecc71' : '#e74c3c';
            const marker = L.circle([zone.lat, zone.lng], {
                radius: 30,
                color: color,
                fillColor: color,
                fillOpacity: 0.3
            }).bindPopup(`<strong>Zona ${zone.reviewed ? 'revisada' : 'pendiente'}</strong><br>${zone.notes || ''}`);
            marker.addTo(this.layers.reviewedZones);
        });
    },

    // Mostrar zonas de prioridad (círculos con score)
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
                fillOpacity: 0.25,
                weight: 1,
                interactive: false
            });
            circle.addTo(this.layers.priorityZones);
        });
    },

    // Dibujar corredor de retorno
    drawReturnCorridor(polylinePoints, bufferKm = 0.2) {
        this.layers.returnCorridor.clearLayers();
        if (!polylinePoints || polylinePoints.length < 2) return;
        // Dibujar línea central
        const line = L.polyline(polylinePoints.map(p => [p.lat, p.lng]), {
            color: '#e67e22',
            weight: 3,
            dashArray: '10, 10',
            opacity: 0.8
        });
        line.addTo(this.layers.returnCorridor);
        // Dibujar buffer (círculos alrededor de puntos muestreados)
        const sampled = Calculations.samplePolyline(polylinePoints, 0.05);
        sampled.forEach(p => {
            L.circle([p.lat, p.lng], {
                radius: bufferKm * 1000,
                color: '#e67e22',
                fillColor: '#e67e22',
                fillOpacity: 0.1,
                weight: 0,
                interactive: false
            }).addTo(this.layers.returnCorridor);
        });
    },

    // Mostrar ubicación actual
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
            alert('Geolocalización no soportada en este navegador');
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                this.showCurrentLocation(pos.coords.latitude, pos.coords.longitude);
                // Disparar evento para que otros módulos puedan usar la ubicación
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

    createIcon(type, color) {
        return L.divIcon({
            className: 'custom-div-icon',
            html: `<div style="background-color:${color};width:20px;height:20px;border-radius:50%;border:2px solid white;box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>`,
            iconSize: [24, 24],
            iconAnchor: [12, 12],
            popupAnchor: [0, -12]
        });
    },

    // Manejar clic en el mapa para capturar coordenadas (para formularios)
    onMapClick(latlng) {
        document.dispatchEvent(new CustomEvent('rastro:mapClick', { detail: latlng }));
    },

    // Obtener centro actual del mapa
    getCenter() {
        return this.map.getCenter();
    },

    // Establecer vista
    setView(lat, lng, zoom = 14) {
        this.map.setView([lat, lng], zoom);
    },

    // Activar/desactivar capas según filtros
    setLayerVisibility(layerName, visible) {
        if (this.layers[layerName]) {
            if (visible) {
                this.layers[layerName].addTo(this.map);
            } else {
                this.map.removeLayer(this.layers[layerName]);
            }
        }
    }
};

window.MapManager = MapManager;