// app.js — Inicialización principal y coordinación

const AppState = {
    currentCase: null
};

document.addEventListener('DOMContentLoaded', () => {
    console.log('RASTRO v0.1 iniciando...');

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

    // Cargar caso de demostración o último caso activo
    const cases = Database.getCases();
    if (cases.length > 0) {
        // Cargar el primer caso como activo por defecto
        AppState.currentCase = cases[0];
        document.getElementById('case-indicator').textContent = cases[0].name;
        MapManager.setCase(cases[0]);
        UI.switchTab('dashboard');
        // Recalcular zonas automáticamente
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

    console.log('RASTRO v0.1 listo');
});