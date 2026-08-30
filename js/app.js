// app.js — Inicialización principal y coordinación (v0.2)

const AppState = {
    currentCase: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('RASTROX v0.2 iniciando...');

    // Inicializar módulos
    MapManager.init();
    ProbabilityEngine.init();
    SearchMode.init();
    UI.init();

    // Aplicar tema guardado
    const config = Database.getConfig();
    if (config.theme === 'dark') {
        document.body.classList.add('dark');
    }

    // Migrar todos los casos existentes
    const cases = Database.getCases();
    cases.forEach(c => Database.migrateCaseData(c));
    Database.saveCases(cases);

    // Cargar caso activo (si hay)
    if (cases.length > 0) {
        AppState.currentCase = cases[0];
        document.getElementById('case-indicator').textContent = cases[0].name;
        MapManager.setCase(cases[0]);
        UI.switchTab('dashboard');
        UI.recalculateZones();
    } else {
        // Intentar cargar ejemplo
        Database.loadExampleCase().then(example => {
            if (example) {
                AppState.currentCase = example;
                document.getElementById('case-indicator').textContent = example.name;
                MapManager.setCase(example);
                UI.switchTab('dashboard');
                UI.recalculateZones();
            }
        }).catch(() => {
            console.warn('No se pudo cargar caso de ejemplo');
        });
    }

    // Manejar clic en el mapa para cerrar sidebar en móvil
    document.getElementById('map').addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            document.getElementById('sidebar').classList.add('hidden-mobile');
        }
    });

    console.log('RASTROX v0.2 listo');
});