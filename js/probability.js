// probability.js — Motor de cálculo de scores de búsqueda y confianza

const ProbabilityEngine = {
    // Configuración por defecto (se puede sobrescribir con Database.getConfig())
    config: null,

    init() {
        this.config = Database.getConfig();
    },

    // Calcular scores para todas las celdas de la cuadrícula
    calculateGridScores(caseData) {
        if (!this.config) this.init();
        if (!caseData || !caseData.locations) return [];

        // Recolectar todos los puntos relevantes
        const allPoints = [];
        if (caseData.locations.lost) allPoints.push(caseData.locations.lost);
        if (caseData.locations.home) allPoints.push(caseData.locations.home);
        if (caseData.locations.base) allPoints.push(caseData.locations.base);
        (caseData.sightings || []).forEach(s => allPoints.push({ lat: s.lat, lng: s.lng }));
        (caseData.poi || []).forEach(p => allPoints.push({ lat: p.lat, lng: p.lng }));
        (caseData.habitualRoutes || []).forEach(r => r.points.forEach(p => allPoints.push({ lat: p.lat, lng: p.lng })));

        if (allPoints.length === 0) return [];

        // Calcular bounding box y expandir
        let bbox = Calculations.boundingBox(allPoints);
        if (!bbox) return [];
        bbox = Calculations.expandBoundingBox(bbox, 0.2);

        // Generar cuadrícula (40x40 = 1600 celdas, aceptable)
        const gridPoints = Calculations.generateGrid(bbox, 40, 40);

        // Obtener datos necesarios
        const lastSighting = this.getLastSighting(caseData);
        const validSightings = (caseData.sightings || []).filter(s => s.certainty !== 'doubtful');
        const directionVector = this.calculateDirectionVector(caseData);
        const home = caseData.locations.home || null;
        const routes = caseData.habitualRoutes || [];
        const pois = caseData.poi || [];
        const behavior = caseData.animal?.behavior || {};
        const timeElapsedHours = this.getTimeElapsedHours(caseData);

        // Precalcular velocidades
        const vMin = this.config.velocities.min || 0.5;
        const vMax = this.config.velocities.max || 6.0;
        const rMin = vMin * timeElapsedHours;
        const rMax = vMax * timeElapsedHours;

        // Calcular corredor de retorno
        const returnCorridor = this.calculateReturnCorridor(caseData);

        // Para cada celda, calcular score
        const scores = gridPoints.map(cell => {
            let score = 0;
            let totalWeight = 0;

            // A. Proximidad al último avistamiento
            if (lastSighting) {
                const d = Calculations.distance(cell.lat, cell.lng, lastSighting.lat, lastSighting.lng);
                const subscore = Math.exp(-d / (this.config.sigma || 0.5));
                const weight = this.config.weights.lastSighting || 30;
                score += subscore * weight;
                totalWeight += weight;
            }

            // B. Proximidad a otros avistamientos
            if (validSightings.length > 0) {
                const certaintyWeights = { confirmed: 1, very_likely: 0.8, possible: 0.5, doubtful: 0.2 };
                let sum = 0;
                let count = 0;
                validSightings.forEach(s => {
                    const d = Calculations.distance(cell.lat, cell.lng, s.lat, s.lng);
                    const c = certaintyWeights[s.certainty] || 0.5;
                    sum += c * Math.exp(-d / (this.config.sigma || 0.5));
                    count++;
                });
                if (count > 0) {
                    const subscore = sum / count;
                    const weight = this.config.weights.otherSightings || 20;
                    score += subscore * weight;
                    totalWeight += weight;
                }
            }

            // C. Alineación con dirección de desplazamiento
            if (directionVector && lastSighting) {
                const angleToCell = Calculations.bearing(lastSighting.lat, lastSighting.lng, cell.lat, cell.lng);
                const diff = Math.abs(angleToCell - directionVector.bearing) % 360;
                const alignment = diff > 180 ? 360 - diff : diff;
                // Máximo si está dentro de ±45 grados
                const subscore = alignment <= 45 ? 1 : alignment <= 90 ? 0.5 : 0;
                const weight = this.config.weights.direction || 15;
                score += subscore * weight;
                totalWeight += weight;
            }

            // D. Proximidad al hogar (si el perro tiende a regresar)
            if (home && behavior.returnHome > 0.3) {
                const d = Calculations.distance(cell.lat, cell.lng, home.lat, home.lng);
                const subscore = behavior.returnHome * Math.exp(-d / (this.config.sigmaHome || 0.8));
                const weight = this.config.weights.home || 20;
                score += subscore * weight;
                totalWeight += weight;
            }

            // E. Proximidad a rutas habituales
            if (routes.length > 0) {
                let maxRouteScore = 0;
                routes.forEach(route => {
                    if (route.points && route.points.length >= 2) {
                        const d = Calculations.distanceToPolyline(cell.lat, cell.lng, route.points);
                        const s = Math.exp(-d / (this.config.sigmaRoute || 0.2));
                        if (s > maxRouteScore) maxRouteScore = s;
                    }
                });
                const weight = this.config.weights.routes || 15;
                score += maxRouteScore * weight;
                totalWeight += weight;
            }

            // F. Proximidad a comida/agua
            const relevantFoodWater = pois.filter(p => 
                (p.category === 'food' && behavior.foodMotivated > 0.5) ||
                (p.category === 'water' && behavior.waterMotivated > 0.5)
            );
            if (relevantFoodWater.length > 0) {
                let maxPOIScore = 0;
                relevantFoodWater.forEach(p => {
                    const d = Calculations.distance(cell.lat, cell.lng, p.lat, p.lng);
                    const s = (p.importance || 0.5) * Math.exp(-d / (this.config.sigmaPOI || 0.3));
                    if (s > maxPOIScore) maxPOIScore = s;
                });
                const weight = this.config.weights.foodWater || 10;
                score += maxPOIScore * weight;
                totalWeight += weight;
            }

            // G. Proximidad a refugios (si miedoso)
            const isFearful = behavior.fearPeople > 0.5 || behavior.fearTraffic > 0.5 || behavior.hideTendency > 0.5;
            if (isFearful) {
                const refuges = pois.filter(p => ['refuge', 'vegetation', 'abandoned', 'quiet'].includes(p.category));
                if (refuges.length > 0) {
                    let maxRefugeScore = 0;
                    refuges.forEach(p => {
                        const d = Calculations.distance(cell.lat, cell.lng, p.lat, p.lng);
                        const s = (p.importance || 0.5) * Math.exp(-d / (this.config.sigmaPOI || 0.3));
                        if (s > maxRefugeScore) maxRefugeScore = s;
                    });
                    const weight = this.config.weights.refuges || 15;
                    score += maxRefugeScore * weight;
                    totalWeight += weight;
                }
            }

            // H. Expansión temporal
            if (lastSighting && timeElapsedHours > 0) {
                const d = Calculations.distance(cell.lat, cell.lng, lastSighting.lat, lastSighting.lng);
                let subscore;
                if (d <= rMin) subscore = 1;
                else if (d <= rMax) subscore = 1 - (d - rMin) / (rMax - rMin);
                else subscore = 0;
                const weight = this.config.weights.timeExpansion || 10;
                score += subscore * weight;
                totalWeight += weight;
            }

            // I. Corredor de retorno
            if (returnCorridor && behavior.returnHome > 0.3) {
                const d = Calculations.distanceToPolyline(cell.lat, cell.lng, returnCorridor.points);
                const bufferKm = this.config.returnBufferKm || 0.2;
                const subscore = d <= bufferKm ? 1 : Math.max(0, 1 - (d - bufferKm) / bufferKm);
                const weight = this.config.weights.returnCorridor || 20;
                score += subscore * weight;
                totalWeight += weight;
            }

            // J. Penalización por barreras (aproximación: si la celda está al otro lado de una barrera en relación al último punto)
            const barriers = pois.filter(p => ['barrier', 'river', 'canal', 'wall', 'fence', 'dangerous_crossing'].includes(p.category));
            if (barriers.length > 0 && lastSighting) {
                let barrierPenalty = 0;
                barriers.forEach(b => {
                    // Si la distancia de la celda al último punto cruza la barrera (aproximación: la barrera está entre ambos)
                    const dBarrierToCell = Calculations.distance(cell.lat, cell.lng, b.lat, b.lng);
                    const dBarrierToLast = Calculations.distance(lastSighting.lat, lastSighting.lng, b.lat, b.lng);
                    const dCellToLast = Calculations.distance(cell.lat, cell.lng, lastSighting.lat, lastSighting.lng);
                    // Si la barrera está aproximadamente en el camino
                    if (Math.abs(dBarrierToCell + dBarrierToLast - dCellToLast) < 0.1) {
                        barrierPenalty += this.config.weights.barrierPenalty || 20;
                    }
                });
                score -= barrierPenalty;
                // No sumamos peso negativo, solo restamos
            }

            if (totalWeight > 0) {
                score = score / totalWeight * 100;
            } else {
                score = 0;
            }

            // Clampear a 0-100
            score = Math.max(0, Math.min(100, score));

            return { lat: cell.lat, lng: cell.lng, score: score };
        });

        return scores;
    },

    // Calcular nivel de confianza del análisis
    calculateConfidence(caseData) {
        if (!caseData) return { level: 'low', percentage: 0, reasons: [] };
        const reasons = [];

        // Calidad de avistamientos (promedio de certeza)
        let avgCertainty = 0;
        const certaintyValues = { confirmed: 1, very_likely: 0.8, possible: 0.5, doubtful: 0.2 };
        if (caseData.sightings && caseData.sightings.length > 0) {
            caseData.sightings.forEach(s => {
                avgCertainty += certaintyValues[s.certainty] || 0.5;
            });
            avgCertainty /= caseData.sightings.length;
        } else {
            avgCertainty = 0;
            reasons.push('Sin avistamientos registrados');
        }

        // Coherencia (si hay avistamientos contradictorios)
        let coherence = 1;
        if (caseData.sightings && caseData.sightings.length >= 2) {
            // Detectar conflictos simples: si dos avistamientos están muy lejos en poco tiempo
            for (let i = 0; i < caseData.sightings.length; i++) {
                for (let j = i+1; j < caseData.sightings.length; j++) {
                    const s1 = caseData.sightings[i];
                    const s2 = caseData.sightings[j];
                    const d = Calculations.distance(s1.lat, s1.lng, s2.lat, s2.lng);
                    const timeDiff = Math.abs(new Date(s1.datetime) - new Date(s2.datetime)) / 3600000; // horas
                    if (timeDiff > 0 && d / timeDiff > 20) { // más de 20 km/h entre avistamientos
                        coherence *= 0.5;
                        reasons.push('Posible conflicto: avistamientos distantes en poco tiempo');
                        break;
                    }
                }
                if (coherence < 1) break;
            }
        }

        // Completitud de ficha
        let completeness = 0;
        if (caseData.animal) {
            const fields = ['name', 'breed', 'age', 'sex', 'size', 'color'];
            let filled = 0;
            fields.forEach(f => { if (caseData.animal[f]) filled++; });
            completeness = filled / fields.length;
            if (caseData.animal.behavior) {
                const b = caseData.animal.behavior;
                const bFields = Object.keys(b);
                let bFilled = bFields.filter(k => b[k] !== undefined && b[k] !== null && b[k] !== 0).length;
                completeness = (completeness + (bFilled / bFields.length)) / 2;
            }
        }

        // Precisión temporal (si las horas son exactas, sin minutos en cero)
        let temporalPrecision = 0.5;
        if (caseData.sightings && caseData.sightings.length > 0) {
            const hasExactTime = caseData.sightings.some(s => {
                const d = new Date(s.datetime);
                return d.getMinutes() !== 0 || d.getSeconds() !== 0;
            });
            temporalPrecision = hasExactTime ? 1 : 0.3;
        }

        const percentage = Math.round(
            (0.4 * avgCertainty + 0.3 * coherence + 0.2 * completeness + 0.1 * temporalPrecision) * 100
        );
        const level = percentage > 70 ? 'high' : percentage > 40 ? 'medium' : 'low';

        return { level, percentage, reasons };
    },

    // Obtener último avistamiento (por fecha)
    getLastSighting(caseData) {
        if (!caseData.sightings || caseData.sightings.length === 0) {
            // Si no hay avistamientos, usar lugar de extravío
            return caseData.locations?.lost || null;
        }
        // Ordenar por fecha descendente y tomar el primero con certeza no dudosa preferiblemente
        const sorted = [...caseData.sightings].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        return sorted[0] || null;
    },

    // Calcular vector de dirección a partir de avistamientos coherentes
    calculateDirectionVector(caseData) {
        if (!caseData.sightings || caseData.sightings.length < 2) return null;
        // Filtrar avistamientos con certeza razonable
        const valid = caseData.sightings.filter(s => s.certainty !== 'doubtful');
        if (valid.length < 2) return null;
        // Ordenar cronológicamente
        valid.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        const first = valid[0];
        const last = valid[valid.length - 1];
        // Verificar que el tiempo entre ellos sea positivo
        const timeDiff = (new Date(last.datetime) - new Date(first.datetime)) / 3600000;
        if (timeDiff <= 0) return null;
        const bearing = Calculations.bearing(first.lat, first.lng, last.lat, last.lng);
        const distance = Calculations.distance(first.lat, first.lng, last.lat, last.lng);
        return { bearing, distance, timeDiff, speed: distance / timeDiff };
    },

    // Calcular tiempo transcurrido desde el último avistamiento o pérdida
    getTimeElapsedHours(caseData) {
        const now = new Date();
        let referenceTime;
        if (caseData.sightings && caseData.sightings.length > 0) {
            const sorted = [...caseData.sightings].sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
            referenceTime = new Date(sorted[0].datetime);
        } else if (caseData.locations?.lost) {
            // Si no hay hora de extravío, estimar 1 hora
            referenceTime = new Date(now.getTime() - 60 * 60 * 1000);
        } else {
            return 1;
        }
        const diffHours = (now - referenceTime) / 3600000;
        return Math.max(0, diffHours);
    },

    // Calcular corredor de retorno entre último punto y hogar
    calculateReturnCorridor(caseData) {
        const lastPoint = this.getLastSighting(caseData);
        const home = caseData.locations?.home;
        if (!lastPoint || !home) return null;
        // En v0.1, usamos línea recta con puntos muestreados
        const points = [lastPoint, home];
        // Podríamos agregar desviación si hay barreras, pero simplificamos
        return { points, bufferKm: this.config?.returnBufferKm || 0.2 };
    },

    // Detectar conflictos de evidencia (para mostrar advertencia)
    detectConflicts(caseData) {
        const conflicts = [];
        if (!caseData.sightings || caseData.sightings.length < 2) return conflicts;
        const valid = caseData.sightings.filter(s => s.certainty !== 'doubtful');
        for (let i = 0; i < valid.length; i++) {
            for (let j = i+1; j < valid.length; j++) {
                const s1 = valid[i];
                const s2 = valid[j];
                const d = Calculations.distance(s1.lat, s1.lng, s2.lat, s2.lng);
                const timeDiff = Math.abs(new Date(s1.datetime) - new Date(s2.datetime)) / 3600000;
                if (timeDiff > 0 && d / timeDiff > 20) {
                    conflicts.push({
                        sightingA: s1,
                        sightingB: s2,
                        reason: `Distancia de ${d.toFixed(2)} km en ${timeDiff.toFixed(2)} h implica velocidad de ${(d/timeDiff).toFixed(1)} km/h, poco probable para un perro.`
                    });
                }
            }
        }
        return conflicts;
    }
};

window.ProbabilityEngine = ProbabilityEngine;