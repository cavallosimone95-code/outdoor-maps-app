import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import 'leaflet-routing-machine';
import { fetchMapData, fetchPOIs } from '../services/mapService';
import { getDifficultyColor, getTracks, getAverageRating, getLatestReview, getTrailConditionLabel, SavedTrack, getTourWithTracks, Tour, getCustomPOIs, CustomPOI, toggleTrackDisabled, deleteTrack, togglePOIDisabled, deleteCustomPOI, updateTrackName, updateTrackElevations, saveTracks } from '../services/trackStorage';
import { calculateTrackStats, getElevations } from '../services/elevationService';
import { getCurrentUser, canDevelop } from '../services/authService';
import type { POI as POIType } from '../types';
import useLocation from '../hooks/useLocation';
import '../styles/main.css';

const color: Record<string, string> = { red: '#FF0000', green: '#00FF00', blue: '#0000FF' };

export default function MapView(): JSX.Element {
  const { latitude, longitude } = useLocation();
  const mapEl = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const trailLayerRef = useRef<L.GeoJSON | null>(null);
  const casingLayerRef = useRef<L.GeoJSON | null>(null);
  const poiLayerRef = useRef<any>(null);
  const tourModeRef = useRef<boolean>(false);
  const routingControlRef = useRef<any>(null);
  const deltaRoutingControlRef = useRef<any>(null);
  const createModeRef = useRef<boolean>(false);
  const manualModeStartIndexRef = useRef<number | null>(null); // Track where manual mode started
  const selectPOILocationModeRef = useRef<boolean>(false);
  const tempMarkersRef = useRef<L.Marker[]>([]);
  const tempLineRef = useRef<L.Polyline | null>(null);
  const previewLineRef = useRef<L.Polyline | null>(null);
  const previewMarkersRef = useRef<L.Marker[]>([]);
  const fadedLinesRef = useRef<L.Polyline[]>([]);
  const savedTracksLayerRef = useRef<L.LayerGroup>(new L.LayerGroup());
  const locationMarkerRef = useRef<L.Marker | null>(null);
  const selectedPOICategoryRef = useRef<string>('all');
  const poisVisibleRef = useRef<boolean>(true);
  // Track manual mode transitions and freeze geometry drawn so far when leaving manual mode
  const manualModePrevRef = useRef<boolean>(false);
  const frozenRouteRef = useRef<{ coords: { lat: number; lng: number }[]; untilIndex: number } | null>(null);
  const elevationHoverMarkerRef = useRef<L.Marker | null>(null);
  const currentTourPolylineRef = useRef<L.Polyline | null>(null);
  // Refs for displaying saved tours on the map
  const tourLineRef = useRef<L.Polyline | null>(null);
  const tourMarkersRef = useRef<L.Marker[]>([]);
  const lastCenteredTourIdRef = useRef<string | null>(null);
  const isEditingTourRef = useRef<boolean>(false);

  // --- Helpers for static elevation sparkline in popups ---
  type P = { lat: number; lng: number };
  const toRad = (deg: number) => deg * (Math.PI / 180);
  const haversineKm = (a: P, b: P): number => {
    const R = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const sa = Math.sin(dLat / 2);
    const sb = Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(sa * sa + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sb * sb), Math.sqrt(1 - (sa * sa + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sb * sb)));
    return R * c;
  };

  const resampleByDistance = (src: P[], spacingMeters: number, maxPoints = 200): P[] => {
    if (!src || src.length < 2) return src || [];
    const out: P[] = [src[0]];
    for (let i = 0; i < src.length - 1; i++) {
      const a = src[i];
      const b = src[i + 1];
      const segM = haversineKm(a, b) * 1000;
      if (segM <= spacingMeters) {
        out.push(b);
        continue;
      }
      const steps = Math.max(1, Math.floor(segM / spacingMeters));
      for (let s = 1; s <= steps; s++) {
        const t = s / (steps + 0);
        out.push({ lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t });
      }
    }
    if (out[out.length - 1].lat !== src[src.length - 1].lat || out[out.length - 1].lng !== src[src.length - 1].lng) out.push(src[src.length - 1]);
    // Downsample if needed
    if (out.length > maxPoints) {
      const step = Math.ceil(out.length / maxPoints);
      const down: P[] = [];
      for (let i = 0; i < out.length; i += step) down.push(out[i]);
      if (down[down.length - 1] !== out[out.length - 1]) down.push(out[out.length - 1]);
      return down;
    }
    return out;
  };

  const renderElevationSparkline = async (
    container: HTMLElement,
    track: SavedTrack
  ) => {
    try {
      if (!track.points || track.points.length < 2) {
        container.innerHTML = '<div style="color:#777;font-size:12px;">Profilo non disponibile</div>';
        return;
      }

      // Use cached profile if present
      let profile: { distance: number; elevation: number }[] | undefined = (track as any).elevationProfile;

      if (!profile || !Array.isArray(profile) || profile.length < 2) {
        // Build a light sampling for the chart
        const sampling = resampleByDistance(track.points as P[], 80, 180);
        const elevs = await getElevations(sampling);
        if (!elevs || elevs.length === 0) {
          container.innerHTML = '<div style="color:#777;font-size:12px;">Profilo non disponibile</div>';
          return;
        }
        // Build cumulative distance in km
        const distances: number[] = [0];
        for (let i = 0; i < sampling.length - 1; i++) {
          distances.push(distances[i] + haversineKm(sampling[i], sampling[i + 1]));
        }
        profile = elevs.map((e, i) => ({ distance: distances[i], elevation: Math.round(e.elevation || 0) }));

        // Cache to local storage without triggering a reload
        try {
          const tracks = getTracks();
          const idx = tracks.findIndex(t => t.id === track.id);
          if (idx !== -1) {
            (tracks[idx] as any).elevationProfile = profile;
            saveTracks(tracks);
          }
        } catch {}
      }

      const width = Math.max(240, container.clientWidth || 240);
      const height = 80;
      const padX = 4;
      const padY = 4;

      const minEle = Math.min(...profile.map(p => p.elevation));
      const maxEle = Math.max(...profile.map(p => p.elevation));
      const d0 = profile[0].distance;
      const d1 = profile[profile.length - 1].distance;
      const distSpan = Math.max(0.001, d1 - d0);
      const eleSpan = Math.max(1, maxEle - minEle);

      const sx = (d: number) => padX + ((d - d0) / distSpan) * (width - 2 * padX);
      const sy = (e: number) => padY + (1 - (e - minEle) / eleSpan) * (height - 2 * padY);

      const path = profile.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.distance).toFixed(1)},${sy(p.elevation).toFixed(1)}`).join(' ');

      const area = `M${sx(profile[0].distance).toFixed(1)},${sy(profile[0].elevation).toFixed(1)} ` +
                   profile.slice(1).map(p => `L${sx(p.distance).toFixed(1)},${sy(p.elevation).toFixed(1)}`).join(' ') +
                   ` L${sx(profile[profile.length - 1].distance).toFixed(1)},${(height - padY).toFixed(1)} L${sx(profile[0].distance).toFixed(1)},${(height - padY).toFixed(1)} Z`;

      const svg = `
        <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Profilo altimetrico">
          <defs>
            <linearGradient id="elevGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stop-color="#9fd3ff" stop-opacity="0.8" />
              <stop offset="100%" stop-color="#eaf6ff" stop-opacity="0.2" />
            </linearGradient>
          </defs>
          <rect x="0" y="0" width="${width}" height="${height}" fill="#f8fbff" rx="6" ry="6" />
          <path d="${area}" fill="url(#elevGrad)" stroke="none" />
          <path d="${path}" fill="none" stroke="#2980b9" stroke-width="2" />
        </svg>`;

      container.innerHTML = svg;
    } catch (err) {
      try { container.innerHTML = '<div style="color:#777;font-size:12px;">Profilo non disponibile</div>'; } catch {}
      console.warn('[MapView] Failed to render elevation sparkline', err);
    }
  };

  const defaultCenter = { lat: 45.0, lng: 9.0 };
  const center = typeof latitude === 'number' && typeof longitude === 'number'
    ? { lat: latitude, lng: longitude }
    : defaultCenter;

  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // already initialized

    const PROVIDER = (process.env.REACT_APP_MAP_PROVIDER || 'opentopomap').toLowerCase();
    const TF_KEY = process.env.REACT_APP_THUNDERFOREST_KEY;
    const thunderUrl = TF_KEY ? `https://{s}.tile.thunderforest.com/outdoors/{z}/{x}/{y}.png?apikey=${TF_KEY}` : null;

    let baseOutdoors: L.TileLayer;
    if (PROVIDER === 'komoot') {
      baseOutdoors = thunderUrl
        ? L.tileLayer(thunderUrl, { maxZoom: 17, attribution: '&copy; Thunderforest, OpenStreetMap contributors', subdomains: ['a','b','c'] })
        : L.tileLayer('https://{s}.tile-cyclosm.openstreetmap.fr/cyclosm/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; CyclOSM, OpenStreetMap contributors' });
    } else if (PROVIDER === 'osm') {
      baseOutdoors = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    } else if (PROVIDER === 'stamen') {
      baseOutdoors = L.tileLayer('https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg', { maxZoom: 18, attribution: '&copy; Stamen, OpenStreetMap contributors' });
    } else {
      baseOutdoors = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', { maxZoom: 17, attribution: '&copy; OpenTopoMap contributors' });
    }

    const baseOSM = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' });
    const hillshade = L.tileLayer('https://tiles.wmflabs.org/hillshading/{z}/{x}/{y}.png', { maxZoom: 15, opacity: 0.45, attribution: '&copy; hillshade' });

  const map = L.map(mapEl.current as HTMLDivElement, { center, zoom: 12, layers: [baseOSM] });
    mapRef.current = map;

    const baseLabel = PROVIDER === 'komoot' ? 'Komoot-like (Outdoor)' : 'Outdoors (Topo)';
    const baseLayers = { 'Streets': baseOSM, [baseLabel]: baseOutdoors };
    const overlays = { 'Hillshade': hillshade };
    L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);

    const clusterGroup = (L as any).markerClusterGroup ? (L as any).markerClusterGroup() : new L.LayerGroup();
    clusterGroup.addTo(map);
    poiLayerRef.current = clusterGroup;

    casingLayerRef.current = L.geoJSON(null, { style: () => ({ color: '#111', weight: 8, opacity: 0.35, lineCap: 'round', lineJoin: 'round' }) }).addTo(map);

    trailLayerRef.current = L.geoJSON(null, {
      style: (feature: any) => ({ color: (feature.properties && feature.properties.type && (color as any)[feature.properties.type]) || '#34495e', weight: 2, opacity: 1, dashArray: undefined, lineCap: 'round', lineJoin: 'round' }),
      onEachFeature: (feature, layer) => {
        const name = feature.properties?.name || 'Trail';
        const difficulty = feature.properties?.difficulty || 'unknown';
        layer.bindPopup(`<strong>${name}</strong><div>Difficulty: ${difficulty}</div>`);
      }
    }).addTo(map);

    // Create a dedicated pane for saved tracks to ensure they stay on top
    const paneName = 'savedTracksPane';
    if (!map.getPane(paneName)) {
      map.createPane(paneName);
      const pane = map.getPane(paneName)!;
      pane.style.zIndex = '650';
    }

    // Add saved tracks layer
    savedTracksLayerRef.current.addTo(map);

    const onSelect = (e: any) => {
      const poi: POIType = e.detail;
      if (!poi || !poi.location) return;
      map.setView([poi.location.lat, poi.location.lng], 15, { animate: true });
      (poiLayerRef.current?.eachLayer as any)?.call(poiLayerRef.current, (layer: any) => {
        const latlng = (layer.getLatLng && layer.getLatLng()) || {};
        if (latlng.lat === poi.location.lat && latlng.lng === poi.location.lng) {
          layer.openPopup?.();
        }
      });
    };
    window.addEventListener('poi:select', onSelect as EventListener);

    // Handle map clicks in create, tour, or POI selection mode
    const onMapClick = (e: L.LeafletMouseEvent) => {
      if (!createModeRef.current && !tourModeRef.current && !selectPOILocationModeRef.current) return;
      
      const { lat, lng } = e.latlng;
      
      // Dispatch event to sidebar (sidebar will update points, which triggers mode:change)
      window.dispatchEvent(new CustomEvent('map:click', { detail: { lat, lng } }));
    };
    
    map.on('click', onMapClick);

    // Listen for mode changes
    const onModeChange = (e: any) => {
      const mode = e.detail.mode;
      const points = e.detail.points || [];
      const manualMode = e.detail.manualMode || false;
      createModeRef.current = mode === 'create';
      selectPOILocationModeRef.current = mode === 'select-poi-location';
  const wasTourMode = tourModeRef.current;
  tourModeRef.current = mode === 'tour';
      
      // If entering or leaving tour mode, reload tracks to update their click behavior
      if (wasTourMode !== tourModeRef.current) {
        window.dispatchEvent(new CustomEvent('tour:mode-toggled'));
      }
      
      // Clear temp markers and line when exiting create mode
      if (mode !== 'create') {
        tempMarkersRef.current.forEach(m => m.remove());
        tempMarkersRef.current = [];
        if (tempLineRef.current) {
          tempLineRef.current.remove();
          tempLineRef.current = null;
        }
        // Remove routing control if it exists
        if (routingControlRef.current) {
          try {
            routingControlRef.current.remove();
          } catch {}
          routingControlRef.current = null;
        }
      } else {
        // Create mode: Update markers and routing
        console.log('[MapView] Create mode active, points:', points.length);
        
        // Remove existing markers
        tempMarkersRef.current.forEach(m => m.remove());
        tempMarkersRef.current = [];
        
        // Add markers for current points
        points.forEach((point: any, idx: number) => {
          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
              className: 'temp-marker',
              html: `<div style="background: ${idx === 0 ? '#27ae60' : idx === points.length - 1 && points.length > 1 ? '#e74c3c' : '#3498db'}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            }),
            title: '' // Remove default "Marker" tooltip
          }).addTo(map);
          
          // Add popup with delete option
          const popupContent = `
            <div style="min-width: 120px; text-align: center;">
              <strong>Punto ${idx + 1}</strong>
              <div style="margin-top: 8px;">
                <button 
                  class="remove-waypoint-btn"
                  data-waypoint-index="${idx}"
                  style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
                >
                  🗑️ Rimuovi punto
                </button>
              </div>
            </div>
          `;
          
          const popup = L.popup().setContent(popupContent);
          marker.bindPopup(popup);
          
          // Add click handler after popup opens
          marker.on('popupopen', () => {
            const btn = document.querySelector('.remove-waypoint-btn[data-waypoint-index="' + idx + '"]');
            if (btn) {
              btn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('waypoint:remove', { detail: { index: idx } }));
                marker.closePopup();
              });
            }
          });
          
          tempMarkersRef.current.push(marker);
        });
        
        // Remove existing line and routing
        if (tempLineRef.current) {
          tempLineRef.current.remove();
          tempLineRef.current = null;
        }
        if (routingControlRef.current) {
          try {
            routingControlRef.current.remove();
          } catch {}
          routingControlRef.current = null;
        }
        
        if (points.length >= 2) {
          // Draw simple fallback line first
          const latlngs: [number, number][] = points.map((p: any) => [p.lat, p.lng]);
          tempLineRef.current = L.polyline(latlngs, {
            color: '#27ae60',
            weight: 5,
            opacity: 0.8,
            smoothFactor: 1
          }).addTo(map);
          
          // Try to use routing for a more accurate path following roads/trails
          console.log('[MapView] Attempting routing for create mode with', points.length, 'waypoints');
          try {
            // @ts-ignore - Use OSRM router directly without control
            const router = L.Routing.osrmv1({ 
              serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1',
              profile: 'cycling',
              timeout: 15000,
              useHints: false
            });
            
            // Use router.route() directly instead of creating a control
            const waypoints = points.map((p: any) => L.latLng(p.lat, p.lng));
            // @ts-ignore - route method signature
            router.route(waypoints, (err: any, routes: any) => {
              if (err) {
                console.warn('[MapView] Create mode routing failed, keeping direct line:', err);
                return;
              }
              
              if (!routes || routes.length === 0) {
                console.warn('[MapView] No routes found');
                return;
              }
              
              console.log('[MapView] Create mode routing successful!');
              const route = routes[0];
              const coords = route.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
              console.log('[MapView] Route has', coords.length, 'points');

              // Replace the simple line with the routed line
              if (tempLineRef.current) {
                tempLineRef.current.remove();
              }
              tempLineRef.current = L.polyline(coords.map((c: any) => [c.lat, c.lng]), {
                color: '#27ae60',
                weight: 5,
                opacity: 0.9,
                smoothFactor: 1
              }).addTo(map);
            });
          } catch (err) {
            console.warn('[MapView] Could not create routing for create mode:', err);
            // Fallback line is already drawn
          }
        }
      }

      // Handle tour mode rendering using routing
      if (mode === 'tour') {
        const map = mapRef.current;
        if (!map) return;
        
        console.log('[MapView] Tour mode active, points:', points.length, 'manual:', manualMode);

        // If no points, clear everything and return early
        if (points.length === 0) {
          // Remove all temp markers
          tempMarkersRef.current.forEach(m => m.remove());
          tempMarkersRef.current = [];
          
          // Remove temp line
          if (tempLineRef.current) {
            tempLineRef.current.remove();
            tempLineRef.current = null;
          }
          
          // Remove routing control
          if (routingControlRef.current) {
            try {
              routingControlRef.current.remove();
            } catch {}
            routingControlRef.current = null;
          }
          // Remove delta routing control
          if (deltaRoutingControlRef.current) {
            try {
              deltaRoutingControlRef.current.remove();
            } catch {}
            deltaRoutingControlRef.current = null;
          }
          
          // Reset frozen route state
          frozenRouteRef.current = null;
          manualModeStartIndexRef.current = null;
          
          // Clear stats
          window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: [] } }));
          window.dispatchEvent(new CustomEvent('tour:stats', { detail: {} }));
          window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile: [] } }));
          
          return;
        }

        // Detect manual mode transition to automatic: freeze current geometry so it's not re-routed
        const wasManual = manualModePrevRef.current;
        if (wasManual && !manualMode) {
          // Passaggio da manuale → auto: la geometria è già stata salvata durante il routing
          // Non serve rifare il freeze qui perché potrebbe salvare solo waypoints
          console.log('[MapView] � Passaggio manuale→auto, frozen geometry già presente:', frozenRouteRef.current ? frozenRouteRef.current.coords.length + ' punti' : 'nessuna');
        }
        
        // Detect auto mode transition to manual: geometry already frozen after last routing
        const wasAuto = !manualModePrevRef.current;
        if (wasAuto && manualMode && manualModeStartIndexRef.current === null) {
          // Passaggio da auto → manuale: la geometria routata è già stata salvata
          console.log('[MapView] � Passaggio auto→manuale, frozen geometry disponibile:', frozenRouteRef.current ? frozenRouteRef.current.coords.length + ' punti' : 'nessuna');
        }

        // Track where manual mode starts
        if (manualMode && manualModeStartIndexRef.current === null) {
          // Manual mode just activated - remember current point count
          manualModeStartIndexRef.current = points.length > 0 ? points.length - 1 : 0;
          console.log('[MapView] ✋ Modalità manuale attivata all\'indice:', manualModeStartIndexRef.current);
        } else if (!manualMode && wasManual) {
          // Manual mode deactivated - keep frozen state but reset manual index
          console.log('[MapView] 🔄 Modalità manuale disattivata, mantengo geometria congelata');
          manualModeStartIndexRef.current = null;
        }

        // Remove existing routing control if it exists
        if (routingControlRef.current) {
          try {
            console.log('[MapView] Removing existing routing control');
            routingControlRef.current.remove();
          } catch (e) {
            console.warn('[MapView] Error removing routing control', e);
          }
          routingControlRef.current = null;
        }

        // Clear and redraw temp line
        if (tempLineRef.current) {
          tempLineRef.current.remove();
          tempLineRef.current = null;
        }

        // In modalità manuale: disegna geometria congelata + nuovi punti manuali
        if (manualMode && frozenRouteRef.current && points.length > frozenRouteRef.current.untilIndex + 1) {
          // Combina punti congelati + nuovi punti manuali
          const frozenCoords = frozenRouteRef.current.coords;
          const newManualPoints = points.slice(frozenRouteRef.current.untilIndex + 1);
          const combinedCoords = [...frozenCoords, ...newManualPoints];
          
          const latlngs: [number, number][] = combinedCoords.map((p: any) => [p.lat, p.lng]);
          tempLineRef.current = L.polyline(latlngs, {
            color: '#DC143C',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 6',
            smoothFactor: 1
          }).addTo(map);
          console.log('[MapView] ✋ Modalità manuale: disegnati', frozenCoords.length, 'punti congelati +', newManualPoints.length, 'punti manuali');
          
          // Aggiorna frozen geometry per includere i punti manuali
          frozenRouteRef.current = { coords: combinedCoords, untilIndex: points.length - 1 };
          console.log('[MapView] 💾 Aggiornata frozen con punti manuali, totale:', combinedCoords.length);
          
          // Emit combined geometry
          window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: combinedCoords } }));
          
        } else if (manualMode && frozenRouteRef.current && points.length === frozenRouteRef.current.untilIndex + 1) {
          // Appena passato in manuale, ma non ho ancora aggiunto punti manuali - mostra solo frozen
          const latlngs: [number, number][] = frozenRouteRef.current.coords.map((p: any) => [p.lat, p.lng]);
          tempLineRef.current = L.polyline(latlngs, {
            color: '#DC143C',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 6',
            smoothFactor: 1
          }).addTo(map);
          console.log('[MapView] ✋ Modalità manuale appena attivata - mostro geometria congelata:', frozenRouteRef.current.coords.length, 'punti');
          
          // Emit frozen geometry
          window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: frozenRouteRef.current.coords } }));
          
        } else if (points.length >= 2 && !frozenRouteRef.current) {
          // Disegna linea semplice SOLO se non c'è frozen geometry
          const latlngs: [number, number][] = points.map((p: any) => [p.lat, p.lng]);
          tempLineRef.current = L.polyline(latlngs, {
            color: '#DC143C',
            weight: 5,
            opacity: 0.8,
            dashArray: '10, 6',
            smoothFactor: 1
          }).addTo(map);
          console.log('[MapView] Drew fallback line with', points.length, 'waypoints');
          
          // Emit simple geometry
          window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points } }));
        }

        // Determine split point for mixed routing
        const manualStartIdx = manualModeStartIndexRef.current;
        const hasRoutedSection = manualStartIdx !== null && manualStartIdx > 0;
        const hasManualSection = manualStartIdx !== null && points.length > manualStartIdx;

        console.log('[MapView] Split at index:', manualStartIdx, 'hasRouted:', hasRoutedSection, 'hasManual:', hasManualSection);

        // Handle routing based on manual mode state
        if (points.length >= 2) {
          // If we have a frozen geometry (we just left manual mode previously), keep it and route only the delta
          if (!manualMode && frozenRouteRef.current) {
              const frozen = frozenRouteRef.current;
              // Redraw frozen geometry
              if (tempLineRef.current) {
                tempLineRef.current.remove();
                tempLineRef.current = null;
              }
              tempLineRef.current = L.polyline(frozen.coords.map(c => [c.lat, c.lng]) as any, {
                color: '#DC143C',
                weight: 5,
                opacity: 0.9,
                dashArray: '10, 6',
                smoothFactor: 1
              }).addTo(map);

              // If no new waypoints beyond the frozen index, just emit geometry and skip routing
              if (points.length <= frozen.untilIndex + 1) {
                console.log('[MapView] ✅ Nessun nuovo waypoint oltre frozen.untilIndex:', frozen.untilIndex);
                window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: frozen.coords } }));
              } else {
                // Route only the delta: from LAST frozen coordinate to new waypoints
                // Use the last coordinate of frozen geometry as starting point
                const lastFrozenCoord = frozen.coords[frozen.coords.length - 1];
                const newWaypoints = points.slice(frozen.untilIndex + 1);
                
                console.log('[MapView] 📊 Delta routing info:');
                console.log('  - Total waypoints:', points.length);
                console.log('  - Frozen untilIndex:', frozen.untilIndex);
                console.log('  - Frozen coords:', frozen.coords.length);
                console.log('  - New waypoints (slice from', frozen.untilIndex + 1, '):', newWaypoints.length);
                console.log('  - Last frozen coord:', lastFrozenCoord);
                console.log('  - New waypoints:', newWaypoints);
                
                // Delta waypoints: [last frozen point, ...new points]
                const deltaWaypoints = [
                  L.latLng(lastFrozenCoord.lat, lastFrozenCoord.lng),
                  ...newWaypoints.map((p: any) => L.latLng(p.lat, p.lng))
                ];
                
                console.log('[MapView] 🛣️ Delta routing da ultimo punto frozen verso', newWaypoints.length, 'nuovi waypoints');
                
                // @ts-ignore L.Routing is provided by leaflet-routing-machine
                // Remove any previous delta routing control
                try { deltaRoutingControlRef.current?.remove?.(); } catch {}
                deltaRoutingControlRef.current = null;
                const deltaRouter = L.Routing.control({
                  waypoints: deltaWaypoints,
                  addWaypoints: false,
                  routeWhileDragging: false,
                  show: false,
                  collapsible: true,
                  lineOptions: {
                    addWaypoints: false,
                    extendToWaypoints: true as any,
                    missingRouteTolerance: 200 as any,
                    styles: [{ color: '#DC143C', opacity: 0.9, weight: 5, dashArray: '10,6' }]
                  } as any,
                  router: L.Routing.osrmv1({
                    serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1',
                    profile: 'cycling',
                    timeout: 15000,
                    useHints: false
                  })
                });
                
                // Wrap remove method and internal _clearLines to prevent crashes from null layers
                const originalDeltaRemove = deltaRouter.remove.bind(deltaRouter);
                deltaRouter.remove = function() {
                  try {
                    originalDeltaRemove();
                  } catch (e) {
                    console.warn('[MapView] Delta routing control remove error (ignored):', e);
                  }
                  return this;
                };
                
                // Override internal _clearLines method to handle null layers
                const originalClearLines = (deltaRouter as any)._clearLines?.bind(deltaRouter);
                if (originalClearLines) {
                  (deltaRouter as any)._clearLines = function() {
                    try {
                      originalClearLines();
                    } catch (e) {
                      console.warn('[MapView] Delta routing _clearLines error (ignored):', e);
                    }
                  };
                }
                
                deltaRouter
                  .on('routesfound', async (ev: any) => {
                    try {
                      const route = ev.routes[0];
                      if (!route) return;
                      const deltaCoords = route.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
                      // Combine with frozen, avoiding duplicate at junction
                      const combined = [...frozen.coords, ...deltaCoords.slice(1)];

                      // Redraw combined polyline
                      if (tempLineRef.current) {
                        tempLineRef.current.remove();
                      }
                      tempLineRef.current = L.polyline(combined.map((c: any) => [c.lat, c.lng]) as any, {
                        color: '#DC143C',
                        weight: 5,
                        opacity: 0.9,
                        dashArray: '10, 6',
                        smoothFactor: 1
                      }).addTo(map);

                      // Update frozen state to new end
                      frozenRouteRef.current = { coords: combined, untilIndex: points.length - 1 };

                      // Emit geometry and stats/elevation for combined
                      window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: combined } }));
                      try {
                        const mod = await import('../services/elevationService');
                        const { calculateTrackStats, getElevations } = mod as any;
                        
                        // calculateTrackStats will fetch elevations internally - pass the raw points
                        console.log('[MapView] Calculating stats for combined route with', combined.length, 'points');
                        // Use simple method with minimal smoothing for MTB trails
                        const stats = await calculateTrackStats(combined, {
                          win: 3,           // Minimum smoothing window
                          k: 0.2,           // Very low threshold multiplier
                          floor: 0.3,       // Minimal threshold (0.3m)
                          cap: 2,           // Lower maximum threshold (2m)
                          method: 'simple'  // Use simple method instead of hysteresis
                        });
                        console.log('[MapView] Delta stats result:', stats);
                        window.dispatchEvent(new CustomEvent('tour:stats', { detail: stats }));
                        
                        // Only sample for elevation profile visualization
                        let sampledCoords = combined;
                        if (combined.length > 100) {
                          const step = Math.ceil(combined.length / 100);
                          sampledCoords = combined.filter((_: any, i: number) => i % step === 0);
                          if (sampledCoords[sampledCoords.length - 1] !== combined[combined.length - 1]) {
                            sampledCoords.push(combined[combined.length - 1]);
                          }
                        }
                        const elevationData = await getElevations(sampledCoords);
                        if (elevationData && elevationData.length > 0) {
                          const haversineDistance = (p1: any, p2: any) => {
                            const R = 6371;
                            const dLat = (p2.lat - p1.lat) * Math.PI / 180;
                            const dLng = (p2.lng - p1.lng) * Math.PI / 180;
                            const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                      Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                                      Math.sin(dLng / 2) * Math.sin(dLng / 2);
                            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                            return R * c;
                          };
                          const profile = elevationData.map((ele: any, i: number) => {
                            let distance = 0;
                            for (let j = 1; j <= i; j++) {
                              distance += haversineDistance(sampledCoords[j - 1], sampledCoords[j]);
                            }
                            return { distance, elevation: ele.elevation };
                          });
                          window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile } }));
                        }
                      } catch (err) {
                        console.warn('[MapView] Delta stats failed', err);
                      }
                      // Remove the delta routing control now that we've drawn the combined polyline
                      try { (deltaRouter as any).remove?.(); } catch {}
                      deltaRoutingControlRef.current = null;
                    } catch (err) {
                      console.warn('[MapView] Delta routing handler error', err);
                    }
                  })
                  .on('routingerror', (ev: any) => {
                    console.warn('[MapView] Delta routing failed:', ev.error?.message || ev);
                    try { (deltaRouter as any).remove?.(); } catch {}
                    deltaRoutingControlRef.current = null;
                  })
                  .addTo(map);
                // Track the delta routing control so we can remove it on clear
                deltaRoutingControlRef.current = deltaRouter;
          }
            // Skip full auto routing when using frozen geometry
          } else if ((!manualMode || !hasRoutedSection) && !frozenRouteRef.current) {
            // Full automatic routing (only if no frozen geometry exists)
            console.log('[MapView] Attempting full automatic routing with', points.length, 'waypoints');
            try {
              // @ts-ignore L.Routing is provided by leaflet-routing-machine
              const control = L.Routing.control({
                waypoints: points.map((p: any) => L.latLng(p.lat, p.lng)),
                addWaypoints: false,
                routeWhileDragging: false,
                show: false,
                collapsible: true,
                lineOptions: {
                  addWaypoints: false,
                  extendToWaypoints: true as any,
                  missingRouteTolerance: 200 as any,
                  styles: [{ color: '#DC143C', opacity: 0.9, weight: 5, dashArray: '10,6' }]
                } as any,
                router: L.Routing.osrmv1({ 
                  serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1',
                  profile: 'cycling',
                  timeout: 15000,
                  useHints: false
                })
              });
              
              // Wrap remove method and internal _clearLines to prevent crashes from null layers
              const originalRemove = control.remove.bind(control);
              control.remove = function() {
                try {
                  originalRemove();
                } catch (e) {
                  console.warn('[MapView] Routing control remove error (ignored):', e);
                }
                return this;
              };
              
              // Override internal _clearLines method to handle null layers
              const originalClearLines = (control as any)._clearLines?.bind(control);
              if (originalClearLines) {
                (control as any)._clearLines = function() {
                  try {
                    originalClearLines();
                  } catch (e) {
                    console.warn('[MapView] Routing _clearLines error (ignored):', e);
                  }
                };
              }
              
              routingControlRef.current = control
                .on('routesfound', async (ev: any) => {
                  console.log('[MapView] Full routing successful!');
                  const route = ev.routes[0];
                  if (!route) return;
                  
                  const coords = route.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
                  console.log('[MapView] Route has', coords.length, 'points');

                  if (tempLineRef.current) {
                    tempLineRef.current.remove();
                  }
                  tempLineRef.current = L.polyline(coords.map((c: any) => [c.lat, c.lng]), {
                    color: '#DC143C',
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '10, 6',
                    smoothFactor: 1
                  }).addTo(map);

                  // Save routed geometry as frozen (will be used if switching to manual mode)
                  if (!manualMode) {
                    frozenRouteRef.current = { coords, untilIndex: points.length - 1 };
                    console.log('[MapView] 💾 Salvata geometria routata:', coords.length, 'punti, waypoints:', points.length);
                  }

                  window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: coords } }));

                  try {
                    const mod = await import('../services/elevationService');
                    const { calculateTrackStats, getElevations } = mod as any;
                    
                    // calculateTrackStats will fetch elevations internally
                    console.log('[MapView] Calculating stats for routed track with', coords.length, 'points');
                    const stats = await calculateTrackStats(coords, {
                      win: 3, k: 0.8, floor: 0.5, cap: 3
                    });
                    console.log('[MapView] Routed stats:', stats);
                    window.dispatchEvent(new CustomEvent('tour:stats', { detail: stats }));
                    
                    // Only sample for elevation profile visualization
                    let sampledCoords = coords;
                    if (coords.length > 100) {
                      const step = Math.ceil(coords.length / 100);
                      sampledCoords = coords.filter((_: any, i: number) => i % step === 0);
                      if (sampledCoords[sampledCoords.length - 1] !== coords[coords.length - 1]) {
                        sampledCoords.push(coords[coords.length - 1]);
                      }
                    }
                    
                    // Calculate elevation profile
                    const elevationData = await getElevations(sampledCoords);
                    if (elevationData && elevationData.length > 0) {
                      // Calculate cumulative distance
                      const haversineDistance = (p1: any, p2: any) => {
                        const R = 6371; // Earth's radius in km
                        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
                        const dLng = (p2.lng - p1.lng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                                Math.sin(dLng / 2) * Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        return R * c;
                      };
                      
                      const profile = elevationData.map((ele: any, i: number) => {
                        let distance = 0;
                        for (let j = 1; j <= i; j++) {
                          distance += haversineDistance(sampledCoords[j - 1], sampledCoords[j]);
                        }
                        return { distance, elevation: ele.elevation };
                      });
                      
                      window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile } }));
                    }
                  } catch (err) {
                    console.warn('[MapView] Stats failed', err);
                  }
                })
                .on('routingerror', (ev: any) => {
                  console.warn('[MapView] Routing failed:', ev.error?.message || ev);
                })
                .addTo(map);
            } catch (err) {
              console.warn('[MapView] Could not create routing control:', err);
            }
          } else if (hasRoutedSection && hasManualSection) {
            // Mixed mode: route first part, manual for the rest
            const routedPoints = points.slice(0, manualStartIdx + 1);
            const manualPoints = points.slice(manualStartIdx);
            
            console.log('[MapView] Mixed routing: routed=', routedPoints.length, 'manual=', manualPoints.length);

            // Create routing for the automatic section
            try {
              // @ts-ignore
              routingControlRef.current = L.Routing.control({
                waypoints: routedPoints.map((p: any) => L.latLng(p.lat, p.lng)),
                addWaypoints: false,
                routeWhileDragging: false,
                show: false,
                collapsible: true,
                lineOptions: {
                  addWaypoints: false,
                  extendToWaypoints: true as any,
                  missingRouteTolerance: 200 as any,
                  styles: [{ color: '#DC143C', opacity: 0.9, weight: 5, dashArray: '10,6' }]
                } as any,
                router: L.Routing.osrmv1({
                  serviceUrl: 'https://routing.openstreetmap.de/routed-bike/route/v1',
                  profile: 'cycling',
                  timeout: 15000,
                  useHints: false
                })
              })
                .on('routesfound', async (ev: any) => {
                  console.log('[MapView] Routed section successful!');
                  const route = ev.routes[0];
                  if (!route) return;
                  
                  const routedCoords = route.coordinates.map((c: any) => ({ lat: c.lat, lng: c.lng }));
                  
                  // Combine geometries for export and stats
                  const allCoords = [...routedCoords, ...manualPoints.slice(1)]; // avoid duplicate at junction

                  // Replace any existing lines with a single combined polyline for easier freezing/appending
                  if (tempLineRef.current) {
                    try { tempLineRef.current.remove(); } catch {}
                    tempLineRef.current = null;
                  }
                  const combinedLine = L.polyline(allCoords.map((c: any) => [c.lat, c.lng]) as any, {
                    color: '#DC143C',
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '10, 6',
                    smoothFactor: 1
                  }).addTo(map);
                  tempLineRef.current = combinedLine;
                  window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: allCoords } }));

                  try {
                    const mod = await import('../services/elevationService');
                    const { calculateTrackStats, getElevations } = mod as any;
                    
                    // calculateTrackStats will fetch elevations internally
                    console.log('[MapView] Calculating stats for mixed route with', allCoords.length, 'points');
                    const stats = await calculateTrackStats(allCoords, {
                      win: 3, k: 0.8, floor: 0.5, cap: 3
                    });
                    console.log('[MapView] Mixed stats:', stats);
                    window.dispatchEvent(new CustomEvent('tour:stats', { detail: stats }));
                    
                    // Only sample for elevation profile visualization
                    let sampledCoords = allCoords;
                    if (allCoords.length > 100) {
                      const step = Math.ceil(allCoords.length / 100);
                      sampledCoords = allCoords.filter((_: any, i: number) => i % step === 0);
                      if (sampledCoords[sampledCoords.length - 1] !== allCoords[allCoords.length - 1]) {
                        sampledCoords.push(allCoords[allCoords.length - 1]);
                      }
                    }
                    
                    // Calculate elevation profile
                    const elevationData = await getElevations(sampledCoords);
                    if (elevationData && elevationData.length > 0) {
                      // Calculate cumulative distance
                      const haversineDistance = (p1: any, p2: any) => {
                        const R = 6371; // Earth's radius in km
                        const dLat = (p2.lat - p1.lat) * Math.PI / 180;
                        const dLng = (p2.lng - p1.lng) * Math.PI / 180;
                        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                                Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) *
                                Math.sin(dLng / 2) * Math.sin(dLng / 2);
                        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                        return R * c;
                      };
                      
                      const profile = elevationData.map((ele: any, i: number) => {
                        let distance = 0;
                        for (let j = 1; j <= i; j++) {
                          distance += haversineDistance(sampledCoords[j - 1], sampledCoords[j]);
                        }
                        return { distance, elevation: ele.elevation };
                      });
                      
                      window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile } }));
                    }
                  } catch (err) {
                    console.warn('[MapView] Stats failed', err);
                  }
                })
                .on('routingerror', (ev: any) => {
                  console.warn('[MapView] Routing failed:', ev.error?.message || ev);
                  // Draw manual section anyway (combined with routedPoints as direct line)
                  const fallbackCoords = [...routedPoints, ...manualPoints.slice(1)];
                  if (tempLineRef.current) {
                    try { tempLineRef.current.remove(); } catch {}
                    tempLineRef.current = null;
                  }
                  tempLineRef.current = L.polyline(fallbackCoords.map((p: any) => [p.lat, p.lng]) as any, {
                    color: '#DC143C',
                    weight: 5,
                    opacity: 0.9,
                    dashArray: '10, 6',
                    smoothFactor: 1
                  }).addTo(map);
                })
                .addTo(map);
            } catch (err) {
              console.warn('[MapView] Could not create mixed routing:', err);
            }
          }
        }

        // Add colored markers for waypoints
        tempMarkersRef.current.forEach(m => m.remove());
        tempMarkersRef.current = [];
        points.forEach((point: any, idx: number) => {
          const marker = L.marker([point.lat, point.lng], {
            icon: L.divIcon({
              className: 'temp-marker',
              html: `<div style="background: ${idx === 0 ? '#27ae60' : idx === points.length - 1 && points.length > 1 ? '#e74c3c' : '#3498db'}; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
              iconSize: [16, 16],
              iconAnchor: [8, 8]
            })
          }).addTo(map);
          
          // Add popup with delete option for tour waypoints
          const popupContent = `
            <div style="min-width: 120px; text-align: center;">
              <strong>Waypoint ${idx + 1}</strong>
              <div style="margin-top: 8px;">
                <button 
                  class="remove-waypoint-btn"
                  data-waypoint-index="${idx}"
                  style="background: #e74c3c; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; width: 100%;"
                >
                  🗑️ Rimuovi waypoint
                </button>
              </div>
            </div>
          `;
          
          const popup = L.popup().setContent(popupContent);
          marker.bindPopup(popup);
          
          // Add click handler after popup opens
          marker.on('popupopen', () => {
            const btn = document.querySelector('.remove-waypoint-btn[data-waypoint-index="' + idx + '"]');
            if (btn) {
              btn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('waypoint:remove', { detail: { index: idx } }));
                marker.closePopup();
              });
            }
          });
          
          tempMarkersRef.current.push(marker);
        });
      } else {
        // If leaving tour mode, remove routing control and reset manual mode index
        if (routingControlRef.current) {
          try {
            routingControlRef.current.remove();
          } catch {}
          routingControlRef.current = null;
        }
        manualModeStartIndexRef.current = null;
        manualModePrevRef.current = false;
        frozenRouteRef.current = null;
      }
      // Update previous manual state for next cycle
      manualModePrevRef.current = manualMode;
    };
    window.addEventListener('mode:change', onModeChange as EventListener);

    // Listen for segment preview updates
    const onSegmentPreview = (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      
      const { allPoints, startIndex, endIndex } = e.detail;
      
      // Clear existing markers and lines
      tempMarkersRef.current.forEach(m => m.remove());
      tempMarkersRef.current = [];
      if (tempLineRef.current) {
        tempLineRef.current.remove();
      }
      fadedLinesRef.current.forEach(l => l.remove());
      fadedLinesRef.current = [];
      
      // Draw all points in gray
      allPoints.forEach((point: any, idx: number) => {
        const isStart = idx === startIndex;
        const isEnd = idx === endIndex;
        const isInSegment = idx >= startIndex && idx <= endIndex;
        
        let color = '#95a5a6'; // Gray for non-selected
        let size = 8;
        
        if (isStart) {
          color = '#27ae60'; // Green for start
          size = 20;
        } else if (isEnd) {
          color = '#e74c3c'; // Red for end
          size = 20;
        } else if (isInSegment) {
          color = '#3498db'; // Blue for segment
          size = 10;
        }
        
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: 'temp-marker',
            html: `<div style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          })
        }).addTo(map);
        tempMarkersRef.current.push(marker);
      });
      
      // Draw line for the selected segment
      if (endIndex > startIndex) {
        const segmentPoints = allPoints.slice(startIndex, endIndex + 1);
        const latlngs: [number, number][] = segmentPoints.map((p: any) => [p.lat, p.lng]);
        tempLineRef.current = L.polyline(latlngs, {
          color: '#27ae60',
          weight: 5,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(map);
        
        // Draw faded line for non-selected parts
        if (startIndex > 0) {
          const beforePoints = allPoints.slice(0, startIndex + 1);
          const beforeLatLngs: [number, number][] = beforePoints.map((p: any) => [p.lat, p.lng]);
          const fadedLine = L.polyline(beforeLatLngs, {
            color: '#95a5a6',
            weight: 3,
            opacity: 0.3,
            smoothFactor: 1
          }).addTo(map);
          fadedLinesRef.current.push(fadedLine);
        }
        
        if (endIndex < allPoints.length - 1) {
          const afterPoints = allPoints.slice(endIndex);
          const afterLatLngs: [number, number][] = afterPoints.map((p: any) => [p.lat, p.lng]);
          const fadedLine = L.polyline(afterLatLngs, {
            color: '#95a5a6',
            weight: 3,
            opacity: 0.3,
            smoothFactor: 1
          }).addTo(map);
          fadedLinesRef.current.push(fadedLine);
        }
      }
    };
    window.addEventListener('segment:preview', onSegmentPreview as EventListener);

    // Listen for segment applied (remove faded lines and show only selected segment)
    const onSegmentApplied = (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      
      // Clear all temporary elements (markers and lines)
      tempMarkersRef.current.forEach(m => m.remove());
      tempMarkersRef.current = [];
      if (tempLineRef.current) {
        tempLineRef.current.remove();
      }
      fadedLinesRef.current.forEach(l => l.remove());
      fadedLinesRef.current = [];
      
      const { points } = e.detail;
      
      // Show only the selected segment
      points.forEach((point: any, idx: number) => {
        const isStart = idx === 0;
        const isEnd = idx === points.length - 1;
        
        let color = '#3498db'; // Blue
        let size = 10;
        
        if (isStart) {
          color = '#27ae60'; // Green for start
          size = 16;
        } else if (isEnd) {
          color = '#e74c3c'; // Red for end
          size = 16;
        }
        
        const marker = L.marker([point.lat, point.lng], {
          icon: L.divIcon({
            className: 'temp-marker',
            html: `<div style="background: ${color}; width: ${size}px; height: ${size}px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [size, size],
            iconAnchor: [size / 2, size / 2]
          })
        }).addTo(map);
        tempMarkersRef.current.push(marker);
      });
      
      // Draw only the selected segment line
      if (points.length >= 2) {
        const latlngs: [number, number][] = points.map((p: any) => [p.lat, p.lng]);
        tempLineRef.current = L.polyline(latlngs, {
          color: '#27ae60',
          weight: 5,
          opacity: 0.8,
          smoothFactor: 1
        }).addTo(map);
      }
    };
    window.addEventListener('segment:applied', onSegmentApplied as EventListener);

    // Pending track preview handlers
    const onTrackPreview = (e: any) => {
      const map = mapRef.current;
      if (!map) return;
      const { points, name } = e.detail || {};
      if (!Array.isArray(points) || points.length < 2) return;

      // Clear existing preview elements
      previewMarkersRef.current.forEach(m => m.remove());
      previewMarkersRef.current = [];
      if (previewLineRef.current) {
        previewLineRef.current.remove();
        previewLineRef.current = null;
      }

      // Draw preview markers and line
      points.forEach((p: any, idx: number) => {
        const marker = L.marker([p.lat, p.lng], {
          icon: L.divIcon({
            className: 'preview-marker',
            html: `<div style="background: ${idx === 0 ? '#2ecc71' : idx === points.length - 1 ? '#e74c3c' : '#8e44ad'}; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.4);"></div>`,
            iconSize: [12,12],
            iconAnchor: [6,6]
          })
        }).addTo(map);
        previewMarkersRef.current.push(marker);
      });

      const latlngs: [number, number][] = points.map((p: any) => [p.lat, p.lng]);
      previewLineRef.current = L.polyline(latlngs, {
        color: '#8e44ad', // purple for preview
        weight: 6,
        opacity: 0.85,
        dashArray: '8,6'
      }).addTo(map);
      if (name) {
        previewLineRef.current.bindPopup(`<strong>Anteprima:</strong> ${name}`);
      }

      try {
        const bounds = L.latLngBounds(latlngs as any);
        map.fitBounds(bounds, { padding: [40,40], maxZoom: 15 });
      } catch {}
    };
    window.addEventListener('track:preview', onTrackPreview as EventListener);

    const onTrackPreviewClear = () => {
      previewMarkersRef.current.forEach(m => m.remove());
      previewMarkersRef.current = [];
      if (previewLineRef.current) {
        previewLineRef.current.remove();
        previewLineRef.current = null;
      }
    };
    window.addEventListener('track:preview:clear', onTrackPreviewClear as EventListener);
    
    // Hover on elevation profile -> show marker on route
    const onElevationHover = (e: any) => {
      const map = mapRef.current;
      // Priority: 1) currentTourPolylineRef (active tour), 2) tempLineRef (track creation)
      let poly = currentTourPolylineRef.current || tempLineRef.current;
      
      console.log('[onElevationHover] currentTourPolylineRef:', currentTourPolylineRef.current);
      console.log('[onElevationHover] tempLineRef:', tempLineRef.current);
      console.log('[onElevationHover] Using poly:', poly);
      
      if (!map || !poly) {
        console.log('[onElevationHover] No map or polyline found');
        return;
      }
      
      // Use ratio instead of absolute distance to handle simplified polylines
      const ratio = e?.detail?.ratio;
      if (typeof ratio !== 'number' || isNaN(ratio)) {
        console.log('[onElevationHover] Invalid ratio:', ratio);
        return;
      }
      
      console.log('[onElevationHover] Using ratio:', ratio);

      // Flatten polyline latlngs
      let latlngs: L.LatLng[] = [] as any;
      const ll: any = poly.getLatLngs?.();
      if (!ll || (Array.isArray(ll) && ll.length === 0)) return;
      if (Array.isArray(ll[0])) latlngs = (ll[0] as L.LatLng[]); else latlngs = (ll as L.LatLng[]);
      if (latlngs.length < 2) return;

      const haversineKm = (a: L.LatLng, b: L.LatLng) => {
        const R = 6371;
        const dLat = (b.lat - a.lat) * Math.PI / 180;
        const dLng = (b.lng - a.lng) * Math.PI / 180;
        const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
        return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
      };

      // Build cumulative distances
      const cum: number[] = [0];
      for (let i = 1; i < latlngs.length; i++) {
        cum[i] = cum[i-1] + haversineKm(latlngs[i-1], latlngs[i]);
      }

      const total = cum[cum.length - 1];
      // Use ratio to find the target distance on THIS polyline
      const targetKm = ratio * total;
      const d = Math.max(0, Math.min(targetKm, total));

      // Find segment where cumulative >= d
      let idx = cum.findIndex(v => v >= d);
      if (idx <= 0) idx = 1;
      const d0 = cum[idx-1];
      const d1 = cum[idx];
      const segLen = Math.max(1e-9, d1 - d0);
      const t = Math.max(0, Math.min(1, (d - d0) / segLen));
      const A = latlngs[idx-1];
      const B = latlngs[idx];
      
      console.log('[onElevationHover] Debug:', {
        totalPoints: latlngs.length,
        totalDistance: total,
        targetKm,
        d,
        idx,
        d0,
        d1,
        t,
        A: { lat: A.lat, lng: A.lng },
        B: { lat: B.lat, lng: B.lng }
      });
      
      const lat = A.lat + t * (B.lat - A.lat);
      const lng = A.lng + t * (B.lng - A.lng);

      // Create or update hover marker
      const markerHtml = `
        <div style="
          width: 16px; height: 16px; border-radius: 50%;
          background: #3498db; border: 3px solid white;
          box-shadow: 0 2px 8px rgba(52, 152, 219, 0.6), 0 0 0 2px rgba(52, 152, 219, 0.2);
          transition: all 0.2s ease;
        "></div>`;
      const icon = L.divIcon({ className: 'elev-hover-marker', html: markerHtml, iconSize: [16,16], iconAnchor: [8,8] });
      if (!elevationHoverMarkerRef.current) {
        elevationHoverMarkerRef.current = L.marker([lat, lng], { icon }).addTo(map);
        console.log('[onElevationHover] Created new marker at:', lat, lng);
      } else {
        elevationHoverMarkerRef.current.setLatLng([lat, lng]);
        elevationHoverMarkerRef.current.setIcon(icon);
        console.log('[onElevationHover] Updated marker position to:', lat, lng);
      }
      try { (elevationHoverMarkerRef.current as any).bringToFront?.(); } catch {}
    };

    const onElevationLeave = () => {
      if (elevationHoverMarkerRef.current) {
        try { elevationHoverMarkerRef.current.remove(); } catch {}
        elevationHoverMarkerRef.current = null;
      }
    };

    window.addEventListener('tour:elevation-hover', onElevationHover as EventListener);
    window.addEventListener('tour:elevation-leave', onElevationLeave as EventListener);

    // Track if map is fully ready
    let mapIsReady = false;
    
    // Emit map bounds whenever map moves or zooms
    const emitMapBounds = () => {
      if (!map || !mapRef.current || !mapIsReady) {
        console.log('[MapView] Map not ready yet, skipping bounds emission');
        return;
      }
      try {
        const bounds = map.getBounds();
        if (!bounds) return;
        
        console.log('[MapView] Emitting bounds:', {
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest()
        });
        
        window.dispatchEvent(new CustomEvent('map:bounds-change', {
          detail: {
            north: bounds.getNorth(),
            south: bounds.getSouth(),
            east: bounds.getEast(),
            west: bounds.getWest()
          }
        }));
      } catch (error) {
        console.warn('[MapView] Error getting map bounds:', error);
      }
    };
    
    // Emit bounds on map movement
    map.on('moveend', emitMapBounds);
    map.on('zoomend', emitMapBounds);
    
    // Listen for bounds requests from search form
    const onRequestBounds = () => {
      console.log('[MapView] Received bounds request, map ready:', mapIsReady);
      if (mapIsReady) {
        emitMapBounds();
      } else {
        // If map not ready, wait a bit and try again
        setTimeout(() => {
          if (mapIsReady) emitMapBounds();
        }, 1000);
      }
    };
    window.addEventListener('map:request-bounds', onRequestBounds);
    
    // Listen for tour:display event to show saved tours on the map
    const onTourDisplay = (e: any) => {
      const tour = e.detail;
      if (!tour || !mapRef.current) return;
      
      console.log('[MapView] Displaying tour:', tour);
      
      // Clear existing tour layers
      if (tourLineRef.current) {
        tourLineRef.current.remove();
        tourLineRef.current = null;
      }
      tourMarkersRef.current.forEach(m => m.remove());
      tourMarkersRef.current = [];
      
      // Use routePoints if available, otherwise use waypoints
      const points = tour.routePoints || tour.waypoints || [];
      if (points.length === 0) {
        console.log('[MapView] Tour has no points to display');
        return;
      }
      
      // Draw the tour line
      const latlngs = points.map((p: any) => [p.lat, p.lng]);
      tourLineRef.current = L.polyline(latlngs, {
        color: '#3498db',
        weight: 4,
        opacity: 0.8
      }).addTo(mapRef.current);
      
      // Add markers for waypoints
      const waypoints = tour.waypoints || [];
      waypoints.forEach((wp: any, index: number) => {
        const isFirst = index === 0;
        const isLast = index === waypoints.length - 1;
        
        let color = '#3498db';
        let label = `${index + 1}`;
        
        if (isFirst) {
          color = '#27ae60';
          label = 'S';
        } else if (isLast) {
          color = '#e74c3c';
          label = 'F';
        }
        
        const html = `
          <div style="
            background: ${color}; color: white; width: 28px; height: 28px;
            border-radius: 50%; display: flex; align-items: center; justify-content: center;
            font-weight: bold; font-size: 14px; border: 3px solid white;
            box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          ">${label}</div>`;
        
        const marker = L.marker([wp.lat, wp.lng], {
          icon: L.divIcon({
            className: 'tour-waypoint-marker',
            html,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(mapRef.current!);
        
        tourMarkersRef.current.push(marker);
      });
      
      // Fit map to tour bounds only if not currently editing a tour
      if (!isEditingTourRef.current) {
        mapRef.current.fitBounds(tourLineRef.current.getBounds(), { padding: [50, 50] });
      }
    };
    window.addEventListener('tour:display', onTourDisplay as EventListener);
    
    // Listen for tour:edit event to center map on tour being edited (only first time)
    const onTourEdit = (e: any) => {
      const tour = e.detail;
      if (!tour || !mapRef.current) return;
      
      // Mark that we're editing a tour
      isEditingTourRef.current = true;
      
      // Only center if this is a different tour than the last one centered
      if (tour.id === lastCenteredTourIdRef.current) {
        console.log('[MapView] Skipping center - already centered on this tour');
        return;
      }
      
      console.log('[MapView] Centering map on tour being edited:', tour.name);
      lastCenteredTourIdRef.current = tour.id;
      
      // Use routePoints if available, otherwise use waypoints
      const points = tour.routePoints || tour.waypoints || [];
      if (points.length === 0) {
        console.log('[MapView] Tour has no points to center on');
        return;
      }
      
      // Calculate bounds and fit map
      const latlngs = points.map((p: any) => [p.lat, p.lng] as [number, number]);
      const bounds = L.latLngBounds(latlngs);
      mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    };
    window.addEventListener('tour:edit', onTourEdit as EventListener);
    
    // Listen for tour:clear event to remove displayed tours
    const onTourClear = () => {
      console.log('[MapView] onTourClear called - starting cleanup');
      
      // Reset centered tour tracking and editing flag
      lastCenteredTourIdRef.current = null;
      isEditingTourRef.current = false;
      
      console.log('[MapView] Tour refs before cleanup:', {
        tourLine: !!tourLineRef.current,
        tourMarkers: tourMarkersRef.current.length,
        tempMarkers: tempMarkersRef.current.length,
        tempLine: !!tempLineRef.current,
        routingControl: !!routingControlRef.current,
        elevationHoverMarker: !!elevationHoverMarkerRef.current,
        currentTourPolyline: !!currentTourPolylineRef.current
      });
      
      // Clear tour line (from tour:display)
      if (tourLineRef.current) {
        console.log('[MapView] Removing tour line');
        tourLineRef.current.remove();
        tourLineRef.current = null;
      }
      
      // Clear tour markers (from tour:display)
      console.log('[MapView] Removing', tourMarkersRef.current.length, 'tour markers');
      tourMarkersRef.current.forEach(m => m.remove());
      tourMarkersRef.current = [];
      
      // Clear temp markers and line (from tour mode editing)
      console.log('[MapView] Removing', tempMarkersRef.current.length, 'temp markers');
      tempMarkersRef.current.forEach(m => m.remove());
      tempMarkersRef.current = [];
      if (tempLineRef.current) {
        console.log('[MapView] Removing temp line');
        tempLineRef.current.remove();
        tempLineRef.current = null;
      }
      
      // Remove routing control if it exists
      if (routingControlRef.current) {
        console.log('[MapView] Removing routing control');
        try {
          routingControlRef.current.remove();
        } catch {}
        routingControlRef.current = null;
      }
      // Remove delta routing control if it exists
      if (deltaRoutingControlRef.current) {
        console.log('[MapView] Removing delta routing control');
        try {
          deltaRoutingControlRef.current.remove();
        } catch {}
        deltaRoutingControlRef.current = null;
      }
      
      // Remove elevation hover marker
      if (elevationHoverMarkerRef.current) {
        console.log('[MapView] Removing elevation hover marker');
        elevationHoverMarkerRef.current.remove();
        elevationHoverMarkerRef.current = null;
      }
      
      // Clear any preview markers/lines and faded lines used for segment previews
      if (previewLineRef.current) {
        console.log('[MapView] Removing preview line');
        try { previewLineRef.current.remove(); } catch {}
        previewLineRef.current = null;
      }
      if (previewMarkersRef.current && previewMarkersRef.current.length) {
        console.log('[MapView] Removing', previewMarkersRef.current.length, 'preview markers');
        previewMarkersRef.current.forEach(m => m.remove());
        previewMarkersRef.current = [];
      }
      if (fadedLinesRef.current && fadedLinesRef.current.length) {
        console.log('[MapView] Removing', fadedLinesRef.current.length, 'faded lines');
        fadedLinesRef.current.forEach(l => l.remove());
        fadedLinesRef.current = [];
      }

      // Clear current tour polyline reference
      if (currentTourPolylineRef.current) {
        console.log('[MapView] Clearing currentTourPolylineRef');
        currentTourPolylineRef.current = null;
      }

      // Note: we intentionally do NOT clear savedTracksLayerRef here,
      // so that background singletracks remain visible when clearing a tour draft.
      
      // Reset tour mode state
      tourModeRef.current = false;
      manualModeStartIndexRef.current = null;
      manualModePrevRef.current = false;
      frozenRouteRef.current = null;
      
      console.log('[MapView] onTourClear completed');
    };
    window.addEventListener('tour:clear', onTourClear as EventListener);
    
    // Use 'load' event which fires after map and tiles are fully loaded
    const onMapLoad = () => {
      console.log('[MapView] Map load event fired');
      mapIsReady = true;
      console.log('[MapView] Map fully initialized, emitting initial bounds');
      emitMapBounds();
    };
    
    // Listen for the load event
    map.on('load', onMapLoad);
    
    // Fallback: if load doesn't fire within 2 seconds, set ready anyway
    setTimeout(() => {
      if (!mapIsReady) {
        console.log('[MapView] Fallback timeout - setting map as ready');
        mapIsReady = true;
        emitMapBounds();
      }
    }, 2000);

    return () => {
      window.removeEventListener('poi:select', onSelect as EventListener);
      window.removeEventListener('mode:change', onModeChange as EventListener);
      window.removeEventListener('segment:preview', onSegmentPreview as EventListener);
      window.removeEventListener('segment:applied', onSegmentApplied as EventListener);
      window.removeEventListener('track:preview', onTrackPreview as EventListener);
      window.removeEventListener('track:preview:clear', onTrackPreviewClear as EventListener);
      window.removeEventListener('map:request-bounds', onRequestBounds);
      window.removeEventListener('tour:display', onTourDisplay as EventListener);
      window.removeEventListener('tour:edit', onTourEdit as EventListener);
      window.removeEventListener('tour:clear', onTourClear as EventListener);
  window.removeEventListener('tour:elevation-hover', onElevationHover as EventListener);
  window.removeEventListener('tour:elevation-leave', onElevationLeave as EventListener);
      map.off('click', onMapClick);
      map.off('moveend', emitMapBounds);
      map.off('zoomend', emitMapBounds);
      map.off('load', onMapLoad);
      map.remove();
      mapRef.current = null;
    };
  }, [latitude, longitude]);

  // Show and update current location marker (bike icon)
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (typeof latitude !== 'number' || typeof longitude !== 'number') return;

    const html = `
      <div style="
        width: 24px; height: 24px; border-radius: 50%;
        background: #27ae60; border: 3px solid white;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4);
        position: relative; display: flex; align-items: center; justify-content: center; color: #fff;
        font-size: 14px;
      ">🚴</div>`;
    const icon = L.divIcon({ className: 'user-location-marker', html, iconSize: [24,24], iconAnchor: [12,12] });

    if (!locationMarkerRef.current) {
      locationMarkerRef.current = L.marker([latitude, longitude], { icon }).addTo(map);
    } else {
      locationMarkerRef.current.setLatLng([latitude, longitude]);
    }
  }, [latitude, longitude]);

  useEffect(() => {
    (async () => {
      const map = mapRef.current;
      if (!map) return;

      try {
        const trails = await fetchMapData();
        if (trails) {
          casingLayerRef.current?.clearLayers();
          trailLayerRef.current?.clearLayers();
          casingLayerRef.current?.addData(trails);
          trailLayerRef.current?.addData(trails);
        }
      } catch (err) {
        // noop
      }

      try {
        const pois: POIType[] = await fetchPOIs();
        const customPOIs: CustomPOI[] = getCustomPOIs();
        
        // Only render POIs if they are visible
        if (!poisVisibleRef.current) {
          console.log('POIs are hidden, skipping initial load');
          return;
        }
        
        (poiLayerRef.current as any)?.clearLayers?.();
        
        // Get current filter
        const categoryFilter = selectedPOICategoryRef.current;
        
        // Render API POIs (with filter)
        pois.forEach((p: POIType) => {
          // Filter out POIs in Milan area (lat ~45.4, lng ~9.1)
          const isMilano = p.location && 
                         p.location.lat >= 45.3 && p.location.lat <= 45.6 && 
                         p.location.lng >= 9.0 && p.location.lng <= 9.3;
          if (isMilano) {
            return; // Skip Milan POIs
          }
          
          // Apply category filter
          if (categoryFilter !== 'all' && p.type !== categoryFilter) {
            return; // Skip this POI
          }
          
          const poiColors: Record<string, string> = { 
            bikeshop: '#e74c3c',        // Rosso per ciclofficine
            restaurant: '#f39c12',      // Arancione per bar/ristoranti
            fountain: '#3498db',        // Blu per fontane
            market: '#9b59b6',          // Viola per market
            sleepnride: '#27ae60',      // Verde per sleep'n'ride
            viewpoint: '#1abc9c',       // Turchese per punti panoramici
            parking: '#34495e',         // Grigio per parcheggi
            campsite: '#16a085'         // Verde scuro per campeggi
          };
          
          const poiIcons: Record<string, string> = {
            bikeshop: '🔧',
            restaurant: '🍴',
            fountain: '💧',
            market: '🏪',
            sleepnride: '🏠',
            viewpoint: '📸',
            parking: '🅿️',
            campsite: '⛺'
          };
          
          const c = p.type ? (poiColors[p.type] ?? '#95a5a6') : '#95a5a6';
          const emoji = p.type ? (poiIcons[p.type] ?? '📍') : '📍';

          const icon = L.divIcon({ 
            className: 'poi-marker', 
            html: `<svg width="32" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C7 0 3 4 3 9c0 6.5 9 21 9 21s9-14.5 9-21c0-5-4-9-9-9z" fill="${c}" stroke="#fff" stroke-width="1.5"/>
              <text x="12" y="12" text-anchor="middle" font-size="10" dominant-baseline="middle">${emoji}</text>
            </svg>`, 
            iconSize: [32, 40], 
            iconAnchor: [16, 40], 
            popupAnchor: [0, -35] 
          });

          const marker = L.marker([p.location.lat, p.location.lng], { icon }).bindPopup(`<strong>${p.name}</strong><div>${p.description ?? ''}</div>`);
          (poiLayerRef.current as any)?.addLayer?.(marker) ?? marker.addTo(map);
        });
        
        // Render custom POIs (with filter)
        customPOIs.forEach((p: CustomPOI) => {
          // Apply filter
          if (categoryFilter !== 'all' && p.type !== categoryFilter) {
            return; // Skip this POI
          }
          
          const poiColors: Record<string, string> = { 
            bikeshop: '#e74c3c',
            restaurant: '#f39c12',
            fountain: '#3498db',
            market: '#9b59b6',
            sleepnride: '#27ae60',
            viewpoint: '#1abc9c',
            parking: '#34495e',
            campsite: '#16a085',
            'ebike-charging': '#2ecc71',
            'bike-rental': '#e67e22',
            'mtb-guide': '#c0392b'
          };
          
          const poiIcons: Record<string, string> = {
            bikeshop: '🔧',
            restaurant: '🍴',
            fountain: '💧',
            market: '🏪',
            sleepnride: '🏠',
            viewpoint: '📸',
            parking: '🅿️',
            campsite: '⛺',
            'ebike-charging': '🔌',
            'bike-rental': '🚲',
            'mtb-guide': '🧭'
          };
          
          // Check if user is developer
          const currentUser = getCurrentUser();
          // Use unified permission helper so admins & contributors inherit developer capabilities
          const isDeveloper = canDevelop(currentUser);
          
          // Skip disabled POIs for non-developers
          if (p.disabled && !isDeveloper) {
            return;
          }
          
          // Use gray color for disabled POIs, otherwise use normal color
          const normalColor = p.type ? (poiColors[p.type] ?? '#95a5a6') : '#95a5a6';
          const c = p.disabled ? '#95a5a6' : normalColor;
          const emoji = p.type ? (poiIcons[p.type] ?? '📍') : '📍';

          const icon = L.divIcon({ 
            className: 'poi-marker custom-poi-marker', 
            html: `<svg width="32" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C7 0 3 4 3 9c0 6.5 9 21 9 21s9-14.5 9-21c0-5-4-9-9-9z" fill="${c}" stroke="#fff" stroke-width="2" opacity="${p.disabled ? '0.5' : '1'}"/>
              <text x="12" y="12" text-anchor="middle" font-size="10" dominant-baseline="middle" opacity="${p.disabled ? '0.5' : '1'}">${emoji}</text>
              <circle cx="18" cy="4" r="3" fill="#27ae60" stroke="#fff" stroke-width="1"/>
              <text x="18" y="5.5" text-anchor="middle" font-size="6" fill="#fff" font-weight="bold">✓</text>
            </svg>`, 
            iconSize: [32, 40], 
            iconAnchor: [16, 40], 
            popupAnchor: [0, -35] 
          });

          // Create badge for disabled POIs
          const disabledBadge = p.disabled ? '<div style="background: #95a5a6; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; font-size: 11px;">⚠️ DISATTIVATO</div>' : '';
          
          // Developer buttons
          const developerButtons = isDeveloper ? `
            <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
              <div style="display: flex; gap: 6px; flex-direction: column;">
                <button 
                  class="toggle-poi-btn" 
                  data-poi-id="${p.id}"
                  style="background: ${p.disabled ? '#27ae60' : '#f39c12'}; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;"
                >
                  ${p.disabled ? '✓ Riattiva POI' : '⏸ Disattiva POI'}
                </button>
                <button 
                  class="delete-poi-btn"
                  data-poi-id="${p.id}"
                  style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;"
                >
                  🗑️ Elimina definitivamente
                </button>
              </div>
            </div>
          ` : '';

          const popupContent = `
            <div style="min-width: 150px;">
              ${disabledBadge}
              <strong>${p.name}</strong>
              ${p.description ? `<div style="margin-top: 4px; color: #666;">${p.description}</div>` : ''}
              ${developerButtons}
            </div>
          `;

          const marker = L.marker([p.location.lat, p.location.lng], { icon });
          const popup = L.popup().setContent(popupContent);
          marker.bindPopup(popup);
          
          // Add click handler after popup opens (only if developer)
          if (isDeveloper) {
            marker.on('popupopen', () => {
              // Toggle disabled button
              const toggleBtn = document.querySelector('.toggle-poi-btn[data-poi-id="' + p.id + '"]');
              if (toggleBtn) {
                toggleBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  togglePOIDisabled(p.id);
                  marker.closePopup();
                });
              }
              
              // Delete button
              const deleteBtn = document.querySelector('.delete-poi-btn[data-poi-id="' + p.id + '"]');
              if (deleteBtn) {
                deleteBtn.addEventListener('click', (e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  
                  // Show confirmation first
                  if (confirm(`Sei sicuro di voler eliminare definitivamente il POI "${p.name}"? Questa azione non può essere annullata.`)) {
                    // Close popup after confirmation
                    marker.closePopup();
                    setTimeout(() => {
                      deleteCustomPOI(p.id);
                      // Reload POIs
                      window.dispatchEvent(new CustomEvent('poi:added'));
                    }, 100);
                  } else {
                    // User cancelled - just close popup
                    marker.closePopup();
                  }
                });
              }
            });
          }
          
          (poiLayerRef.current as any)?.addLayer?.(marker) ?? marker.addTo(map);
        });
      } catch (err) {
        // noop
      }

      // Helper to normalize point shapes (supports {lat,lng} or [lat,lng])
      const toLatLngTuple = (p: any): [number, number] | null => {
        if (!p) return null;
        if (typeof p.lat === 'number' && typeof p.lng === 'number') return [p.lat, p.lng];
        if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number') return [p[0], p[1]];
        if (p.latitude && p.longitude) return [Number(p.latitude), Number(p.longitude)];
        return null;
      };

      // Load and render saved tracks
      const renderSavedTrack = (track: SavedTrack) => {
        console.log('Rendering track:', track.name, 'with', track.points.length, 'points');
        
        const currentUser = getCurrentUser();
  // Use unified permission helper (admin/contributor)
  const isDeveloper = canDevelop(currentUser);
        
        // Skip disabled tracks for non-developers
        if (track.disabled && !isDeveloper) {
          console.log('Skipping disabled track for non-developer:', track.name);
          return;
        }
        
        const latlngs: [number, number][] = (track.points || [])
          .map((p: any) => toLatLngTuple(p))
          .filter((t): t is [number, number] => Array.isArray(t));
        if (latlngs.length < 2) {
          console.warn('Skipping track with insufficient/invalid points:', track.name, track.points);
          return;
        }
        console.log('Track coordinates:', latlngs);
        
        // Use gray color for disabled tracks, otherwise use difficulty color
        const color = track.disabled ? '#95a5a6' : getDifficultyColor(track.difficulty);
        console.log('Track color:', color);
        
        // Get review statistics
        const avgRating = getAverageRating(track.id);
        const latestReview = getLatestReview(track.id);
        const reviewCount = track.reviews?.length || 0;
        
        const line = L.polyline(latlngs, {
          color: color,
          weight: 4,
          opacity: track.disabled ? 0.4 : 0.7,
          smoothFactor: 1,
          pane: 'savedTracksPane'
        });
        
        console.log('Polyline created:', line);
        
        // Add start marker (green square)
        const startPoint = latlngs[0];
        const startMarker = L.marker([startPoint[0], startPoint[1]], {
          icon: L.divIcon({
            className: 'start-marker',
            html: '<div style="width: 12px; height: 12px; background-color: #27ae60; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          }),
          pane: 'savedTracksPane'
        });
        
        // Add end marker (red square)
        const endPoint = latlngs[latlngs.length - 1];
        const endMarker = L.marker([endPoint[0], endPoint[1]], {
          icon: L.divIcon({
            className: 'end-marker',
            html: '<div style="width: 12px; height: 12px; background-color: #e74c3c; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.5);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6]
          }),
          pane: 'savedTracksPane'
        });
        
        // Create popup content with developer controls
        const disabledBadge = track.disabled ? '<div style="background: #95a5a6; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 8px; font-size: 12px;">⚠️ DISATTIVATO</div>' : '';
        
        const developerButtons = isDeveloper ? `
          <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e0e0e0;">
            <div style="display: flex; gap: 8px; flex-direction: column;">
              <button 
                class="recalc-elev-btn" 
                data-track-id="${track.id}"
                style="background: #16a085; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                🔁 Ricalcola dislivello
              </button>
              <button 
                class="rename-track-btn" 
                data-track-id="${track.id}"
                style="background: #2980b9; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                ✏️ Rinomina singletrack
              </button>
              <button 
                class="toggle-track-btn" 
                data-track-id="${track.id}"
                style="background: ${track.disabled ? '#27ae60' : '#f39c12'}; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                ${track.disabled ? '✓ Riattiva singletrack' : '⏸ Disattiva singletrack'}
              </button>
              <button 
                class="delete-track-btn" 
                data-track-id="${track.id}"
                style="background: #e74c3c; color: white; border: none; padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; font-weight: bold;"
              >
                🗑️ Elimina definitivamente
              </button>
            </div>
          </div>
        ` : '';
        
        const popupContent = `
          <div class="track-popup">
            ${disabledBadge}
            <h3>${track.name}</h3>
            <div class="track-info">
              <div class="info-row">
                <span class="label">Difficoltà:</span>
                <span class="value">${track.difficulty}</span>
              </div>
              <div class="info-row">
                <span class="label">Terreno:</span>
                <span class="value">${track.terrain}</span>
              </div>
              ${track.length ? `<div class="info-row"><span class="label">Lunghezza:</span><span class="value">${track.length} km</span></div>` : ''}
              ${track.elevationGain ? `<div class="info-row"><span class="label">Dislivello +:</span><span class="value">${track.elevationGain} m</span></div>` : ''}
              ${track.elevationLoss ? `<div class="info-row"><span class="label">Dislivello -:</span><span class="value">${track.elevationLoss} m</span></div>` : ''}
              ${track.duration ? `<div class="info-row"><span class="label">Durata:</span><span class="value">${track.duration} min</span></div>` : ''}
              ${track.description ? `<div class="info-row"><span class="label">Descrizione:</span><span class="value">${track.description}</span></div>` : ''}
            </div>
            <div class="elevation-profile" style="margin-top:12px;">
              <div style="font-size:12px;color:#555;margin-bottom:4px;font-weight:bold;">Profilo altimetrico</div>
              <div id="elev-chart-${track.id}" style="width:100%;overflow:hidden;display:flex;justify-content:center;align-items:center;min-height:82px;background:#f0f4f8;border:1px solid #d6e2eb;border-radius:6px;">
                <div style="font-size:12px;color:#777;">Caricamento profilo...</div>
              </div>
            </div>
            <div class="track-reviews">
              ${reviewCount > 0 ? `
                <div class="review-stats">
                  <div class="info-row">
                    <span class="label">Media voti:</span>
                    <span class="value rating-value">${avgRating}/10 ⭐ (${reviewCount} ${reviewCount === 1 ? 'recensione' : 'recensioni'})</span>
                  </div>
                  ${latestReview ? `
                    <div class="info-row">
                      <span class="label">Stato sentiero:</span>
                      <span class="value">${getTrailConditionLabel(latestReview.trailCondition)}</span>
                    </div>
                    <div class="info-row">
                      <span class="label">Ultima recensione:</span>
                      <span class="value">${new Date(latestReview.date).toLocaleDateString('it-IT')}</span>
                    </div>
                  ` : ''}
                </div>
              ` : '<div class="no-reviews">Nessuna recensione ancora</div>'}
            </div>
            <button class="btn-review" data-track-id="${track.id}">
              ⭐ Recensisci questo singletrack
            </button>
            ${reviewCount > 0 ? `
              <button class="btn-review-history" data-track-id="${track.id}" style="margin-top: 8px;">
                📋 Consulta storico recensioni (${reviewCount})
              </button>
            ` : ''}
            <button class="btn-edit-desc" data-track-id="${track.id}" style="margin-top: 8px;">
              ✏️ Aggiorna descrizione
            </button>
            ${developerButtons}
          </div>
        `;
        
        line.bindPopup(popupContent, { maxWidth: 300 });
        
        // Add event listener for review button
        line.on('popupopen', () => {
          // Small timeout to ensure DOM is ready
          setTimeout(() => {
            const reviewBtn = document.querySelector('.btn-review[data-track-id="' + track.id + '"]');
            console.log('[MapView] Looking for review button:', track.id, reviewBtn);
            if (reviewBtn) {
              reviewBtn.addEventListener('click', () => {
                console.log('[MapView] Review button clicked for track:', track.id);
                window.dispatchEvent(new CustomEvent('track:review-clicked', { detail: track.id }));
                line.closePopup();
              });
            }
            
            // Add event listener for review history button
            const historyBtn = document.querySelector('.btn-review-history[data-track-id="' + track.id + '"]');
            if (historyBtn) {
              historyBtn.addEventListener('click', () => {
                console.log('[MapView] Review history button clicked for track:', track.id);
                window.dispatchEvent(new CustomEvent('track:review-history-clicked', { detail: track.id }));
                line.closePopup();
              });
            }

            // Add event listener for edit description button
            const editBtn = document.querySelector('.btn-edit-desc[data-track-id="' + track.id + '"]');
            if (editBtn) {
              editBtn.addEventListener('click', () => {
                console.log('[MapView] Edit description button clicked for track:', track.id);
                window.dispatchEvent(new CustomEvent('track:edit-description-clicked', { detail: track.id }));
                line.closePopup();
              });
            }
            // Elevation sparkline (render for all users)
            try {
              const chartEl = document.getElementById('elev-chart-' + track.id);
              if (chartEl) {
                // Defer actual fetch/render slightly to let popup settle
                setTimeout(() => {
                  renderElevationSparkline(chartEl, track);
                }, 150);
              }
            } catch (err) {
              console.warn('[MapView] Unable to init elevation chart', err);
            }
          }, 50);
        });
        
        // Add event listeners for developer buttons
        if (isDeveloper) {
          line.on('popupopen', () => {
            setTimeout(() => {
              // Recalculate elevation button
              const recalcBtn = document.querySelector('.recalc-elev-btn[data-track-id="' + track.id + '"]');
              if (recalcBtn) {
                recalcBtn.addEventListener('click', async () => {
                  try {
                    (recalcBtn as HTMLButtonElement).setAttribute('disabled', 'true');
                    (recalcBtn as HTMLButtonElement).textContent = '⏳ Ricalcolo...';
                    const stats = await calculateTrackStats((track.points || []) as any, {
                      win: 3, k: 0.8, floor: 0.5, cap: 3
                    });
                    updateTrackElevations(track.id, stats.elevationGain, stats.elevationLoss, stats.length);
                    alert(`Dislivello aggiornato:\nD+ ${stats.elevationGain} m, D- ${stats.elevationLoss} m`);
                    line.closePopup();
                  } catch (err) {
                    console.warn('[MapView] Recalc elevation failed', err);
                    alert('Errore nel ricalcolo del dislivello. Riprova.');
                  } finally {
                    try {
                      (recalcBtn as HTMLButtonElement).removeAttribute('disabled');
                      (recalcBtn as HTMLButtonElement).textContent = '🔁 Ricalcola dislivello';
                    } catch {}
                  }
                });
              }
              // Rename button
              const renameBtn = document.querySelector('.rename-track-btn[data-track-id="' + track.id + '"]');
              if (renameBtn) {
                renameBtn.addEventListener('click', () => {
                  const nuovoNome = prompt('Inserisci il nuovo nome del singletrack:', track.name);
                  if (nuovoNome !== null) {
                    const trimmed = String(nuovoNome).trim();
                    if (trimmed && trimmed !== track.name) {
                      updateTrackName(track.id, trimmed);
                      line.closePopup();
                    }
                  }
                });
              }
              // Toggle disabled button
              const toggleBtn = document.querySelector('.toggle-track-btn[data-track-id="' + track.id + '"]');
              if (toggleBtn) {
                toggleBtn.addEventListener('click', () => {
                  toggleTrackDisabled(track.id);
                  line.closePopup();
                });
              }
              
              // Delete button
              const deleteBtn = document.querySelector('.delete-track-btn[data-track-id="' + track.id + '"]');
              if (deleteBtn) {
                deleteBtn.addEventListener('click', () => {
                  if (confirm(`Sei sicuro di voler eliminare definitivamente il singletrack "${track.name}"? Questa azione non può essere annullata.`)) {
                    window.dispatchEvent(new CustomEvent('track:delete', { detail: track.id }));
                    line.closePopup();
                  }
                });
              }
            }, 50);
          });
        }
        
        // In tour mode, only show popup on hover, not on click
        if (tourModeRef.current) {
          line.on('mouseover', function(this: L.Polyline) {
            this.openPopup();
          });
          line.on('mouseout', function(this: L.Polyline) {
            this.closePopup();
          });
          
          // Click to select for review (both in tour mode and normal mode)
          line.on('click', () => {
            window.dispatchEvent(new CustomEvent('track:selected', { detail: track }));
          });
        } else {
          // Normal mode: click to select for review
          line.on('click', () => {
            window.dispatchEvent(new CustomEvent('track:selected', { detail: track }));
          });
        }
        
        console.log('Adding line to savedTracksLayerRef');
  savedTracksLayerRef.current.addLayer(line);
  savedTracksLayerRef.current.addLayer(startMarker);
  savedTracksLayerRef.current.addLayer(endMarker);
  try { (savedTracksLayerRef.current as any).bringToFront?.(); } catch {}
        console.log('Line added successfully');
      };

      const savedTracks = getTracks();
      console.log('Loading saved tracks:', savedTracks);
      console.log('savedTracksLayerRef:', savedTracksLayerRef.current);
      savedTracks.forEach(renderSavedTrack);

      // Fit bounds to include all saved tracks, if any
      try {
        const allPoints: [number, number][] = savedTracks.flatMap(t => (t.points || []).map((p: any) => toLatLngTuple(p))).filter((t): t is [number, number] => Array.isArray(t));
        if (allPoints.length > 1) {
          map.fitBounds(allPoints as any);
        }
      } catch (e) {
        console.warn('Could not fit bounds to saved tracks', e);
      }
      
      // Listen for new tracks
      const onTrackAdded = (e: any) => {
        const track: SavedTrack = e.detail;
        console.log('New track added:', track);
        renderSavedTrack(track);
      };
      window.addEventListener('track:added', onTrackAdded as EventListener);
      
      // Listen for track deletion
      const onTrackDelete = (e: any) => {
        const trackId: string = e.detail;
        console.log('Deleting track:', trackId);
        deleteTrack(trackId);
        // Reload all tracks
        savedTracksLayerRef.current.clearLayers();
        const tracks = getTracks();
        tracks.forEach(renderSavedTrack);
      };
      window.addEventListener('track:delete', onTrackDelete as EventListener);
      
      // Listen for review added - reload all tracks to update popups
      const onReviewAdded = (e: any) => {
        console.log('Review added, reloading tracks');
        // Clear existing tracks
        savedTracksLayerRef.current.clearLayers();
        // Reload all tracks with updated data
        const updatedTracks = getTracks();
        updatedTracks.forEach(renderSavedTrack);
      };
      window.addEventListener('review:added', onReviewAdded as EventListener);
      
      // Listen for tour mode toggle - keep saved tracks as-is to avoid flicker/removal on cancel
      const onTourModeToggled = () => {
        console.log('Tour mode toggled');
        // Intentionally no clear/reload here to prevent tracks from disappearing on cancel.
        // If we need to update behavior later, we can rebind events without clearing layers.
      };
      window.addEventListener('tour:mode-toggled', onTourModeToggled as EventListener);
      
      // Listen for tracks updated (e.g., after approval) - reload all tracks
      const onTracksUpdated = () => {
        console.log('Tracks updated, reloading all tracks');
        savedTracksLayerRef.current.clearLayers();
        const updatedTracks = getTracks();
        updatedTracks.forEach(renderSavedTrack);
      };
      window.addEventListener('tracks:updated', onTracksUpdated as EventListener);
      
      // Listen for track focus from search - center map on track
      const onTrackFocus = (e: any) => {
        const track: SavedTrack = e.detail;
        console.log('Focusing on track:', track);
        
        if (!track || !track.points || track.points.length === 0) return;
        
        // Calculate bounds from track points
        const bounds = L.latLngBounds(track.points.map(p => [p.lat, p.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
        
        // Highlight the track temporarily
        savedTracksLayerRef.current.eachLayer((layer: any) => {
          if (layer instanceof L.Polyline) {
            // Check if this polyline matches the track (simple check)
            const layerLatLngs = layer.getLatLngs();
            if (layerLatLngs.length > 0) {
              const firstPoint = layerLatLngs[0] as L.LatLng;
              if (Math.abs(firstPoint.lat - track.points[0].lat) < 0.0001 &&
                  Math.abs(firstPoint.lng - track.points[0].lng) < 0.0001) {
                // This is the track we want to highlight
                setTimeout(() => {
                  layer.openPopup();
                }, 500);
              }
            }
          }
        });
      };
      window.addEventListener('track:focus', onTrackFocus as EventListener);
      
      // Listen for POI added
      const onPOIAdded = async () => {
        console.log('POI added, reloading POIs');
        
        // If POIs are hidden, don't reload them
        if (!poisVisibleRef.current) {
          console.log('POIs are hidden, skipping reload');
          return;
        }
        
        try {
          const pois: POIType[] = await fetchPOIs();
          const customPOIs: CustomPOI[] = getCustomPOIs();
          
          (poiLayerRef.current as any)?.clearLayers?.();
          
          // Get current filter
          const categoryFilter = selectedPOICategoryRef.current;
          
          // Render all POIs (same code as initial load, with filter)
          [...pois.map((p: any) => ({ ...p, isCustom: false })), ...customPOIs.map((p: any) => ({ ...p, isCustom: true }))].forEach((p: any) => {
            // Filter out POIs in Milan area (lat ~45.4, lng ~9.1)
            const isMilano = p.location && 
                           p.location.lat >= 45.3 && p.location.lat <= 45.6 && 
                           p.location.lng >= 9.0 && p.location.lng <= 9.3;
            if (isMilano) {
              return; // Skip Milan POIs
            }
            
            // Apply category filter
            if (categoryFilter !== 'all' && p.type !== categoryFilter) {
              return; // Skip this POI
            }
            
            const poiColors: Record<string, string> = { 
              bikeshop: '#e74c3c',
              restaurant: '#f39c12',
              fountain: '#3498db',
              market: '#9b59b6',
              sleepnride: '#27ae60',
              viewpoint: '#1abc9c',
              parking: '#34495e',
              campsite: '#16a085',
              'ebike-charging': '#2ecc71',
              'bike-rental': '#e67e22',
              'mtb-guide': '#c0392b'
            };
            
            const poiIcons: Record<string, string> = {
              bikeshop: '🔧',
              restaurant: '🍴',
              fountain: '💧',
              market: '🏪',
              sleepnride: '🏠',
              viewpoint: '📸',
              parking: '🅿️',
              campsite: '⛺',
              'ebike-charging': '🔌',
              'bike-rental': '🚲',
              'mtb-guide': '🧭'
            };
            
            // Check if user is developer
            const currentUser = getCurrentUser();
            // Unified permission helper
            const isDeveloper = canDevelop(currentUser);
            
            // Skip disabled POIs for non-developers
            if (p.disabled && !isDeveloper) {
              return;
            }
            
            // Use gray color for disabled POIs, otherwise use normal color
            const normalColor = p.type ? (poiColors[p.type] ?? '#95a5a6') : '#95a5a6';
            const c = p.disabled ? '#95a5a6' : normalColor;
            const emoji = p.type ? (poiIcons[p.type] ?? '📍') : '📍';

            const icon = L.divIcon({ 
              className: 'poi-marker', 
              html: p.isCustom ? `<svg width="32" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C7 0 3 4 3 9c0 6.5 9 21 9 21s9-14.5 9-21c0-5-4-9-9-9z" fill="${c}" stroke="#fff" stroke-width="2" opacity="${p.disabled ? '0.5' : '1'}"/>
                <text x="12" y="12" text-anchor="middle" font-size="10" dominant-baseline="middle" opacity="${p.disabled ? '0.5' : '1'}">${emoji}</text>
                <circle cx="18" cy="4" r="3" fill="#27ae60" stroke="#fff" stroke-width="1"/>
                <text x="18" y="5.5" text-anchor="middle" font-size="6" fill="#fff" font-weight="bold">✓</text>
              </svg>` : `<svg width="32" height="40" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 0C7 0 3 4 3 9c0 6.5 9 21 9 21s9-14.5 9-21c0-5-4-9-9-9z" fill="${c}" stroke="#fff" stroke-width="1.5" opacity="${p.disabled ? '0.5' : '1'}"/>
                <text x="12" y="12" text-anchor="middle" font-size="10" dominant-baseline="middle" opacity="${p.disabled ? '0.5' : '1'}">${emoji}</text>
              </svg>`, 
              iconSize: [32, 40], 
              iconAnchor: [16, 40], 
              popupAnchor: [0, -35] 
            });

            // Create badge for disabled POIs
            const disabledBadge = p.disabled ? '<div style="background: #95a5a6; color: white; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-bottom: 4px; font-size: 11px;">⚠️ DISATTIVATO</div>' : '';
            
            // Developer buttons (only for custom POIs)
            const developerButtons = (p.isCustom && isDeveloper) ? `
              <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e0e0e0;">
                <div style="display: flex; gap: 6px; flex-direction: column;">
                  <button 
                    class="toggle-poi-btn" 
                    data-poi-id="${p.id}"
                    style="background: ${p.disabled ? '#27ae60' : '#f39c12'}; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;"
                  >
                    ${p.disabled ? '✓ Riattiva POI' : '⏸ Disattiva POI'}
                  </button>
                  <button 
                    class="delete-poi-btn"
                    data-poi-id="${p.id}"
                    style="background: #e74c3c; color: white; border: none; padding: 6px 10px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: bold;"
                  >
                    🗑️ Elimina definitivamente
                  </button>
                </div>
              </div>
            ` : '';

            const popupContent = `
              <div style="min-width: 150px;">
                ${disabledBadge}
                <strong>${p.name}</strong>
                ${p.description ? `<div style="margin-top: 4px; color: #666;">${p.description}</div>` : ''}
                ${developerButtons}
              </div>
            `;

            const marker = L.marker([p.location.lat, p.location.lng], { icon });
            const popup = L.popup().setContent(popupContent);
            marker.bindPopup(popup);
            
            // Add click handler for buttons (only for custom POIs and developers)
            if (p.isCustom && isDeveloper) {
              marker.on('popupopen', () => {
                // Toggle disabled button
                const toggleBtn = document.querySelector('.toggle-poi-btn[data-poi-id="' + p.id + '"]');
                if (toggleBtn) {
                  toggleBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    togglePOIDisabled(p.id);
                    marker.closePopup();
                  });
                }
                
                // Delete button
                const deleteBtn = document.querySelector('.delete-poi-btn[data-poi-id="' + p.id + '"]');
                if (deleteBtn) {
                  deleteBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    
                    // Show confirmation first
                    if (confirm(`Sei sicuro di voler eliminare definitivamente il POI "${p.name}"? Questa azione non può essere annullata.`)) {
                      // Close popup after confirmation
                      marker.closePopup();
                      setTimeout(() => {
                        deleteCustomPOI(p.id);
                        // Reload POIs
                        window.dispatchEvent(new CustomEvent('poi:added'));
                      }, 100);
                    } else {
                      // User cancelled - just close popup
                      marker.closePopup();
                    }
                  });
                }
              });
            }
            
            (poiLayerRef.current as any)?.addLayer?.(marker) ?? marker.addTo(map);
          });
        } catch (err) {
          console.error('Error reloading POIs:', err);
        }
      };
      window.addEventListener('poi:added', onPOIAdded as EventListener);
      
      // Listen for POI filter changes
      const onPOIFilter = (e: any) => {
        const category = e.detail.category;
        selectedPOICategoryRef.current = category;
        onPOIAdded(); // Reload POIs with new filter
      };
      window.addEventListener('poi:filter', onPOIFilter as EventListener);
      
      // Listen for POI visibility changes
      const onPOIVisibility = (e: any) => {
        const visible = e.detail.visible;
        poisVisibleRef.current = visible;
        
        if (visible) {
          // Show POIs - reload them
          onPOIAdded();
        } else {
          // Hide POIs - clear all layers
          (poiLayerRef.current as any)?.clearLayers?.();
        }
      };
      window.addEventListener('poi:visibility', onPOIVisibility as EventListener);
      
        // Helper function to calculate elevation profile (definita PRIMA di onTourAdded)
        const calculateElevationProfile = async (points: [number, number][], tour: any) => {
          try {
            console.log('[Elevation] Starting calculation for', points.length, 'points');
            
            if (points.length > 2) {
              // Campiona i punti per non sovraccaricare l'API
              const sampledCoords: [number, number][] = [];
              const step = Math.max(1, Math.floor(points.length / 100));
              for (let i = 0; i < points.length; i += step) {
                sampledCoords.push(points[i]);
              }
              // Aggiungi sempre l'ultimo punto
              sampledCoords.push(points[points.length - 1]);

              console.log('[Elevation] Sampled to', sampledCoords.length, 'points');

              // Ottieni le elevazioni - converti formato da [lat, lng] a {lat, lng}
              const mod = await import('../services/elevationService');
              const { getElevations } = mod as any;
              
              // Converti array di tuple in array di oggetti Point
              const pointObjects = sampledCoords.map(coord => ({ lat: coord[0], lng: coord[1] }));
              
              console.log('[Elevation] Calling getElevations...');
              const elevationData = await getElevations(pointObjects);
              console.log('[Elevation] Received elevation data:', elevationData?.length, 'points');
              
              if (elevationData && elevationData.length > 0) {
                // Funzione helper per calcolare distanza
                const calcDistance = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
                  const R = 6371; // Raggio della Terra in km
                  const dLat = (lat2 - lat1) * Math.PI / 180;
                  const dLng = (lng2 - lng1) * Math.PI / 180;
                  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                            Math.sin(dLng / 2) * Math.sin(dLng / 2);
                  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                  return R * c;
                };

                // Calcola le distanze cumulative
                let cumulativeDistance = 0;
                const profile = elevationData.map((ele: any, i: number) => {
                  if (i > 0) {
                    const lat1 = sampledCoords[i - 1][0];
                    const lng1 = sampledCoords[i - 1][1];
                    const lat2 = sampledCoords[i][0];
                    const lng2 = sampledCoords[i][1];
                    const segmentDist = calcDistance(lat1, lng1, lat2, lng2);
                    cumulativeDistance += segmentDist;
                  }
                  return { distance: cumulativeDistance, elevation: ele.elevation };
                });

                console.log('[Elevation] Profile calculated:', profile.length, 'points');

                // Emetti l'evento con il profilo altimetrico
                console.log('[Elevation] Dispatching tour:elevation-profile event');
                window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile } }));
                
                // Emetti anche le statistiche del tour
                console.log('[Elevation] Dispatching tour:stats event');
                window.dispatchEvent(new CustomEvent('tour:stats', { 
                  detail: { 
                    length: tour.totalLength,
                    elevationGain: tour.totalElevationGain,
                    elevationLoss: tour.totalElevationLoss
                  } 
                }));
                
                console.log('[Elevation] Events dispatched successfully');
              } else {
                console.warn('[Elevation] No elevation data received');
              }
            } else {
              console.warn('[Elevation] Not enough points:', points.length);
            }
          } catch (error) {
            console.error('Errore nel calcolo del profilo altimetrico:', error);
            // Emetti profilo vuoto in caso di errore
            window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile: [] } }));
          }
        };

        // Listen for new tours
        const onTourAdded = async (e: any) => {
          const tour: any = e.detail;
          console.log('New tour added:', tour);
          console.log('Tour has gpxData:', !!tour.gpxData);
          console.log('Tour has id:', tour.id);
          console.log('Tour has tracks:', !!tour.tracks);

          let trackPoints: [number, number][] = [];
          
          // Check if it's an ArchiveTour (from search/explore) with GPX data
          if (tour.gpxData) {
            console.log('Loading tour from GPX data...');
            console.log('GPX data length:', tour.gpxData.length);
            try {
              // Parse GPX data to extract points
              const parser = new DOMParser();
              const gpxDoc = parser.parseFromString(tour.gpxData, 'application/xml');
              
              // Check for parsing errors
              const parserError = gpxDoc.querySelector('parsererror');
              if (parserError) {
                console.error('GPX parsing error:', parserError.textContent);
                alert('Errore nel parsing del file GPX.');
                return;
              }
              
              // Extract track points from GPX
              const trkpts = gpxDoc.querySelectorAll('trkpt');
              console.log('Found trkpts:', trkpts.length);
              
              trackPoints = Array.from(trkpts).map(pt => [
                parseFloat(pt.getAttribute('lat') || '0'),
                parseFloat(pt.getAttribute('lon') || '0')
              ]);

              console.log(`Extracted ${trackPoints.length} points from GPX`);
              
              if (trackPoints.length > 0) {
                // Render the tour track in ORANGE
                const polyline = L.polyline(trackPoints, {
                  color: '#f39c12', // ARANCIONE
                  weight: 5,
                  opacity: 0.9
                }).addTo(savedTracksLayerRef.current);
                
                // Save reference to current tour polyline for elevation hover
                currentTourPolylineRef.current = polyline;

                // Add mouse events for reverse hover (map -> elevation chart)
                polyline.on('mousemove', (e: any) => {
                  const latlng = e.latlng;
                  const polylineLatLngs = polyline.getLatLngs() as L.LatLng[];
                  
                  // Calculate cumulative distances
                  const haversineKm = (a: L.LatLng, b: L.LatLng) => {
                    const R = 6371;
                    const dLat = (b.lat - a.lat) * Math.PI / 180;
                    const dLng = (b.lng - a.lng) * Math.PI / 180;
                    const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
                    return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
                  };
                  
                  const distances = [0];
                  for (let i = 1; i < polylineLatLngs.length; i++) {
                    distances[i] = distances[i-1] + haversineKm(polylineLatLngs[i-1], polylineLatLngs[i]);
                  }
                  
                  // Find closest point on polyline
                  let minDist = Infinity;
                  let closestIdx = 0;
                  for (let i = 0; i < polylineLatLngs.length; i++) {
                    const dist = haversineKm(latlng as L.LatLng, polylineLatLngs[i]);
                    if (dist < minDist) {
                      minDist = dist;
                      closestIdx = i;
                    }
                  }
                  
                  const hoverDistance = distances[closestIdx];
                  const totalDistance = distances[distances.length - 1];
                  const ratio = totalDistance > 0 ? hoverDistance / totalDistance : 0;
                  
                  // Dispatch event to update elevation chart
                  window.dispatchEvent(new CustomEvent('map:polyline-hover', { 
                    detail: { distance: hoverDistance, ratio } 
                  }));
                });
                
                polyline.on('mouseout', () => {
                  window.dispatchEvent(new CustomEvent('map:polyline-leave'));
                });

                // Add popup with tour info
                const tourInfo = `
                  <div class="track-popup">
                    <h3>🚴 Tour: ${tour.name}</h3>
                    ${tour.description ? `<p class="track-desc">${tour.description}</p>` : ''}
                    <div class="track-stats">
                      <div><strong>Lunghezza totale:</strong> ${tour.totalLength || 'N/D'} km</div>
                      <div><strong>Dislivello +:</strong> ${tour.totalElevationGain || 'N/D'} m</div>
                      <div><strong>Dislivello -:</strong> ${tour.totalElevationLoss || 'N/D'} m</div>
                      <div><strong>Località:</strong> ${tour.location}</div>
                      <div><strong>Difficoltà:</strong> ${tour.difficulty}</div>
                    </div>
                  </div>
                `;
                polyline.bindPopup(tourInfo);

                // Center map on the track
                if (mapRef.current) {
                  mapRef.current.fitBounds(trackPoints);
                }

                // Calculate and show elevation profile
                await calculateElevationProfile(trackPoints, tour);
              } else {
                alert('Il file GPX non contiene punti di traccia validi.');
              }
            } catch (error) {
              console.error('Error parsing GPX data:', error);
              alert('Errore nel caricamento del tour. Il file GPX potrebbe essere corrotto.');
            }
          } 
          // Original logic for tours with tracks structure
          else if (tour.id) {
            console.log('Trying to load tour with id:', tour.id);
            const tourData = getTourWithTracks(tour.id);
            console.log('getTourWithTracks result:', tourData);
            
            if (!tourData) {
              console.warn('No tour data found for tour:', tour);
              alert('Questo tour non ha dati GPX associati. Carica un file GPX quando crei il tour.');
              return;
            }
          
            // Render all tour tracks with a special style (ARANCIONE)
            tourData.tracks.forEach((track: any, index: number) => {
              const color = '#f39c12'; // ARANCIONE per tour tracks
              const polyline = L.polyline(track.points.map((p: any) => [p.lat, p.lng]), {
                color: color,
                weight: 5,
                opacity: 0.9
              }).addTo(savedTracksLayerRef.current);
            
              // Save reference to current tour polyline for elevation hover (use first track)
              if (index === 0) {
                currentTourPolylineRef.current = polyline;
              }
            
              // Add mouse events for reverse hover (map -> elevation chart)
              polyline.on('mousemove', (e: any) => {
                const latlng = e.latlng;
                const polylineLatLngs = polyline.getLatLngs() as L.LatLng[];
                
                // Calculate cumulative distances
                const haversineKm = (a: L.LatLng, b: L.LatLng) => {
                  const R = 6371;
                  const dLat = (b.lat - a.lat) * Math.PI / 180;
                  const dLng = (b.lng - a.lng) * Math.PI / 180;
                  const s = Math.sin(dLat/2)**2 + Math.cos(a.lat*Math.PI/180) * Math.cos(b.lat*Math.PI/180) * Math.sin(dLng/2)**2;
                  return 2 * R * Math.atan2(Math.sqrt(s), Math.sqrt(1-s));
                };
                
                const distances = [0];
                for (let i = 1; i < polylineLatLngs.length; i++) {
                  distances[i] = distances[i-1] + haversineKm(polylineLatLngs[i-1], polylineLatLngs[i]);
                }
                
                // Find closest point on polyline
                let minDist = Infinity;
                let closestIdx = 0;
                for (let i = 0; i < polylineLatLngs.length; i++) {
                  const dist = haversineKm(latlng as L.LatLng, polylineLatLngs[i]);
                  if (dist < minDist) {
                    minDist = dist;
                    closestIdx = i;
                  }
                }
                
                const hoverDistance = distances[closestIdx];
                const totalDistance = distances[distances.length - 1];
                const ratio = totalDistance > 0 ? hoverDistance / totalDistance : 0;
                
                // Dispatch event to update elevation chart
                window.dispatchEvent(new CustomEvent('map:polyline-hover', { 
                  detail: { distance: hoverDistance, ratio } 
                }));
              });
              
              polyline.on('mouseout', () => {
                window.dispatchEvent(new CustomEvent('map:polyline-leave'));
              });
            
              // Add popup with tour info
              const tourInfo = `
                <div class="track-popup">
                  <h3>🚴 Tour: ${tour.name}</h3>
                  <div class="track-segment-info">Segmento ${index + 1}/${tourData.tracks.length}: ${track.name}</div>
                  ${tour.description ? `<p class="track-desc">${tour.description}</p>` : ''}
                  <div class="track-stats">
                    <div><strong>Lunghezza totale:</strong> ${tour.totalLength} km</div>
                    <div><strong>Dislivello +:</strong> ${tour.totalElevationGain} m</div>
                    <div><strong>Dislivello -:</strong> ${tour.totalElevationLoss} m</div>
                  </div>
                </div>
              `;
              polyline.bindPopup(tourInfo);
            });
          
            // Fit map to show all tour tracks
            if (tourData.tracks.length > 0) {
              const allPoints = tourData.tracks.flatMap((t: any) => t.points.map((p: any) => [p.lat, p.lng] as [number, number]));
              if (allPoints.length > 0 && mapRef.current) {
                mapRef.current.fitBounds(allPoints);
              }
              
              // Calculate and show elevation profile
              await calculateElevationProfile(allPoints, tour);
            }
          }
        };

        window.addEventListener('tour:added', onTourAdded as EventListener);
      
      return () => {
        window.removeEventListener('track:added', onTrackAdded as EventListener);
        window.removeEventListener('track:delete', onTrackDelete as EventListener);
        window.removeEventListener('review:added', onReviewAdded as EventListener);
        window.removeEventListener('tour:mode-toggled', onTourModeToggled as EventListener);
        window.removeEventListener('tracks:updated', onTracksUpdated as EventListener);
        window.removeEventListener('tour:added', onTourAdded as EventListener);
        window.removeEventListener('poi:added', onPOIAdded as EventListener);
        window.removeEventListener('poi:filter', onPOIFilter as EventListener);
        window.removeEventListener('poi:visibility', onPOIVisibility as EventListener);
      };
    })();
  }, []);

  // Stato per visibilità POI
  const [poisVisible, setPoisVisible] = React.useState(true);

  // Listener per sincronizzare stato con eventi esterni (Sidebar)
  useEffect(() => {
    const handler = (e: any) => {
      setPoisVisible(e.detail?.visible !== false);
    };
    window.addEventListener('poi:visibility', handler as EventListener);
    return () => window.removeEventListener('poi:visibility', handler as EventListener);
  }, []);

  // Dispatch evento quando cambia stato
  useEffect(() => {
    window.dispatchEvent(new CustomEvent('poi:visibility', { detail: { visible: poisVisible } }));
  }, [poisVisible]);

  // Listen for waypoint removal to update frozen geometry
  useEffect(() => {
    const handleWaypointRemove = (e: any) => {
      const { index } = e.detail;
      if (typeof index === 'number' && frozenRouteRef.current) {
        console.log('[MapView] 🗑️ Waypoint', index, 'rimosso - aggiorno geometria congelata');
        
        // If the removed waypoint is within the frozen range, we need to clear frozen state
        // because the geometry is no longer valid
        if (index <= frozenRouteRef.current.untilIndex) {
          console.log('[MapView] ⚠️ Punto rimosso era nella geometria congelata - reset freeze');
          frozenRouteRef.current = null;
          manualModeStartIndexRef.current = null;
        } else {
          // Point was after frozen section, just adjust the index
          frozenRouteRef.current.untilIndex = Math.max(0, frozenRouteRef.current.untilIndex - 1);
          console.log('[MapView] ✅ Aggiornato indice congelato a:', frozenRouteRef.current.untilIndex);
        }
      }
    };
    
    window.addEventListener('waypoint:remove', handleWaypointRemove as EventListener);
    return () => window.removeEventListener('waypoint:remove', handleWaypointRemove as EventListener);
  }, []);

  return (
    <>
      <div id="map" ref={mapEl} style={{ height: '100vh', width: '100%' }} />
      <button
        className="btn-toggle-poi-map"
        style={{
          position: 'fixed',
          left: 'calc(320px + 16px)',
          bottom: 24,
          // Keep this below floating panels/overlays (which are 999/1000)
          zIndex: 800,
          background: poisVisible ? 'linear-gradient(135deg, #e74c3c 0%, #c0392b 100%)' : 'linear-gradient(135deg, #27ae60 0%, #229954 100%)',
          color: 'white',
          fontWeight: 600,
          fontSize: 16,
          border: 'none',
          borderRadius: 8,
          padding: '14px 22px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.18)',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
        onClick={() => setPoisVisible(v => !v)}
      >
        {poisVisible ? '👁️ Nascondi POI' : '👁️ Mostra POI'}
      </button>
    </>
  );
}
