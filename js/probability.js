// probability.js — Motor de cálculo de scores de búsqueda y confianza (ampliado con zonas seguras y cobertura)

const ProbabilityEngine = {
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
        (caseData.safeZones || []).forEach(z => {
            if (z.type === 'circle' && z.center) allPoints.push(z.center);
            else if (z.type === 'polygon' && z.points) z.points.forEach(p => allPoints.push({ lat: p.lat, lng: p.lng }));
        });

        if (allPoints.length === 0) return [];

        let bbox = Calculations.boundingBox(allPoints);
        if (!bbox) return [];
        bbox = Calculations.expandBoundingBox(bbox, 0.2);

        const gridPoints = Calculations.generateGrid(bbox, 40, 40);

        const lastSighting = this.getLastConfidentSighting(caseData); // Usar última evidencia confiable
        const validSightings = (caseData.sightings || []).filter(s => s.certainty !== 'doubtful');
        const directionVector = this.calculateDirectionVector(caseData);
        const home = caseData.locations.home || null;
        const routes = caseData.habitualRoutes || [];
        const pois = caseData.poi || [];
        const safeZones = caseData.safeZones || [];
        const searchCoverage = caseData.searchCoverage || [];
        const behavior = caseData.animal?.behavior || {};
        const timeElapsedHours = this.getTimeElapsedHours(caseData);
        const extravioTimeline = caseData.extravioTimeline || {};

        const vMin = this.config.velocities.min || 0.5;
        const vMax = this.config.velocities.max || 6.0;
        const rMin = vMin * timeElapsedHours;
        const rMax = vMax * timeElapsedHours;

        const returnCorridor = this.calculateReturnCorridor(caseData);

        const scores = gridPoints.map(cell => {
            let score = 0;
            let totalWeight = 0;
            const reasons = []; // Para futura explicación

            // A. Proximidad al último avistamiento confiable
            if (lastSighting) {
                const d = Calculations.distance(cell.lat, cell.lng, lastSighting.lat, lastSighting.lng);
                const subscore = Math.exp(-d / (this.config.sigma || 0.5));
                const weight = this.config.weights.lastSighting || 30;
                score += subscore * weight;
                totalWeight += weight;
                if (subscore > 0.5) reasons.push('Cerca del último avistamiento confiable');
            }

            // B. Proximidad a otros avistamientos (ponderado por certeza)
            if (validSightings.length > 0) {
                const certaintyWeights = { confirmed: 1, very_likely: 0.8, possible: 0.5, doubtful: 0.2 };
                let sum = 0;
                let count = 0;
                validSightings.forEach(s => {
                    const d = Calculations.distance(cell.lat, cell.lng, s.lat, s.lng);
                    const c = certaintyWeights[s.certainty] || 0.5;
                    // Ajustar por incertidumbre espacial: si tiene radio, decrecer más lentamente
                    const sigma = (s.uncertaintyRadius && s.uncertaintyRadius > 0) 
                        ? Math.max(this.config.sigma, s.uncertaintyRadius / 1000) 
                        : this.config.sigma;
                    sum += c * Math.exp(-d / sigma);
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
                const subscore = alignment <= 45 ? 1 : alignment <= 90 ? 0.5 : 0;
                const weight = this.config.weights.direction || 15;
                score += subscore * weight;
                totalWeight += weight;
            }

            // D. Proximidad al hogar
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

            // J. Afinidad con zonas seguras conocidas (factor nuevo)
            if (safeZones.length > 0) {
                let safeZoneScore = 0;
                let maxSafeZoneScore = 0;
                safeZones.forEach(zone => {
                    let inside = false;
                    let proximityScore = 0;
                    if (zone.type === 'circle' && zone.center && zone.radiusMeters) {
                        const d = Calculations.distance(cell.lat, cell.lng, zone.center.lat, zone.center.lng);
                        const radiusKm = zone.radiusMeters / 1000;
                        if (d <= radiusKm) {
                            inside = true;
                            proximityScore = 1;
                        } else {
                            proximityScore = Math.max(0, 1 - (d - radiusKm) / radiusKm);
                        }
                    } else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
                        inside = Calculations.pointInPolygon(cell.lat, cell.lng, zone.points);
                        if (inside) proximityScore = 1;
                        else {
                            // Distancia aproximada al borde del polígono (usar centroide)
                            const centroid = Calculations.polygonCentroid(zone.points);
                            const d = Calculations.distance(cell.lat, cell.lng, centroid.lat, centroid.lng);
                            proximityScore = Math.max(0, 1 - d / 1); // 1 km de alcance
                        }
                    }
                    if (proximityScore > 0) {
                        const familiarityWeight = { 'Muy bajo': 0.2, 'Bajo': 0.4, 'Medio': 0.6, 'Alto': 0.8, 'Muy alto': 1.0 }[zone.familiarity] || 0.5;
                        const frequencyWeight = { 'Ocasional': 0.3, 'Semanal': 0.5, 'Frecuente': 0.7, 'Diaria': 1.0 }[zone.frequency] || 0.5;
                        const returnFactor = zone.returnAlone === true ? 1 : zone.returnAlone === false ? 0.5 : 0.7;
                        const safeFactor = zone.isSafe === true ? 1 : 0.8;
                        const combined = proximityScore * familiarityWeight * frequencyWeight * returnFactor * safeFactor;
                        if (combined > maxSafeZoneScore) maxSafeZoneScore = combined;
                    }
                });
                if (maxSafeZoneScore > 0) {
                    const weight = this.config.weights.safeZoneAffinity || 18;
                    score += maxSafeZoneScore * weight;
                    totalWeight += weight;
                    if (maxSafeZoneScore > 0.6) reasons.push('Cerca de zona segura conocida');
                }
            }

            // K. Cobertura de búsqueda (penalización ligera si ya fue revisado)
            if (searchCoverage.length > 0) {
                let reviewedScore = 0;
                searchCoverage.forEach(cov => {
                    if (cov.type === 'circle' && cov.center && cov.radiusMeters) {
                        const d = Calculations.distance(cell.lat, cell.lng, cov.center.lat, cov.center.lng);
                        if (d <= cov.radiusMeters / 1000) reviewedScore = 0.3; // 30% de reducción por revisada
                    } else if (cov.type === 'polygon' && cov.points && cov.points.length >= 3) {
                        if (Calculations.pointInPolygon(cell.lat, cell.lng, cov.points)) reviewedScore = 0.3;
                    }
                });
                if (reviewedScore > 0) {
                    score -= reviewedScore * 20; // Restar hasta 6 puntos
                }
            }

            // L. Penalización por barreras (simplificado)
            const barriers = pois.filter(p => ['barrier', 'river', 'canal', 'wall', 'fence', 'dangerous_crossing'].includes(p.category));
            if (barriers.length > 0 && lastSighting) {
                let barrierPenalty = 0;
                barriers.forEach(b => {
                    const dBarrierToCell = Calculations.distance(cell.lat, cell.lng, b.lat, b.lng);
                    const dBarrierToLast = Calculations.distance(lastSighting.lat, lastSighting.lng, b.lat, b.lng);
                    const dCellToLast = Calculations.distance(cell.lat, cell.lng, lastSighting.lat, lastSighting.lng);
                    if (Math.abs(dBarrierToCell + dBarrierToLast - dCellToLast) < 0.1) {
                        barrierPenalty += this.config.weights.barrierPenalty || 20;
                    }
                });
                score -= barrierPenalty;
            }

            if (totalWeight > 0) {
                score = score / totalWeight * 100;
            } else {
                score = 0;
            }

            score = Math.max(0, Math.min(100, score));
            return { lat: cell.lat, lng: cell.lng, score: score, reasons: reasons };
        });

        return scores;
    },

    // Obtener la última evidencia confiable (considera certeza y coherencia)
    getLastConfidentSighting(caseData) {
        if (!caseData || !caseData.sightings || caseData.sightings.length === 0) {
            // Si no hay avistamientos, usar extravioTimeline.lastConfirmed o locations.lost
            return caseData.extravioTimeline?.lastConfirmed || caseData.locations?.lost || null;
        }
        // Filtrar por certeza no dudosa y ordenar por fecha
        const confident = caseData.sightings.filter(s => 
            s.certainty === 'confirmed' || s.certainty === 'very_likely'
        ).sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        if (confident.length > 0) return confident[0];
        // Si no hay confiables, tomar el más reciente no dudoso
        const nonDoubtful = caseData.sightings.filter(s => s.certainty !== 'doubtful')
            .sort((a, b) => new Date(b.datetime) - new Date(a.datetime));
        return nonDoubtful[0] || caseData.sightings[0];
    },

    // Calcular nivel de confianza del análisis (mejorado)
    calculateConfidence(caseData) {
        if (!caseData) return { level: 'low', percentage: 0, reasons: [] };
        const reasons = [];

        // Calidad de avistamientos
        let avgCertainty = 0;
        const certaintyValues = { confirmed: 1, very_likely: 0.8, possible: 0.5, doubtful: 0.2 };
        if (caseData.sightings && caseData.sightings.length > 0) {
            caseData.sightings.forEach(s => {
                avgCertainty += certaintyValues[s.certainty] || 0.5;
            });
            avgCertainty /= caseData.sightings.length;
        } else {
            reasons.push('Sin avistamientos registrados');
        }

        // Coherencia (detección de conflictos)
        let coherence = 1;
        const conflicts = this.detectConflicts(caseData);
        if (conflicts.length > 0) {
            coherence = Math.max(0.2, 1 - conflicts.length * 0.3);
            reasons.push('Se detectaron conflictos de evidencia');
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

        // Precisión temporal y espacial
        let precisionScore = 0.5;
        if (caseData.sightings && caseData.sightings.length > 0) {
            const hasExactTime = caseData.sightings.some(s => {
                const d = new Date(s.datetime);
                return d.getMinutes() !== 0 || d.getSeconds() !== 0;
            });
            const hasHighPrecision = caseData.sightings.some(s => s.precision === 'Exacta' || s.precision === '±50m');
            precisionScore = (hasExactTime ? 0.5 : 0.2) + (hasHighPrecision ? 0.5 : 0.2);
        }
        if (caseData.extravioTimeline?.lastConfirmed) {
            precisionScore += 0.1;
        }

        const percentage = Math.round(
            (0.4 * avgCertainty + 0.3 * coherence + 0.2 * completeness + 0.1 * precisionScore) * 100
        );
        const level = percentage > 70 ? 'high' : percentage > 40 ? 'medium' : 'low';

        return { level, percentage, reasons };
    },

    // Calcular vector de dirección a partir de avistamientos coherentes
    calculateDirectionVector(caseData) {
        if (!caseData.sightings || caseData.sightings.length < 2) return null;
        const valid = caseData.sightings.filter(s => s.certainty !== 'doubtful');
        if (valid.length < 2) return null;
        valid.sort((a, b) => new Date(a.datetime) - new Date(b.datetime));
        const first = valid[0];
        const last = valid[valid.length - 1];
        const timeDiff = (new Date(last.datetime) - new Date(first.datetime)) / 3600000;
        if (timeDiff <= 0) return null;
        const bearing = Calculations.bearing(first.lat, first.lng, last.lat, last.lng);
        const distance = Calculations.distance(first.lat, first.lng, last.lat, last.lng);
        return { bearing, distance, timeDiff, speed: distance / timeDiff };
    },

    getTimeElapsedHours(caseData) {
        const now = new Date();
        let referenceTime;
        // Usar última evidencia confiable o última ubicación confirmada
        const lastConfident = this.getLastConfidentSighting(caseData);
        if (lastConfident && lastConfident.datetime) {
            referenceTime = new Date(lastConfident.datetime);
        } else if (caseData.extravioTimeline?.lastConfirmed?.datetime) {
            referenceTime = new Date(caseData.extravioTimeline.lastConfirmed.datetime);
        } else if (caseData.locations?.lost) {
            referenceTime = new Date(now.getTime() - 60 * 60 * 1000);
        } else {
            return 1;
        }
        const diffHours = (now - referenceTime) / 3600000;
        return Math.max(0, diffHours);
    },

    // Calcular corredor de retorno (considera zonas seguras como destinos)
    calculateReturnCorridor(caseData) {
        const lastPoint = this.getLastConfidentSighting(caseData);
        if (!lastPoint) return null;

        // Destino principal: hogar o la zona segura más familiar
        let destination = caseData.locations?.home;
        let maxFamiliarity = 0;
        if (caseData.safeZones && caseData.safeZones.length > 0) {
            caseData.safeZones.forEach(zone => {
                const fam = { 'Muy bajo': 0.1, 'Bajo': 0.3, 'Medio': 0.5, 'Alto': 0.8, 'Muy alto': 1.0 }[zone.familiarity] || 0.5;
                const freq = { 'Ocasional': 0.3, 'Semanal': 0.5, 'Frecuente': 0.7, 'Diaria': 1.0 }[zone.frequency] || 0.5;
                const score = fam * freq;
                if (score > maxFamiliarity) {
                    maxFamiliarity = score;
                    if (zone.type === 'circle' && zone.center) destination = zone.center;
                    else if (zone.type === 'polygon' && zone.points && zone.points.length >= 3) {
                        destination = Calculations.polygonCentroid(zone.points);
                    }
                }
            });
        }

        if (!destination) return null;
        // Línea recta por ahora (en v0.3 se mejorará con enrutamiento)
        const points = [lastPoint, destination];
        return { points, bufferKm: this.config?.returnBufferKm || 0.2 };
    },

    // Detectar conflictos de evidencia
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