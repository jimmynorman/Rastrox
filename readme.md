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
