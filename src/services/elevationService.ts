// Types
interface Point {
    lat: number;
    lng: number;
}

interface ElevationData {
    elevation: number;
    lat: number;
    lng: number;
}

export interface TrackStats {
    length: number;        // km
    elevationGain: number; // m
    elevationLoss: number; // m
    minElevation: number; // m
    maxElevation: number; // m
}

export interface ElevationTuningOverrides {
    win?: number;
    k?: number;
    floor?: number;
    cap?: number;
    method?: 'simple' | 'hysteresis';
    spikeShortMeters?: number;
    spikeShortJump?: number;
    spikeSlope?: number;
    spikeSlopeMinJump?: number;
}

export type ElevationSource = 'api' | 'terrainrgb' | 'auto';

// Helpers
const toRad = (degrees: number): number => degrees * (Math.PI / 180);

const haversineDistance = (point1: Point, point2: Point): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Simple elevation API that returns raw elevation data
export const getElevations = async (points: Point[]): Promise<ElevationData[]> => {
    if (!points || points.length === 0) {
        return [];
    }

    try {
        const BATCH_SIZE = 100;
        const allElevations: ElevationData[] = [];
        
        for (let i = 0; i < points.length; i += BATCH_SIZE) {
            const batch = points.slice(i, i + BATCH_SIZE);
            console.log(`[elevationService] Fetching elevations for ${batch.length} points (batch ${Math.floor(i/BATCH_SIZE) + 1})`);
            
            const response = await fetch('https://api.open-elevation.com/api/v1/lookup', {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    locations: batch.map(p => ({ latitude: p.lat, longitude: p.lng }))
                })
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            if (!data.results || !Array.isArray(data.results)) {
                throw new Error('Invalid API response format');
            }
            
            const elevations = data.results.map((result: any, idx: number) => ({
                elevation: result.elevation || 0,
                lat: batch[idx].lat,
                lng: batch[idx].lng
            }));
            
            allElevations.push(...elevations);
            
            // Rate limiting
            if (i + BATCH_SIZE < points.length) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        return allElevations;
    } catch (error) {
        console.error('[elevationService] Error:', error);
        return points.map(p => ({ elevation: 0, lat: p.lat, lng: p.lng }));
    }
};

// Main stats calculation function - uses raw elevation data
export const calculateTrackStats = async (
    points: Point[],
    overrides?: ElevationTuningOverrides,
    sourceOverride: ElevationSource = 'auto'
): Promise<TrackStats> => {
    console.log('[elevationService] Starting ultra-simple calculation');
    
    if (points.length < 2) {
        return {
            length: 0,
            elevationGain: 0,
            elevationLoss: 0,
            minElevation: 0,
            maxElevation: 0
        };
    }
    
    console.log('[elevationService] Starting calculation with', points.length, 'points');

    // Calculate total distance and get raw elevations
    let distance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        distance += haversineDistance(points[i], points[i + 1]);
    }
    
    console.log('[elevationService] Track distance:', distance.toFixed(2), 'km');
    console.log('[elevationService] First point:', points[0]);
    console.log('[elevationService] Last point:', points[points.length - 1]);
    
    // Get elevations without any preprocessing
    console.log('[elevationService] Fetching elevations...');
    const data = await getElevations(points);
    
    if (!data || data.length < 2) {
        console.error('[elevationService] No elevation data received');
        return {
            length: parseFloat(distance.toFixed(2)),
            elevationGain: 0,
            elevationLoss: 0,
            minElevation: 0,
            maxElevation: 0
        };
    }
    
    console.log('[elevationService] Received', data.length, 'elevation points');
    console.log('[elevationService] First elevation:', data[0].elevation);
    console.log('[elevationService] Last elevation:', data[data.length - 1].elevation);

    // Calculate raw stats with noise filtering
    let gain = 0;
    let loss = 0;
    let min = data[0].elevation;
    let max = data[0].elevation;
    let spikesFiltered = 0;
    let noiseFiltered = 0;

    console.log('[elevationService] Processing', data.length, 'elevation points');

    // First pass: calculate median segment distance
    const segmentDistances: number[] = [];
    for (let i = 0; i < data.length - 1; i++) {
        const segMeters = haversineDistance(
            {lat: data[i].lat, lng: data[i].lng},
            {lat: data[i + 1].lat, lng: data[i + 1].lng}
        ) * 1000;
        segmentDistances.push(segMeters);
    }
    const sortedDistances = [...segmentDistances].sort((a, b) => a - b);
    const medianDistance = sortedDistances[Math.floor(sortedDistances.length / 2)];
    
    console.log('[elevationService] Median segment distance:', medianDistance.toFixed(1), 'm');

    // Second pass: calculate elevation changes with adaptive thresholds
    let lastValidElevation = data[0].elevation;
    
    for (let i = 0; i < data.length - 1; i++) {
        const ele1 = data[i].elevation;
        const ele2 = data[i + 1].elevation;
        const diff = ele2 - ele1;
        const segMeters = segmentDistances[i];
        
        // Calculate slope as elevation change per meter
        const slope = Math.abs(diff) / segMeters;

        // Log significant changes
        if (Math.abs(diff) > 20) {
            console.log('[elevationService] Elevation change:', {
                diff: diff.toFixed(1),
                distance: segMeters.toFixed(1),
                slope: (slope * 100).toFixed(1) + '%'
            });
        }

        // Filter out:
        // 1. Obvious spikes (>50m change in <1m)
        // 2. Unrealistic slopes (>100% gradient)
        // 3. Small noise (<2m changes)
        if ((Math.abs(diff) > 50 && segMeters < 1) || 
            (slope > 1.0) || // >100% gradient
            (Math.abs(diff) < 2)) { // small noise
            
            if (Math.abs(diff) > 20) {
                console.log('[elevationService] Filtered change:', {
                    reason: slope > 1.0 ? 'unrealistic slope' : 
                           Math.abs(diff) < 2 ? 'noise' : 'spike',
                    diff: diff.toFixed(1),
                    distance: segMeters.toFixed(1),
                    slope: (slope * 100).toFixed(1) + '%'
                });
            }
            
            if (Math.abs(diff) > 50 && segMeters < 1) spikesFiltered++;
            else noiseFiltered++;
            continue;
        }

        // Sum valid elevation changes
        if (diff > 0) {
            gain += diff;
        } else if (diff < 0) {
            loss += Math.abs(diff);
        }

        // Track min/max
        if (ele1 < min) min = ele1;
        if (ele2 < min) min = ele2;
        if (ele1 > max) max = ele1;
        if (ele2 > max) max = ele2;
    }

    console.log('[elevationService] Calculation complete:');
    console.log('  Distance:', distance.toFixed(2), 'km');
    console.log('  Elevation gain:', gain.toFixed(1), 'm');
    console.log('  Elevation loss:', loss.toFixed(1), 'm');
    console.log('  Changes filtered:', {
        spikes: spikesFiltered,
        noise: noiseFiltered,
        total: spikesFiltered + noiseFiltered
    });
    console.log('  Elevation range:', min.toFixed(1), '-', max.toFixed(1), 'm');
    console.log('  Net elevation:', (max - min).toFixed(1), 'm');

    return {
        length: parseFloat(distance.toFixed(2)),
        elevationGain: Math.round(gain),
        elevationLoss: Math.round(loss),
        minElevation: Math.round(min),
        maxElevation: Math.round(max)
    };
};