// calculations.js — Funciones geométricas y utilidades matemáticas (ampliado para áreas)

const Calculations = {
    EARTH_RADIUS_KM: 6371,

    toRad(deg) { return deg * Math.PI / 180; },
    toDeg(rad) { return rad * 180 / Math.PI; },

    distance(lat1, lng1, lat2, lng2) {
        const dLat = this.toRad(lat2 - lat1);
        const dLng = this.toRad(lng2 - lng1);
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
                  Math.sin(dLng/2) * Math.sin(dLng/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return this.EARTH_RADIUS_KM * c;
    },

    distanceMeters(lat1, lng1, lat2, lng2) {
        return this.distance(lat1, lng1, lat2, lng2) * 1000;
    },

    bearing(lat1, lng1, lat2, lng2) {
        const dLng = this.toRad(lng2 - lng1);
        const y = Math.sin(dLng) * Math.cos(this.toRad(lat2));
        const x = Math.cos(this.toRad(lat1)) * Math.sin(this.toRad(lat2)) -
                  Math.sin(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) * Math.cos(dLng);
        let brng = this.toDeg(Math.atan2(y, x));
        return (brng + 360) % 360;
    },

    destinationPoint(lat, lng, distanceKm, bearingDeg) {
        const brng = this.toRad(bearingDeg);
        const dR = distanceKm / this.EARTH_RADIUS_KM;
        const lat1 = this.toRad(lat);
        const lng1 = this.toRad(lng);
        const lat2 = Math.asin(Math.sin(lat1) * Math.cos(dR) +
                               Math.cos(lat1) * Math.sin(dR) * Math.cos(brng));
        const lng2 = lng1 + Math.atan2(Math.sin(brng) * Math.sin(dR) * Math.cos(lat1),
                                       Math.cos(dR) - Math.sin(lat1) * Math.sin(lat2));
        return { lat: this.toDeg(lat2), lng: this.toDeg(lng2) };
    },

    boundingBox(points) {
        if (!points || points.length === 0) return null;
        let minLat = Infinity, maxLat = -Infinity;
        let minLng = Infinity, maxLng = -Infinity;
        for (const p of points) {
            if (p.lat < minLat) minLat = p.lat;
            if (p.lat > maxLat) maxLat = p.lat;
            if (p.lng < minLng) minLng = p.lng;
            if (p.lng > maxLng) maxLng = p.lng;
        }
        return { minLat, maxLat, minLng, maxLng };
    },

    expandBoundingBox(bbox, factor) {
        const latSpan = bbox.maxLat - bbox.minLat;
        const lngSpan = bbox.maxLng - bbox.minLng;
        return {
            minLat: bbox.minLat - latSpan * factor,
            maxLat: bbox.maxLat + latSpan * factor,
            minLng: bbox.minLng - lngSpan * factor,
            maxLng: bbox.maxLng + lngSpan * factor
        };
    },

    generateGrid(bbox, cols = 40, rows = 40) {
        const points = [];
        const latStep = (bbox.maxLat - bbox.minLat) / (rows - 1);
        const lngStep = (bbox.maxLng - bbox.minLng) / (cols - 1);
        for (let i = 0; i < rows; i++) {
            for (let j = 0; j < cols; j++) {
                points.push({
                    lat: bbox.minLat + i * latStep,
                    lng: bbox.minLng + j * lngStep
                });
            }
        }
        return points;
    },

    distanceToPolyline(lat, lng, polylinePoints) {
        if (!polylinePoints || polylinePoints.length < 2) return Infinity;
        let minDist = Infinity;
        for (let i = 0; i < polylinePoints.length - 1; i++) {
            const dist = this.distanceToSegment(lat, lng,
                polylinePoints[i].lat, polylinePoints[i].lng,
                polylinePoints[i+1].lat, polylinePoints[i+1].lng);
            if (dist < minDist) minDist = dist;
        }
        return minDist;
    },

    distanceToSegment(lat, lng, lat1, lng1, lat2, lng2) {
        const x = lng * Math.cos(this.toRad(lat));
        const y = lat;
        const x1 = lng1 * Math.cos(this.toRad(lat1));
        const y1 = lat1;
        const x2 = lng2 * Math.cos(this.toRad(lat2));
        const y2 = lat2;
        const dx = x2 - x1;
        const dy = y2 - y1;
        const lengthSq = dx*dx + dy*dy;
        if (lengthSq === 0) {
            return this.distance(lat, lng, lat1, lng1);
        }
        let t = ((x - x1) * dx + (y - y1) * dy) / lengthSq;
        t = Math.max(0, Math.min(1, t));
        const projX = x1 + t * dx;
        const projY = y1 + t * dy;
        const projLat = projY;
        const projLng = projX / Math.cos(this.toRad(projLat));
        return this.distance(lat, lng, projLat, projLng);
    },

    midpoint(lat1, lng1, lat2, lng2) {
        const dLng = this.toRad(lng2 - lng1);
        const lat1r = this.toRad(lat1);
        const lat2r = this.toRad(lat2);
        const lng1r = this.toRad(lng1);
        const Bx = Math.cos(lat2r) * Math.cos(dLng);
        const By = Math.cos(lat2r) * Math.sin(dLng);
        const lat3 = Math.atan2(Math.sin(lat1r) + Math.sin(lat2r),
                                Math.sqrt((Math.cos(lat1r) + Bx) * (Math.cos(lat1r) + Bx) + By * By));
        const lng3 = lng1r + Math.atan2(By, Math.cos(lat1r) + Bx);
        return { lat: this.toDeg(lat3), lng: this.toDeg(lng3) };
    },

    interpolate(lat1, lng1, lat2, lng2, t) {
        return {
            lat: lat1 + (lat2 - lat1) * t,
            lng: lng1 + (lng2 - lng1) * t
        };
    },

    isWithinRadius(lat1, lng1, lat2, lng2, radiusKm) {
        return this.distance(lat1, lng1, lat2, lng2) <= radiusKm;
    },

    samplePolyline(points, sampleDistanceKm = 0.1) {
        if (points.length < 2) return points;
        const sampled = [points[0]];
        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i+1];
            const dist = this.distance(p1.lat, p1.lng, p2.lat, p2.lng);
            const steps = Math.max(1, Math.ceil(dist / sampleDistanceKm));
            for (let s = 1; s <= steps; s++) {
                const t = s / steps;
                sampled.push(this.interpolate(p1.lat, p1.lng, p2.lat, p2.lng, t));
            }
        }
        return sampled;
    },

    // Verificar si un punto está dentro de un polígono (ray casting)
    pointInPolygon(lat, lng, polygonPoints) {
        let inside = false;
        for (let i = 0, j = polygonPoints.length - 1; i < polygonPoints.length; j = i++) {
            const xi = polygonPoints[i].lat, yi = polygonPoints[i].lng;
            const xj = polygonPoints[j].lat, yj = polygonPoints[j].lng;
            const intersect = ((yi > lng) !== (yj > lng)) &&
                (lat < (xj - xi) * (lng - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    },

    // Calcular área de un polígono en km² (aproximada)
    polygonArea(polygonPoints) {
        if (polygonPoints.length < 3) return 0;
        let area = 0;
        for (let i = 0; i < polygonPoints.length; i++) {
            const j = (i + 1) % polygonPoints.length;
            const p1 = polygonPoints[i];
            const p2 = polygonPoints[j];
            area += (p1.lng * Math.cos(this.toRad(p1.lat))) * p2.lat;
            area -= (p2.lng * Math.cos(this.toRad(p2.lat))) * p1.lat;
        }
        area = Math.abs(area) / 2;
        // Convertir a km² aproximados (1 grado ≈ 111 km)
        return area * 111 * 111;
    },

    // Calcular centroide de un polígono
    polygonCentroid(polygonPoints) {
        let latSum = 0, lngSum = 0;
        polygonPoints.forEach(p => { latSum += p.lat; lngSum += p.lng; });
        return { lat: latSum / polygonPoints.length, lng: lngSum / polygonPoints.length };
    }
};

window.Calculations = Calculations;