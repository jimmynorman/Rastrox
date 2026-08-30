// database.js — Persistencia, CRUD, migración de datos

const Database = {
    STORAGE_PREFIX: 'rastro_',
    CASES_KEY: 'rastro_cases',
    CONFIG_KEY: 'rastro_config',

    getCases() {
        const data = localStorage.getItem(this.CASES_KEY);
        return data ? JSON.parse(data) : [];
    },

    saveCases(cases) {
        localStorage.setItem(this.CASES_KEY, JSON.stringify(cases));
    },

    getCase(caseId) {
        const cases = this.getCases();
        return cases.find(c => c.id === caseId) || null;
    },

    createCase(caseData) {
        const cases = this.getCases();
        const newCase = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            ...caseData
        };
        // Asegurar campos nuevos con valores por defecto
        this.migrateCaseData(newCase);
        cases.push(newCase);
        this.saveCases(cases);
        return newCase;
    },

    updateCase(caseId, updates) {
        const cases = this.getCases();
        const index = cases.findIndex(c => c.id === caseId);
        if (index === -1) return null;
        cases[index] = {
            ...cases[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.migrateCaseData(cases[index]);
        this.saveCases(cases);
        return cases[index];
    },

    deleteCase(caseId) {
        let cases = this.getCases();
        cases = cases.filter(c => c.id !== caseId);
        this.saveCases(cases);
    },

    generateId() {
        return 'case_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Migración de datos para compatibilidad con versiones anteriores
    migrateCaseData(caseData) {
        if (!caseData) return;
        // Añadir campos de cronología del extravío
        if (!caseData.timeline) caseData.timeline = [];
        if (!caseData.extravioTimeline) {
            caseData.extravioTimeline = {
                lastConfirmed: null,  // { datetime, lat, lng, description, precision }
                detection: null,      // { datetime, lat, lng, description }
                searchStart: null     // { datetime }
            };
        }
        // Añadir zonas seguras
        if (!caseData.safeZones) caseData.safeZones = [];
        // Añadir cobertura de búsqueda (áreas revisadas)
        if (!caseData.searchCoverage) caseData.searchCoverage = [];
        // Añadir precision a avistamientos existentes
        if (caseData.sightings) {
            caseData.sightings.forEach(s => {
                if (!s.precision) s.precision = 'exact';
                if (!s.uncertaintyRadius) s.uncertaintyRadius = 0;
            });
        }
        // Añadir tipo a rutas
        if (caseData.habitualRoutes) {
            caseData.habitualRoutes.forEach(r => {
                if (!r.type) r.type = 'Habitual';
                if (!r.observations) r.observations = '';
            });
        }
        return caseData;
    },

    getConfig() {
        const data = localStorage.getItem(this.CONFIG_KEY);
        return data ? JSON.parse(data) : {
            theme: 'light',
            velocities: { min: 0.5, typical: 2.0, max: 6.0 },
            weights: {
                lastSighting: 30,
                otherSightings: 20,
                direction: 15,
                home: 20,
                routes: 15,
                foodWater: 10,
                refuges: 15,
                timeExpansion: 10,
                returnCorridor: 20,
                barrierPenalty: 20,
                safeZoneAffinity: 18,
                searchCoverage: 5
            },
            sigma: 0.5,
            sigmaHome: 0.8,
            sigmaRoute: 0.2,
            sigmaPOI: 0.3,
            returnBufferKm: 0.2
        };
    },

    setConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    },

    exportCase(caseId) {
        const caseData = this.getCase(caseId);
        if (!caseData) return null;
        return JSON.stringify(caseData, null, 2);
    },

    importCase(jsonString, overwrite = false) {
        try {
            const imported = JSON.parse(jsonString);
            if (!imported.id || !imported.name || !imported.animal) {
                throw new Error('Formato de caso inválido');
            }
            this.migrateCaseData(imported);
            const existing = this.getCase(imported.id);
            if (existing && !overwrite) {
                imported.id = this.generateId();
            }
            const cases = this.getCases();
            if (existing && overwrite) {
                const index = cases.findIndex(c => c.id === existing.id);
                cases[index] = imported;
            } else {
                cases.push(imported);
            }
            this.saveCases(cases);
            return imported;
        } catch (e) {
            throw new Error('Error al importar: ' + e.message);
        }
    },

    async loadExampleCase() {
        try {
            const response = await fetch('data/example-case.json');
            if (!response.ok) throw new Error('No se pudo cargar ejemplo');
            const example = await response.json();
            this.migrateCaseData(example);
            const cases = this.getCases();
            const exists = cases.find(c => c.id === example.id);
            if (!exists) {
                cases.push(example);
                this.saveCases(cases);
            }
            return example;
        } catch (e) {
            console.warn('No se pudo cargar caso de ejemplo:', e);
            return this.createDefaultExampleCase();
        }
    },

    createDefaultExampleCase() {
        const example = {
            id: 'case_demo_max',
            name: 'MAX — Cajamarca — 30/08/2026',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            animal: {
                name: 'Max',
                photo: '',
                species: 'Perro',
                breed: 'Mestizo',
                age: '3 años',
                sex: 'Macho',
                size: 'Mediano',
                weight: '15 kg',
                color: 'Marrón con blanco',
                distinctive: 'Collar rojo, mancha blanca en el pecho',
                behavior: {
                    sociability: 0.7, fearPeople: 0.2, fearTraffic: 0.4, fearVehicles: 0.5,
                    followPeople: 0.8, followDogs: 0.6, territorial: 0.3, hideTendency: 0.4,
                    foodMotivated: 0.9, waterMotivated: 0.7, returnHome: 0.8, walkingExperience: 0.6,
                    neighborhoodKnowledge: 0.7, activityLevel: 0.6
                }
            },
            locations: {
                lost: { lat: -7.1638, lng: -78.5004, description: 'Parque central de Cajamarca' },
                home: { lat: -7.1560, lng: -78.4930, description: 'Casa familiar' },
                base: { lat: -7.1560, lng: -78.4930, description: 'Casa familiar' }
            },
            habitualRoutes: [
                {
                    id: 'route_1',
                    name: 'Ruta matutina',
                    type: 'Habitual',
                    frequency: 'Diaria',
                    schedule: '07:00-07:40',
                    days: 'Todos',
                    distance: 1.2,
                    duration: 40,
                    confidence: 0.9,
                    observations: '',
                    points: [
                        { lat: -7.1560, lng: -78.4930 },
                        { lat: -7.1585, lng: -78.4950 },
                        { lat: -7.1602, lng: -78.4975 },
                        { lat: -7.1638, lng: -78.5004 },
                        { lat: -7.1610, lng: -78.4960 },
                        { lat: -7.1560, lng: -78.4930 }
                    ]
                }
            ],
            sightings: [
                {
                    id: 's1', datetime: '2026-08-30T08:30:00',
                    lat: -7.1638, lng: -78.5004,
                    reporter: 'Dueño', description: 'Se soltó de la correa en el parque',
                    estimatedDistance: 10, direction: 'N/A', speed: 0,
                    certainty: 'confirmed', precision: 'exact', uncertaintyRadius: 0,
                    photo: '', notes: 'Último punto conocido'
                },
                {
                    id: 's2', datetime: '2026-08-30T09:00:00',
                    lat: -7.1650, lng: -78.4980,
                    reporter: 'Vecino', description: 'Visto corriendo hacia el este',
                    estimatedDistance: 20, direction: 'Este', speed: 5,
                    certainty: 'very_likely', precision: '±50m', uncertaintyRadius: 50,
                    photo: '', notes: 'Corría rápido'
                },
                {
                    id: 's3', datetime: '2026-08-30T09:30:00',
                    lat: -7.1665, lng: -78.4955,
                    reporter: 'Comerciante', description: 'Perro similar buscando comida cerca del mercado',
                    estimatedDistance: 15, direction: 'Sureste', speed: 2,
                    certainty: 'possible', precision: '±200m', uncertaintyRadius: 200,
                    photo: '', notes: 'Parecía hambriento'
                }
            ],
            poi: [
                { id: 'poi1', category: 'water', lat: -7.1640, lng: -78.5010, description: 'Fuente del parque', photo: '', date: '2026-08-30', importance: 0.9 },
                { id: 'poi2', category: 'food', lat: -7.1655, lng: -78.4970, description: 'Mercado central', photo: '', date: '2026-08-30', importance: 0.8 },
                { id: 'poi3', category: 'refuge', lat: -7.1670, lng: -78.4950, description: 'Terreno baldío con vegetación', photo: '', date: '2026-08-30', importance: 0.7 },
                { id: 'poi4', category: 'barrier', lat: -7.1680, lng: -78.4930, description: 'Río San Lucas (difícil de cruzar)', photo: '', date: '2026-08-30', importance: 0.5 }
            ],
            safeZones: [],
            extravioTimeline: {
                lastConfirmed: { datetime: '2026-08-30T08:30:00', lat: -7.1638, lng: -78.5004, description: 'Última vez visto en el parque', precision: 'Exacta' },
                detection: { datetime: '2026-08-30T09:00:00', lat: -7.1638, lng: -78.5004, description: 'Se detecta que no está' },
                searchStart: { datetime: '2026-08-30T09:30:00' }
            },
            timeline: [
                { id: 't1', datetime: '2026-08-30T08:30:00', type: 'sighting', description: 'Último punto conocido', lat: -7.1638, lng: -78.5004 },
                { id: 't2', datetime: '2026-08-30T09:00:00', type: 'sighting', description: 'Avistamiento probable hacia el este', lat: -7.1650, lng: -78.4980 },
                { id: 't3', datetime: '2026-08-30T09:30:00', type: 'sighting', description: 'Posible avistamiento cerca del mercado', lat: -7.1665, lng: -78.4955 }
            ],
            evidence: [],
            searchZones: [],
            searchCoverage: []
        };
        this.migrateCaseData(example);
        const cases = this.getCases();
        cases.push(example);
        this.saveCases(cases);
        return example;
    }
};

window.Database = Database;