// database.js — Persistencia en localStorage, CRUD de casos, importación/exportación

const Database = {
    STORAGE_PREFIX: 'rastro_',
    CASES_KEY: 'rastro_cases',
    CONFIG_KEY: 'rastro_config',

    // Obtener lista de casos
    getCases() {
        const data = localStorage.getItem(this.CASES_KEY);
        return data ? JSON.parse(data) : [];
    },

    // Guardar lista completa de casos
    saveCases(cases) {
        localStorage.setItem(this.CASES_KEY, JSON.stringify(cases));
    },

    // Obtener un caso por ID
    getCase(caseId) {
        const cases = this.getCases();
        return cases.find(c => c.id === caseId) || null;
    },

    // Crear nuevo caso
    createCase(caseData) {
        const cases = this.getCases();
        const newCase = {
            id: this.generateId(),
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'active',
            ...caseData
        };
        cases.push(newCase);
        this.saveCases(cases);
        return newCase;
    },

    // Actualizar caso existente
    updateCase(caseId, updates) {
        const cases = this.getCases();
        const index = cases.findIndex(c => c.id === caseId);
        if (index === -1) return null;
        cases[index] = {
            ...cases[index],
            ...updates,
            updatedAt: new Date().toISOString()
        };
        this.saveCases(cases);
        return cases[index];
    },

    // Eliminar caso
    deleteCase(caseId) {
        let cases = this.getCases();
        cases = cases.filter(c => c.id !== caseId);
        this.saveCases(cases);
    },

    // Generar ID único simple
    generateId() {
        return 'case_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    },

    // Guardar configuración global
    getConfig() {
        const data = localStorage.getItem(this.CONFIG_KEY);
        return data ? JSON.parse(data) : {
            theme: 'light',
            velocities: {
                min: 0.5,   // km/h
                typical: 2.0,
                max: 6.0
            },
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
                barrierPenalty: 20
            },
            sigma: 0.5, // km para decaimiento exponencial
            sigmaHome: 0.8,
            sigmaRoute: 0.2,
            sigmaPOI: 0.3,
            returnBufferKm: 0.2
        };
    },

    setConfig(config) {
        localStorage.setItem(this.CONFIG_KEY, JSON.stringify(config));
    },

    // Exportar caso a JSON (string)
    exportCase(caseId) {
        const caseData = this.getCase(caseId);
        if (!caseData) return null;
        return JSON.stringify(caseData, null, 2);
    },

    // Importar caso desde JSON string
    importCase(jsonString, overwrite = false) {
        try {
            const imported = JSON.parse(jsonString);
            if (!imported.id || !imported.name || !imported.animal) {
                throw new Error('Formato de caso inválido');
            }
            // Verificar si ya existe un caso con ese ID
            const existing = this.getCase(imported.id);
            if (existing && !overwrite) {
                // Generar nuevo ID para evitar sobrescritura
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

    // Cargar caso de demostración desde data/example-case.json (si existe)
    async loadExampleCase() {
        try {
            const response = await fetch('data/example-case.json');
            if (!response.ok) throw new Error('No se pudo cargar ejemplo');
            const example = await response.json();
            // Verificar si ya existe el ejemplo
            const cases = this.getCases();
            const exists = cases.find(c => c.id === example.id);
            if (!exists) {
                cases.push(example);
                this.saveCases(cases);
            }
            return example;
        } catch (e) {
            console.warn('No se pudo cargar caso de ejemplo:', e);
            // Crear un caso de ejemplo embebido como respaldo
            return this.createDefaultExampleCase();
        }
    },

    // Caso de ejemplo embebido
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
                    sociability: 0.7,
                    fearPeople: 0.2,
                    fearTraffic: 0.4,
                    fearVehicles: 0.5,
                    followPeople: 0.8,
                    followDogs: 0.6,
                    territorial: 0.3,
                    hideTendency: 0.4,
                    foodMotivated: 0.9,
                    waterMotivated: 0.7,
                    returnHome: 0.8,
                    walkingExperience: 0.6,
                    neighborhoodKnowledge: 0.7,
                    activityLevel: 0.6
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
                    frequency: 'Diaria',
                    schedule: '07:00-07:40',
                    days: 'Todos',
                    distance: 1.2,
                    duration: 40,
                    confidence: 0.9,
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
                    id: 's1',
                    datetime: '2026-08-30T08:30:00',
                    lat: -7.1638, lng: -78.5004,
                    reporter: 'Dueño',
                    description: 'Se soltó de la correa en el parque',
                    estimatedDistance: 10,
                    direction: 'N/A',
                    speed: 0,
                    certainty: 'confirmed',
                    photo: '',
                    notes: 'Último punto conocido'
                },
                {
                    id: 's2',
                    datetime: '2026-08-30T09:00:00',
                    lat: -7.1650, lng: -78.4980,
                    reporter: 'Vecino',
                    description: 'Visto corriendo hacia el este',
                    estimatedDistance: 20,
                    direction: 'Este',
                    speed: 5,
                    certainty: 'very_likely',
                    photo: '',
                    notes: 'Corría rápido'
                },
                {
                    id: 's3',
                    datetime: '2026-08-30T09:30:00',
                    lat: -7.1665, lng: -78.4955,
                    reporter: 'Comerciante',
                    description: 'Perro similar buscando comida cerca del mercado',
                    estimatedDistance: 15,
                    direction: 'Sureste',
                    speed: 2,
                    certainty: 'possible',
                    photo: '',
                    notes: 'Parecía hambriento'
                },
                {
                    id: 's4',
                    datetime: '2026-08-30T10:15:00',
                    lat: -7.1620, lng: -78.4975,
                    reporter: 'Transcúnte',
                    description: 'Perro similar descansando bajo un árbol',
                    estimatedDistance: 10,
                    direction: 'N/A',
                    speed: 0,
                    certainty: 'doubtful',
                    photo: '',
                    notes: 'No está seguro del color'
                }
            ],
            poi: [
                { id: 'poi1', category: 'water', lat: -7.1640, lng: -78.5010, description: 'Fuente del parque', photo: '', date: '2026-08-30', importance: 0.9 },
                { id: 'poi2', category: 'food', lat: -7.1655, lng: -78.4970, description: 'Mercado central', photo: '', date: '2026-08-30', importance: 0.8 },
                { id: 'poi3', category: 'refuge', lat: -7.1670, lng: -78.4950, description: 'Terreno baldío con vegetación', photo: '', date: '2026-08-30', importance: 0.7 },
                { id: 'poi4', category: 'barrier', lat: -7.1680, lng: -78.4930, description: 'Río San Lucas (difícil de cruzar)', photo: '', date: '2026-08-30', importance: 0.5 },
                { id: 'poi5', category: 'quiet', lat: -7.1615, lng: -78.4920, description: 'Callejón tranquilo', photo: '', date: '2026-08-30', importance: 0.6 }
            ],
            timeline: [
                { id: 't1', datetime: '2026-08-30T08:30:00', type: 'sighting', description: 'Último punto conocido', lat: -7.1638, lng: -78.5004 },
                { id: 't2', datetime: '2026-08-30T09:00:00', type: 'sighting', description: 'Avistamiento probable hacia el este', lat: -7.1650, lng: -78.4980 },
                { id: 't3', datetime: '2026-08-30T09:30:00', type: 'sighting', description: 'Posible avistamiento cerca del mercado', lat: -7.1665, lng: -78.4955 },
                { id: 't4', datetime: '2026-08-30T10:15:00', type: 'sighting', description: 'Avistamiento dudoso bajo árbol', lat: -7.1620, lng: -78.4975 },
                { id: 't5', datetime: '2026-08-30T11:00:00', type: 'search', description: 'Búsqueda realizada en parque central', lat: -7.1638, lng: -78.5004 }
            ],
            evidence: [],
            searchZones: []
        };
        const cases = this.getCases();
        cases.push(example);
        this.saveCases(cases);
        return example;
    }
};

window.Database = Database;