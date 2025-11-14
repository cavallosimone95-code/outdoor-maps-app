export interface GPXPoint {
    lat: number;
    lng: number;
    ele?: number;
    time?: string;
}

export interface GPXTrack {
    name?: string;
    description?: string;
    points: GPXPoint[];
    distance?: number; // in km
    elevationGain?: number; // in meters
}

export interface GPXParseOptions {
    simplify?: boolean; // Enable simplification (default: true)
    tolerance?: number; // Tolerance in meters for simplification (default: 10)
    maxPoints?: number; // Maximum number of points (optional)
}

export const parseGPXFile = (fileContent: string, options: GPXParseOptions = {}): GPXTrack => {
    const { simplify = true, tolerance = 10, maxPoints } = options;
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(fileContent, 'text/xml');
    
    // Check for parsing errors
    const parserError = xmlDoc.querySelector('parsererror');
    if (parserError) {
        throw new Error('Invalid GPX file format');
    }
    
    const points: GPXPoint[] = [];
    
    // Try to get track name and description
    const trackName = xmlDoc.querySelector('trk > name')?.textContent || undefined;
    const trackDesc = xmlDoc.querySelector('trk > desc')?.textContent || undefined;
    
    // Get all track points (trkpt)
    const trkpts = xmlDoc.querySelectorAll('trkpt');
    trkpts.forEach(trkpt => {
        const lat = parseFloat(trkpt.getAttribute('lat') || '0');
        const lng = parseFloat(trkpt.getAttribute('lon') || '0');
        const ele = trkpt.querySelector('ele')?.textContent;
        const time = trkpt.querySelector('time')?.textContent;
        
        points.push({
            lat,
            lng,
            ele: ele ? parseFloat(ele) : undefined,
            time: time || undefined
        });
    });
    
    if (points.length === 0) {
        throw new Error('No track points found in GPX file');
    }
    
    // Simplify the track if requested
    let simplifiedPoints = points;
    if (simplify && points.length > 2) {
        simplifiedPoints = simplifyTrack(points, tolerance);
    }
    
    // Further reduce if maxPoints is specified
    if (maxPoints && simplifiedPoints.length > maxPoints) {
        simplifiedPoints = reduceToMaxPoints(simplifiedPoints, maxPoints);
    }
    
    // Calculate distance on simplified points
    const distance = calculateDistance(simplifiedPoints);
    
    // Calculate elevation gain on simplified points
    const elevationGain = calculateElevationGain(simplifiedPoints);
    
    console.log(`GPX simplified: ${points.length} → ${simplifiedPoints.length} points`);
    
    return {
        name: trackName,
        description: trackDesc,
        points: simplifiedPoints,
        distance,
        elevationGain
    };
};

// Ramer-Douglas-Peucker algorithm for track simplification
const simplifyTrack = (points: GPXPoint[], tolerance: number): GPXPoint[] => {
    if (points.length <= 2) return points;
    
    // Convert tolerance from meters to degrees (approximate)
    const toleranceDegrees = tolerance / 111320; // 1 degree ≈ 111.32 km
    
    return ramerDouglasPeucker(points, toleranceDegrees);
};

const ramerDouglasPeucker = (points: GPXPoint[], epsilon: number): GPXPoint[] => {
    if (points.length <= 2) return points;
    
    // Find the point with maximum distance from the line segment
    let maxDistance = 0;
    let maxIndex = 0;
    const end = points.length - 1;
    
    for (let i = 1; i < end; i++) {
        const distance = perpendicularDistance(points[i], points[0], points[end]);
        if (distance > maxDistance) {
            maxDistance = distance;
            maxIndex = i;
        }
    }
    
    // If max distance is greater than epsilon, recursively simplify
    if (maxDistance > epsilon) {
        const left = ramerDouglasPeucker(points.slice(0, maxIndex + 1), epsilon);
        const right = ramerDouglasPeucker(points.slice(maxIndex), epsilon);
        
        // Combine results (remove duplicate middle point)
        return [...left.slice(0, -1), ...right];
    } else {
        // All points between start and end can be removed
        return [points[0], points[end]];
    }
};

const perpendicularDistance = (point: GPXPoint, lineStart: GPXPoint, lineEnd: GPXPoint): number => {
    const x = point.lat;
    const y = point.lng;
    const x1 = lineStart.lat;
    const y1 = lineStart.lng;
    const x2 = lineEnd.lat;
    const y2 = lineEnd.lng;
    
    const A = x - x1;
    const B = y - y1;
    const C = x2 - x1;
    const D = y2 - y1;
    
    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    
    if (lenSq !== 0) {
        param = dot / lenSq;
    }
    
    let xx, yy;
    
    if (param < 0) {
        xx = x1;
        yy = y1;
    } else if (param > 1) {
        xx = x2;
        yy = y2;
    } else {
        xx = x1 + param * C;
        yy = y1 + param * D;
    }
    
    const dx = x - xx;
    const dy = y - yy;
    
    return Math.sqrt(dx * dx + dy * dy);
};

// Reduce to maximum number of points by sampling
const reduceToMaxPoints = (points: GPXPoint[], maxPoints: number): GPXPoint[] => {
    if (points.length <= maxPoints) return points;
    
    const result: GPXPoint[] = [points[0]]; // Always keep first point
    const step = (points.length - 1) / (maxPoints - 1);
    
    for (let i = 1; i < maxPoints - 1; i++) {
        const index = Math.round(i * step);
        result.push(points[index]);
    }
    
    result.push(points[points.length - 1]); // Always keep last point
    return result;
};

// Haversine formula to calculate distance between two points
const haversineDistance = (point1: GPXPoint, point2: GPXPoint): number => {
    const R = 6371; // Earth's radius in km
    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(toRad(point1.lat)) * Math.cos(toRad(point2.lat)) *
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const toRad = (degrees: number): number => {
    return degrees * (Math.PI / 180);
};

const calculateDistance = (points: GPXPoint[]): number => {
    let totalDistance = 0;
    for (let i = 0; i < points.length - 1; i++) {
        totalDistance += haversineDistance(points[i], points[i + 1]);
    }
    return parseFloat(totalDistance.toFixed(2));
};

const calculateElevationGain = (points: GPXPoint[]): number => {
    let totalGain = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const ele1 = points[i].ele;
        const ele2 = points[i + 1].ele;
        if (ele1 !== undefined && ele2 !== undefined) {
            const gain = ele2 - ele1;
            if (gain > 0) {
                totalGain += gain;
            }
        }
    }
    return Math.round(totalGain);
};
