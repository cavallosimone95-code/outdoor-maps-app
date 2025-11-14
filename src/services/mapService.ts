import axios from 'axios';
import type { FeatureCollection } from 'geojson';
import type { POI } from '../types';

// Use same API detection logic as apiConfig.ts
const getApiBaseUrl = () => {
  // Force production API in production environment
  if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('outdoor-maps-app')) {
    return 'https://singletrack-backend.onrender.com';
  }
  // Use environment variable for local development
  return process.env.REACT_APP_API_BASE || 'http://localhost:5000';
};

const API_BASE = getApiBaseUrl();

export async function fetchMapData(): Promise<FeatureCollection | null> {
  // try remote endpoint, fallback to small embedded sample trails GeoJSON
  try {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/trails`);
      if (!res.ok) throw new Error('no remote trails');
      return await res.json();
    }
  } catch (e) {
    // continue to fallback
  }

  // sample GeoJSON (two short lines with difficulty)
  return {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        properties: { name: 'Ridge Trail', difficulty: 'moderate' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [9.18, 45.46],
            [9.185, 45.465],
            [9.19, 45.47],
          ],
        },
      },
      {
        type: 'Feature',
        properties: { name: 'Steep Descent', difficulty: 'hard' },
        geometry: {
          type: 'LineString',
          coordinates: [
            [9.19, 45.47],
            [9.195, 45.475],
            [9.2, 45.48],
          ],
        },
      },
    ],
  } as FeatureCollection;
}

export async function fetchPOIs(): Promise<POI[]> {
  try {
    if (API_BASE) {
      const res = await fetch(`${API_BASE}/pois`);
      if (!res.ok) throw new Error('no remote pois');
      return await res.json();
    }
  } catch (e) {
    // fallback sample POIs
  }

  return [
    { id: '1', name: 'Ciclofficina Centro', type: 'bikeshop', location: { lat: 45.46, lng: 9.18 }, description: 'Riparazione e vendita' },
    { id: '2', name: 'Bar Da Mario', type: 'restaurant', location: { lat: 45.47, lng: 9.19 }, description: 'Bar e ristorante' },
    { id: '3', name: 'Fontana Piazza', type: 'fountain', location: { lat: 45.465, lng: 9.185 }, description: 'Acqua potabile' },
    { id: '4', name: 'Market Sport', type: 'market', location: { lat: 45.468, lng: 9.192 }, description: 'Attrezzatura outdoor' },
    { id: '5', name: 'Sleep\'n\'ride B&B', type: 'sleepnride', location: { lat: 45.472, lng: 9.195 }, description: 'Alloggio bike-friendly' },
  ] as POI[];
}
