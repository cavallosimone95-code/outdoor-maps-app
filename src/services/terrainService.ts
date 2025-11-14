// terrainService.ts
// High-fidelity elevation sampling via Mapbox terrain-rgb (or compatible RGB DEM tiles)
// Formula: elevation (meters) = (R * 256 * 256 + G * 256 + B) / 10 - 10000
// Docs: https://docs.mapbox.com/help/troubleshooting/access-elevation-data/
// Requires env REACT_APP_MAPBOX_TOKEN. If missing, functions will fallback (return null) and caller should degrade to API source.

interface Point { lat: number; lng: number; }
interface ElevationData { elevation: number; lat: number; lng: number; }

// Simple in-memory tile cache (key: z/x/y -> ImageData)
const tileCache: Map<string, ImageData> = new Map();

const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
const TILE_ZOOM = Number(process.env.REACT_APP_TERRAIN_ZOOM || 13); // 12-14 is a decent tradeoff

// Convert lat/lng to XYZ tile coords
function latLngToTile(lat: number, lng: number, z: number) {
  const scale = Math.pow(2, z);
  const x = Math.floor(((lng + 180) / 360) * scale);
  const latRad = lat * Math.PI / 180;
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * scale);
  return { x, y };
}

// Get pixel coordinate inside tile for a lat/lng
function latLngToPixelInTile(lat: number, lng: number, z: number) {
  const scale = Math.pow(2, z) * 256; // 256 px tiles
  const worldX = (lng + 180) / 360 * scale;
  const sinLat = Math.sin(lat * Math.PI / 180);
  const worldY = (0.5 - Math.log((1 + sinLat) / (1 - sinLat)) / (4 * Math.PI)) * scale;
  return { px: worldX % 256, py: worldY % 256 };
}

async function fetchTileImageData(z: number, x: number, y: number): Promise<ImageData | null> {
  const key = `${z}/${x}/${y}`;
  if (tileCache.has(key)) return tileCache.get(key)!;
  if (!MAPBOX_TOKEN) return null;
  const url = `https://api.mapbox.com/v4/mapbox.terrain-rgb/${z}/${x}/${y}.pngraw?access_token=${MAPBOX_TOKEN}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    const blob = await resp.blob();
    const bmp = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width; canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.drawImage(bmp, 0, 0);
    const data = ctx.getImageData(0, 0, bmp.width, bmp.height);
    tileCache.set(key, data);
    return data;
  } catch (err) {
    console.warn('[terrainService] Failed to fetch terrain tile', url, err);
    return null;
  }
}

function decodeElevation(r: number, g: number, b: number): number {
  return (r * 256 * 256 + g * 256 + b) / 10 - 10000;
}

export async function getElevationTerrainRGB(lat: number, lng: number): Promise<number | null> {
  if (!MAPBOX_TOKEN) return null;
  const { x, y } = latLngToTile(lat, lng, TILE_ZOOM);
  const img = await fetchTileImageData(TILE_ZOOM, x, y);
  if (!img) return null;
  const { px, py } = latLngToPixelInTile(lat, lng, TILE_ZOOM);
  const ix = Math.min(255, Math.max(0, Math.round(px)));
  const iy = Math.min(255, Math.max(0, Math.round(py)));
  const idx = (iy * 256 + ix) * 4;
  const r = img.data[idx];
  const g = img.data[idx + 1];
  const b = img.data[idx + 2];
  return decodeElevation(r, g, b);
}

export async function getElevationsTerrainRGB(points: Point[]): Promise<ElevationData[]> {
  if (!MAPBOX_TOKEN || !points.length) return [];
  // Batch sequentially but tiles are cached; keep it simple
  const out: ElevationData[] = [];
  for (const p of points) {
    const elev = await getElevationTerrainRGB(p.lat, p.lng);
    out.push({ elevation: typeof elev === 'number' ? elev : 0, lat: p.lat, lng: p.lng });
  }
  return out;
}

export function hasTerrainRGB(): boolean {
  return !!MAPBOX_TOKEN;
}

// Optional: clear cache (debug)
export function clearTerrainCache() { tileCache.clear(); }
