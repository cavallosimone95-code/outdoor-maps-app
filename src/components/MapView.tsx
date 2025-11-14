import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
import { fetchPOIs, fetchMapData } from '../services/mapService';
import { POI as POIType } from '../types';
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

  const defaultCenter = { lat: 45.0, lng: 9.0 };
  const center = typeof latitude === 'number' && typeof longitude === 'number'
    ? { lat: latitude, lng: longitude }
    : defaultCenter;

  useEffect(() => {
    if (!mapEl.current) return;
    if (mapRef.current) return; // already initialized

    const PROVIDER = (process.env.REACT_APP_MAP_PROVIDER || 'opentopomap').toLowerCase();
    const MAPBOX_TOKEN = process.env.REACT_APP_MAPBOX_TOKEN;
    const thunderUrl = MAPBOX_TOKEN ? `https://api.mapbox.com/styles/v1/mapbox/outdoors-v11/tiles/{z}/{x}/{y}?access_token=${MAPBOX_TOKEN}` : null;

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

    const map = L.map(mapEl.current as HTMLDivElement, { center, zoom: 12, layers: [baseOutdoors] });
    mapRef.current = map;

    const baseLabel = PROVIDER === 'komoot' ? 'Komoot-like (Outdoor)' : 'Outdoors (Topo)';
    const baseLayers = { [baseLabel]: baseOutdoors, 'Streets': baseOSM };
    const overlays = { 'Hillshade': hillshade };
    L.control.layers(baseLayers, overlays, { collapsed: false }).addTo(map);
    hillshade.addTo(map);

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

    return () => {
      window.removeEventListener('poi:select', onSelect as EventListener);
      map.remove();
      mapRef.current = null;
    };
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
        (poiLayerRef.current as any)?.clearLayers?.();
        pois.forEach((p: POIType) => {
          const poiColors: Record<string, string> = { trailhead: '#2ecc71', viewpoint: '#3498db', parking: '#95a5a6' };
          const c = p.type ? (poiColors[p.type] ?? '#34495e') : '#34495e';

          const icon = L.divIcon({ className: 'poi-marker', html: `<svg width="28" height="36" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg"><path d="M12 0C7 0 3 4 3 9c0 6.5 9 21 9 21s9-14.5 9-21c0-5-4-9-9-9z" fill="${c}" /><circle cx="12" cy="9" r="3" fill="#fff"/></svg>`, iconSize: [28,36], iconAnchor: [14,36], popupAnchor: [0,-30] });

          const marker = L.marker([p.location.lat, p.location.lng], { icon }).bindPopup(`<strong>${p.name}</strong><div>${p.description ?? ''}</div>`);
          (poiLayerRef.current as any)?.addLayer?.(marker) ?? marker.addTo(map);
        });
      } catch (err) {
        // noop
      }
    })();
  }, []);

  return <div id="map" ref={mapEl} style={{ height: '100vh', width: '100%' }} />;
}
