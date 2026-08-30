# RASTRO v0.1 — Sistema de asistencia para búsqueda de perros extraviados

## Descripción
RASTRO es una aplicación web offline-first que ayuda a priorizar zonas de búsqueda de perros extraviados basándose en evidencia ingresada por el usuario (avistamientos, rutas, comportamiento, etc.). No utiliza GPS ni sensores en el animal; es una herramienta de apoyo a la toma de decisiones.

## Características
- Mapa interactivo (Leaflet + OpenStreetMap).
- Registro de caso, animal, avistamientos, rutas habituales, puntos de interés.
- Modelo probabilístico explicable que calcula zonas de prioridad.
- Modo búsqueda con geolocalización y marcado de zonas revisadas.
- Almacenamiento local (localStorage), exportación/importación JSON.
- Diseño responsive, modo claro/oscuro.
- Caso de demostración incluido.

## Instalación
1. Descarga o clona este repositorio en tu equipo.
2. No se requiere servidor; basta abrir `index.html` en un navegador moderno (Chrome, Firefox, Edge).
3. Para uso en Android, copia la carpeta `rastro` al dispositivo y abre `index.html` con un navegador (recomendado Chrome o Firefox).
4. El mapa requiere conexión a Internet para cargar las teselas de OpenStreetMap. Los datos del caso están disponibles sin conexión.

## Configuración del mapa
Este prototipo utiliza Leaflet con OpenStreetMap, que no requiere API Key. Si deseas usar Google Maps, deberás modificar `js/map.js` para incluir la API de Google Maps y colocar tu clave API en el script de carga.

## Limitaciones conocidas
- Las fotografías se almacenan como texto en localStorage; el espacio es limitado.
- El cálculo de barreras es una aproximación simple.
- El modo offline total no incluye teselas de mapa precargadas.
- La geolocalización puede no funcionar en todos los navegadores en contexto de archivo local.

## Mejoras futuras (v0.2)
- Migrar almacenamiento a IndexedDB para mayor capacidad.
- Soporte para teselas offline (Mobile Atlas Creator).
- Algoritmo de enrutamiento más sofisticado para el corredor de retorno.
- Incorporación de IA para análisis de texto de testigos.
- Sincronización opcional con servicios en la nube.

## Autor
Prototipo generado según especificación de "PROMPT MAESTRO — PROYECTO RASTRO v0.1".