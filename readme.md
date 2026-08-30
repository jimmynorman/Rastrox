# RASTROX v0.2 — Sistema de asistencia para búsqueda de perros extraviados

## Descripción

RASTROX es una aplicación web offline-first que ayuda a priorizar zonas de búsqueda de perros extraviados basándose en evidencia ingresada por el usuario (avistamientos, rutas, comportamiento, zonas seguras, etc.). No utiliza GPS ni sensores en el animal; es una herramienta de apoyo a la toma de decisiones.

**Versión actual: v0.2**  
*Principales novedades:*
- Interacción táctil con pulsación larga para añadir elementos directamente desde el mapa.
- Menú contextual con categorías (caso, evidencia, entorno, búsqueda, rutas).
- Eliminación de la necesidad de introducir coordenadas manualmente.
- Cronología del extravío separada (última ubicación confirmada, detección, inicio de búsqueda).
- Zonas seguras conocidas dibujables (círculo o polígono) con atributos de familiaridad y frecuencia.
- Cobertura de búsqueda (áreas revisadas) con penalización ligera en el modelo.
- Configuración descriptiva y comprensible.
- Motor probabilístico mejorado con factor de afinidad a zonas seguras.

## Características principales

- Mapa interactivo con Leaflet y OpenStreetMap (sin API key).
- Registro de caso, animal, avistamientos, rutas habituales, puntos de interés, zonas seguras y evidencias.
- Modelo probabilístico explicable que calcula zonas de prioridad (score 0-100) y nivel de confianza.
- Modo búsqueda con geolocalización y marcado de zonas revisadas.
- Almacenamiento local (localStorage), exportación/importación JSON.
- Diseño responsive, modo claro/oscuro.
- Caso de demostración incluido.

## Instalación y uso

1. Clona o descarga este repositorio.
2. Abre `index.html` en un navegador moderno (Chrome, Firefox, Edge). No se requiere servidor.
3. Para uso en Android, copia la carpeta al dispositivo y abre `index.html` con un navegador, o usa un servidor local (recomendado) y accede vía `http://localhost:puerto`.
4. El mapa necesita conexión a Internet para cargar las teselas de OpenStreetMap. Los datos del caso están disponibles sin conexión.

## Interacción con el mapa

- **Pulsación larga** (aprox. 650 ms en táctil) o **clic derecho** (escritorio) sobre el mapa abre un menú contextual para registrar elementos en ese punto.
- Algunas opciones permiten dibujar áreas (zonas seguras) o rutas directamente.
- Los formularios ya no piden coordenadas; la ubicación se toma del punto seleccionado.

## Estructura de archivos

## 📁 Estructura de archivos

```text
📁 rastro/
├── 📄 index.html
├── 📁 css/
│   └── 📄 styles.css
├── 📁 js/
│   ├── 📄 app.js
│   ├── 📄 map.js
│   ├── 📄 database.js
│   ├── 📄 calculations.js
│   ├── 📄 probability.js
│   ├── 📄 timeline.js
│   ├── 📄 search-mode.js
│   └── 📄 ui.js
├── 📁 data/
│   └── 📄 example-case.json
└── 📄 README.md


También puedes añadir una breve descripción de cada archivo justo debajo o en una tabla, por ejemplo:

| Archivo | Descripción |
|---------|-------------|
| `index.html` | Página principal de la aplicación |
| `css/styles.css` | Estilos y diseño responsive |
| `js/app.js` | Inicialización y coordinación general |
| `js/map.js` | Gestión del mapa, menú contextual, dibujo de áreas |
| `js/database.js` | Persistencia en localStorage y migración de datos |
| `js/calculations.js` | Funciones geométricas y de cálculo |
| `js/probability.js` | Motor de probabilidad y confianza |
| `js/timeline.js` | Cronología del extravío y eventos |
| `js/search-mode.js` | Modo búsqueda y cobertura de zonas revisadas |
| `js/ui.js` | Interfaz de usuario y formularios |
| `data/example-case.json` | Caso de demostración |
| `README.md` | Documentación |


## Documentación del modelo de probabilidad

El motor calcula un **score de búsqueda** (0-100) para cada celda de una cuadrícula sobre el área de interés, basado en factores ponderados:
- Proximidad al último avistamiento confiable.
- Proximidad a otros avistamientos (ponderados por certeza e incertidumbre).
- Dirección de desplazamiento si hay avistamientos coherentes.
- Proximidad al hogar (si el perro tiende a regresar).
- Cercanía a rutas habituales.
- Cercanía a comida/agua (según motivación).
- Cercanía a refugios (si el perro es miedoso).
- Expansión temporal (radio probable según velocidades configuradas).
- Corredor de retorno hacia hogar o zona segura.
- Afinidad con zonas seguras conocidas (nuevo en v0.2).
- Penalización por barreras y por zonas ya revisadas (cobertura de búsqueda).

El **nivel de confianza** es una métrica separada (Alta/Media/Baja) que considera calidad de avistamientos, coherencia, completitud de ficha y precisión espacio-temporal.

Una zona puede tener prioridad alta pero confianza baja; esto se indica claramente.

## Limitaciones conocidas

- Las fotografías se almacenan como texto en localStorage; el espacio es limitado (5-10 MB).
- El cálculo de barreras es simplificado; no se hace enrutamiento real.
- No se incluyen teselas de mapa offline; se requiere conexión para visualizar el mapa.
- La geolocalización puede no funcionar en todos los navegadores en contexto de archivo local.

## Mejoras futuras (v0.3)

- Migrar a IndexedDB para mayor capacidad y fotos.
- Soporte de teselas offline.
- Enrutamiento real para corredores de retorno (usar calles y pasos).
- Integración opcional con IA para análisis de testimonios.
- Sincronización con nube.

## Autor

Prototipo generado según especificación de "PROMPT MAESTRO — PROYECTO RASTRO" y su evolución v0.2.
