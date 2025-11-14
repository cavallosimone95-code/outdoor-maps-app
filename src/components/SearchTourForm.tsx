import React, { useState } from 'react';
import { searchArchiveTours, ArchiveTour } from '../services/indexedDBStorage';
import CityAutocomplete from './CityAutocomplete';

interface SearchTourFormProps {
  onSearch: (results: ArchiveTour[]) => void;
}

const bikeTypes = [
  'XC',
  'Hardtail',
  'Trail bike',
  'All Mountain',
  'Enduro',
  'E-bike',
  'Gravel'
];

export default function SearchTourForm({ onSearch }: SearchTourFormProps) {
  const [location, setLocation] = useState('');
  const [radius, setRadius] = useState('');
  const [difficulty, setDifficulty] = useState('all');
  const [minKm, setMinKm] = useState('');
  const [maxKm, setMaxKm] = useState('');
  const [minElev, setMinElev] = useState('');
  const [maxElev, setMaxElev] = useState('');
  const [bikeType, setBikeType] = useState('all');
  const [searchResults, setSearchResults] = useState<ArchiveTour[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTour, setSelectedTour] = useState<ArchiveTour | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Se radius presente e location presente, tenta di geocodificare la location per ottenere coordinate centro
    let centerLat: number | undefined = undefined;
    let centerLng: number | undefined = undefined;
    if (location && radius) {
      try {
        const geoResp = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(location)}&limit=1`, {
          headers: { 'Accept-Language': 'it,en', 'User-Agent': 'SingletrackOutdoorMaps/1.0' }
        });
        if (geoResp.ok) {
          const data = await geoResp.json();
          if (Array.isArray(data) && data.length > 0) {
            const first = data[0];
            const latNum = parseFloat(first.lat);
            const lonNum = parseFloat(first.lon);
            if (!isNaN(latNum) && !isNaN(lonNum)) {
              centerLat = latNum;
              centerLng = lonNum;
            }
          }
        }
      } catch (err) {
        console.warn('Geocoding fallito, si procede solo con il filtro testuale', err);
      }
    }

    const filters = {
      location,
      centerLat,
      centerLng,
      radius: radius ? parseFloat(radius) : undefined,
      difficulty,
      bikeType,
      minKm: minKm ? parseFloat(minKm) : undefined,
      maxKm: maxKm ? parseFloat(maxKm) : undefined,
      minElev: minElev ? parseFloat(minElev) : undefined,
      maxElev: maxElev ? parseFloat(maxElev) : undefined
    };
    
    const results = await searchArchiveTours(filters);
    setSearchResults(results);
    setHasSearched(true);
    onSearch(results);
  };

  const handleViewTour = (tour: ArchiveTour) => {
    setSelectedTour(tour);
  };

  const handleShowPreview = (tour: ArchiveTour) => {
    // Dispatch event to show tour on map
    window.dispatchEvent(new CustomEvent('tour:added', { detail: tour }));
  };

  const handleDownloadGPX = (tour: ArchiveTour) => {
    if (!tour.gpxData) {
      alert('Nessun file GPX disponibile per questo tour');
      return;
    }

    // Crea un blob con i dati GPX
    const blob = new Blob([tour.gpxData], { type: 'application/gpx+xml' });
    const url = URL.createObjectURL(blob);
    
    // Crea un link temporaneo per il download
    const link = document.createElement('a');
    link.href = url;
    link.download = `${tour.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
    document.body.appendChild(link);
    link.click();
    
    // Pulizia
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleBackToResults = () => {
    setSelectedTour(null);
  };

  // Se c'è un tour selezionato, mostra la scheda dettaglio
  if (selectedTour) {
    return (
      <div className="tour-detail-card" style={{ padding: 20 }}>
        {/* Header con pulsante indietro */}
        <div style={{ marginBottom: 20 }}>
          <button
            onClick={handleBackToResults}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#3498db',
              cursor: 'pointer',
              fontSize: 14,
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: 0,
              marginBottom: 12
            }}
          >
            ← Torna ai risultati
          </button>
          <h3 style={{ margin: 0, color: '#2c3e50' }}>🚵 {selectedTour.name}</h3>
        </div>

        {/* Descrizione */}
        {selectedTour.description && (
          <div style={{
            background: '#f9f9f9',
            padding: 12,
            borderRadius: 8,
            marginBottom: 16,
            fontSize: 14,
            color: '#555',
            lineHeight: '1.6'
          }}>
            {selectedTour.description}
          </div>
        )}

        {/* Statistiche dettagliate */}
        <div style={{
          background: '#fff',
          border: '1px solid #e0e0e0',
          borderRadius: 8,
          padding: 16,
          marginBottom: 16
        }}>
          <h4 style={{ margin: '0 0 12px 0', fontSize: 14, color: '#666' }}>
            📊 Statistiche
          </h4>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 12,
            fontSize: 13
          }}>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Località</div>
              <div style={{ fontWeight: 'bold', color: '#3498db' }}>📍 {selectedTour.location}</div>
            </div>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Tipo bici</div>
              <div style={{ fontWeight: 'bold' }}>🚴 {selectedTour.bikeType || 'N/D'}</div>
            </div>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Lunghezza</div>
              <div style={{ fontWeight: 'bold', color: '#2c3e50' }}>📏 {selectedTour.totalLength.toFixed(1)} km</div>
            </div>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Difficoltà</div>
              <div style={{ fontWeight: 'bold' }}>
                {selectedTour.difficulty === 'facile' && '🟢 Facile'}
                {selectedTour.difficulty === 'medio' && '🔵 Medio'}
                {selectedTour.difficulty === 'difficile' && '🔴 Difficile'}
                {selectedTour.difficulty === 'estremo' && '⚫ Estremo'}
                {selectedTour.difficulty === 'ebike-climb' && '🟣 E-bike Climb'}
                {!selectedTour.difficulty && 'N/D'}
              </div>
            </div>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Dislivello ↗️</div>
              <div style={{ fontWeight: 'bold', color: '#27ae60' }}>⛰️ +{selectedTour.totalElevationGain}m</div>
            </div>
            <div>
              <div style={{ color: '#999', fontSize: 11, marginBottom: 2 }}>Dislivello ↘️</div>
              <div style={{ fontWeight: 'bold', color: '#e74c3c' }}>⛰️ -{selectedTour.totalElevationLoss}m</div>
            </div>
          </div>
        </div>

        {/* Pulsanti azione */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <button
            onClick={() => handleShowPreview(selectedTour)}
            style={{
              background: '#3498db',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
          >
            👁️ Mostra anteprima tour sulla mappa
          </button>
          <button
            onClick={() => handleDownloadGPX(selectedTour)}
            style={{
              background: '#27ae60',
              color: 'white',
              border: 'none',
              borderRadius: 6,
              padding: '12px 16px',
              fontSize: 14,
              fontWeight: 'bold',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#229954'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
          >
            💾 Scarica file GPX
          </button>
        </div>
      </div>
    );
  }

  return (
    <form className="search-tour-form" onSubmit={handleSearch} style={{ padding: 20 }}>
      <h3>🔎 Ricerca Tour</h3>
      <CityAutocomplete
        value={location}
        onChange={(value: string) => setLocation(value)}
        label="Luogo"
        placeholder="Cerca città..."
      />
      <div className="form-group">
        <label>Nel raggio di (Km)</label>
        <input
          type="number"
          min="0"
          value={radius}
          onChange={e => setRadius(e.target.value)}
          placeholder="Es: 50"
        />
        <small style={{ display: 'block', marginTop: 4, color: '#666', fontSize: 12 }}>
          Lascia vuoto per cercare in tutta l'area
        </small>
      </div>
      <div className="form-group">
        <label>Difficoltà</label>
        <select value={difficulty} onChange={e => setDifficulty(e.target.value)}>
          <option value="all">Tutte</option>
          <option value="facile">🟢 Facile</option>
          <option value="medio">🔵 Medio</option>
          <option value="difficile">🔴 Difficile</option>
          <option value="estremo">⚫ Estremo</option>
          <option value="ebike-climb">🟣 E-bike Climb</option>
        </select>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Km min</label>
          <input
            type="number"
            min="0"
            value={minKm}
            onChange={e => setMinKm(e.target.value)}
            placeholder="Min"
          />
        </div>
        <div className="form-group">
          <label>Km max</label>
          <input
            type="number"
            min="0"
            value={maxKm}
            onChange={e => setMaxKm(e.target.value)}
            placeholder="Max"
          />
        </div>
      </div>
      <div className="form-row">
        <div className="form-group">
          <label>Dislivello + min (m)</label>
          <input
            type="number"
            min="0"
            value={minElev}
            onChange={e => setMinElev(e.target.value)}
            placeholder="Min"
          />
        </div>
        <div className="form-group">
          <label>Dislivello + max (m)</label>
          <input
            type="number"
            min="0"
            value={maxElev}
            onChange={e => setMaxElev(e.target.value)}
            placeholder="Max"
          />
        </div>
      </div>
      <div className="form-group">
        <label>Tipo di bicicletta</label>
        <select value={bikeType} onChange={e => setBikeType(e.target.value)}>
          <option value="all">Tutte</option>
          {bikeTypes.map(type => (
            <option key={type} value={type}>{type}</option>
          ))}
        </select>
      </div>
      <button type="submit" className="btn-submit" style={{ width: '100%', marginTop: 16 }}>
        Cerca Tour
      </button>

      {/* Search Results */}
      {hasSearched && (
        <div style={{ marginTop: 24, borderTop: '2px solid #ddd', paddingTop: 16 }}>
          <h4 style={{ marginBottom: 12 }}>
            {searchResults.length > 0 
              ? `${searchResults.length} Tour trovati` 
              : 'Nessun tour trovato'}
          </h4>
          {searchResults.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {searchResults.map(tour => (
                <div 
                  key={tour.id} 
                  style={{
                    padding: 12,
                    border: '1px solid #ddd',
                    borderRadius: 8,
                    cursor: 'pointer',
                    backgroundColor: '#f9f9f9',
                    transition: 'background-color 0.2s'
                  }}
                  onClick={() => handleViewTour(tour)}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8e8e8'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#f9f9f9'}
                >
                  <div style={{ fontWeight: 'bold', marginBottom: 4, color: '#2c3e50' }}>{tour.name}</div>
                  {tour.description && (
                    <div style={{ fontSize: 12, color: '#666', marginBottom: 8 }}>
                      {tour.description}
                    </div>
                  )}
                  <div style={{ fontSize: 12, display: 'flex', gap: 12, flexWrap: 'wrap', color: '#555' }}>
                    <span>📍 {tour.location}</span>
                    <span>🚴 {tour.bikeType}</span>
                    <span>📏 {tour.totalLength.toFixed(1)} km</span>
                    <span>⛰️ ↗️{tour.totalElevationGain}m</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </form>
  );
}

