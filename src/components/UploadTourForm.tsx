import React, { useState, useEffect } from 'react';
import { getCurrentUser } from '../services/authService';
import { addArchiveTour, ArchiveTour, getStorageInfo } from '../services/indexedDBStorage';
import CityAutocomplete from './CityAutocomplete';

interface UploadTourFormProps {
  onCancel: () => void;
  onSave: (tourData: ArchiveTour) => void;
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

// Function to simplify GPX by reducing points (keep every Nth point)
// This significantly reduces storage size while maintaining track shape
const simplifyGPX = (gpxContent: string, maxPoints: number = 500): string => {
  try {
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxContent, 'application/xml');
    
    // Get all track points
    const trkpts = gpxDoc.querySelectorAll('trkpt');
    const totalPoints = trkpts.length;
    
    if (totalPoints <= maxPoints) {
      // No need to simplify
      return gpxContent;
    }
    
    // Calculate sampling rate to keep approximately maxPoints
    const keepEvery = Math.ceil(totalPoints / maxPoints);
    console.log(`Simplifying GPX: ${totalPoints} points → ~${Math.ceil(totalPoints / keepEvery)} points (keep 1 every ${keepEvery})`);
    
    // Create a new simplified GPX by removing points
    let pointIndex = 0;
    trkpts.forEach((trkpt, index) => {
      // Keep first, last, and every Nth point
      if (index === 0 || index === totalPoints - 1 || index % keepEvery === 0) {
        // Keep this point
      } else {
        // Remove this point
        trkpt.parentNode?.removeChild(trkpt);
      }
    });
    
    // Serialize back to string
    const serializer = new XMLSerializer();
    const simplifiedContent = serializer.serializeToString(gpxDoc);
    
    return simplifiedContent;
  } catch (error) {
    console.error('Error simplifying GPX:', error);
    // Return original on error
    return gpxContent;
  }
};

// Estrai la prima coordinata (punto di partenza) dal GPX
const extractStartLatLng = (gpxContent: string): { lat?: number; lng?: number } => {
  try {
    const parser = new DOMParser();
    const gpxDoc = parser.parseFromString(gpxContent, 'application/xml');
    const firstTrkpt = gpxDoc.querySelector('trkpt');
    if (!firstTrkpt) return {};
    const latStr = firstTrkpt.getAttribute('lat');
    const lonStr = firstTrkpt.getAttribute('lon');
    const lat = latStr ? parseFloat(latStr) : undefined;
    const lng = lonStr ? parseFloat(lonStr) : undefined;
    if (typeof lat === 'number' && typeof lng === 'number' && !isNaN(lat) && !isNaN(lng)) {
      return { lat, lng };
    }
    return {};
  } catch {
    return {};
  }
};

export default function UploadTourForm({ onCancel, onSave }: UploadTourFormProps) {
  const currentUser = getCurrentUser();
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    location: '',
    radius: '',
    difficulty: 'medio',
    totalLength: '',
    totalElevationGain: '',
    totalElevationLoss: '',
    bikeType: 'Trail bike',
    gpxFile: null as File | null
  });

  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, quotaMB: 50, tours: 0 });
  const [showStorageInfo, setShowStorageInfo] = useState(true);

  useEffect(() => {
    // Update storage info when component mounts
    const updateStorageInfo = async () => {
      const info = await getStorageInfo();
      setStorageInfo(info);
    };
    
    updateStorageInfo();
    
    // Listen for storage updates
    const handleStorageUpdate = () => {
      updateStorageInfo();
    };
    
    window.addEventListener('tours:updated', handleStorageUpdate);
    return () => window.removeEventListener('tours:updated', handleStorageUpdate);
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFormData({ ...formData, gpxFile: file });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || currentUser.role !== 'developer') {
      alert('Solo gli sviluppatori possono caricare tour nel database');
      return;
    }

    if (!formData.name.trim()) {
      alert('Inserisci un nome per il tour');
      return;
    }

    if (!formData.location.trim()) {
      alert('Inserisci la località del tour');
      return;
    }

    if (!formData.gpxFile) {
      alert('Il file GPX è obbligatorio per visualizzare il tour sulla mappa');
      return;
    }

    // Read GPX file content if provided
    let gpxData: string | undefined = undefined;
    let startLat: number | undefined = undefined;
    let startLng: number | undefined = undefined;
    if (formData.gpxFile) {
      try {
        const fileContent = await formData.gpxFile.text();
        
        // Simplify GPX to reduce storage size
        const simplifiedGPX = simplifyGPX(fileContent);
        gpxData = simplifiedGPX;
        const start = extractStartLatLng(fileContent);
        startLat = start.lat;
        startLng = start.lng;
        
        console.log('GPX file loaded, original size:', fileContent.length);
        console.log('GPX simplified, new size:', simplifiedGPX.length);
        console.log('Reduction:', Math.round((1 - simplifiedGPX.length / fileContent.length) * 100) + '%');
      } catch (error) {
        console.error('Error reading GPX file:', error);
        alert('Errore nella lettura del file GPX');
        return;
      }
    }

    // Crea oggetto tour
    const tourData: Omit<ArchiveTour, 'id' | 'createdAt'> = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      location: formData.location.trim(),
      radius: formData.radius ? parseInt(formData.radius) : undefined,
      difficulty: formData.difficulty as 'facile' | 'medio' | 'difficile' | 'estremo' | 'ebike-climb',
      totalLength: parseFloat(formData.totalLength) || 0,
      totalElevationGain: parseInt(formData.totalElevationGain) || 0,
      totalElevationLoss: parseInt(formData.totalElevationLoss) || 0,
      bikeType: formData.bikeType as 'XC' | 'Hardtail' | 'Trail bike' | 'All Mountain' | 'Enduro' | 'E-bike' | 'Gravel',
      createdBy: currentUser.id,
      gpxData, // Add GPX data if file was provided
      startLat,
      startLng
    };

    // Add to archive and get the created tour with ID
    try {
      const savedTour = await addArchiveTour(tourData);
      console.log('Tour uploaded:', savedTour);
      
      // Reset form
      setFormData({
        name: '',
        description: '',
        location: '',
        radius: '',
        difficulty: 'medio',
        totalLength: '',
        totalElevationGain: '',
        totalElevationLoss: '',
        bikeType: 'Trail bike',
        gpxFile: null
      });

      onSave(savedTour);
    } catch (error) {
      console.error('Error saving tour:', error);
      alert('Errore nel salvataggio del tour: ' + (error as Error).message);
      return;
    }
  };

  // Solo sviluppatori possono vedere questo form
  if (!currentUser || currentUser.role !== 'developer') {
    return (
      <div style={{ padding: 20, textAlign: 'center' }}>
        <p>⚠️ Solo gli sviluppatori possono caricare tour nel database</p>
        <button className="btn-cancel" onClick={onCancel}>
          Chiudi
        </button>
      </div>
    );
  }

  return (
    <div className="upload-tour-form" style={{ padding: 20 }}>
      <h3>📤 Carica Tour nel Database</h3>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 8 }}>
        Solo sviluppatori - I tour caricati saranno visibili a tutti gli utenti
      </p>
      
      {/* Storage info */}
      {showStorageInfo && (
        <div style={{
          backgroundColor: storageInfo.usedMB > storageInfo.quotaMB * 0.8 ? '#fff3cd' : '#e7f3ff',
          border: `1px solid ${storageInfo.usedMB > storageInfo.quotaMB * 0.8 ? '#ffc107' : '#b3d9ff'}`,
          borderRadius: 4,
          padding: '8px 12px',
          marginBottom: 16,
          fontSize: 12,
          position: 'relative'
        }}>
          <button
            onClick={() => setShowStorageInfo(false)}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              fontSize: 16,
              color: '#666',
              padding: '2px 6px',
              lineHeight: 1,
              opacity: 0.6,
              transition: 'opacity 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
            title="Nascondi notifica"
            type="button"
          >
            ✕
          </button>
          💾 Spazio utilizzato: <strong>{storageInfo.usedMB} MB</strong> / ~{storageInfo.quotaMB} MB (IndexedDB)
          {' • '}
          <strong>{storageInfo.tours}</strong> tour in archivio
          {storageInfo.usedMB > storageInfo.quotaMB * 0.8 && (
            <div style={{ color: '#856404', marginTop: 4 }}>
              ⚠️ Spazio quasi esaurito! Elimina alcuni tour se necessario.
            </div>
          )}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Nome Tour *</label>
          <input
            type="text"
            value={formData.name}
            onChange={e => setFormData({ ...formData, name: e.target.value })}
            placeholder="Es: Giro del Monte Bianco"
            required
          />
        </div>

        <div className="form-group">
          <label>Descrizione</label>
          <textarea
            value={formData.description}
            onChange={e => setFormData({ ...formData, description: e.target.value })}
            placeholder="Descrivi il tour, punti di interesse, consigli..."
            rows={4}
          />
        </div>

        <CityAutocomplete
          value={formData.location}
          onChange={(value: string) => setFormData({ ...formData, location: value })}
          label="Località *"
          placeholder="Cerca città..."
          required
        />

        <div className="form-group">
          <label>Raggio di copertura (Km)</label>
          <input
            type="number"
            min="0"
            value={formData.radius}
            onChange={e => setFormData({ ...formData, radius: e.target.value })}
            placeholder="Es: 50"
          />
          <small style={{ display: 'block', marginTop: 4, color: '#666', fontSize: 12 }}>
            Area geografica coperta dal tour
          </small>
        </div>

        <div className="form-group">
          <label>Difficoltà *</label>
          <select
            value={formData.difficulty}
            onChange={e => setFormData({ ...formData, difficulty: e.target.value })}
            required
          >
            <option value="facile">🟢 Facile</option>
            <option value="medio">🔵 Medio</option>
            <option value="difficile">🔴 Difficile</option>
            <option value="estremo">⚫ Estremo</option>
            <option value="ebike-climb">🟣 E-bike Climb</option>
          </select>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Lunghezza totale (Km) *</label>
            <input
              type="number"
              step="0.1"
              min="0"
              value={formData.totalLength}
              onChange={e => setFormData({ ...formData, totalLength: e.target.value })}
              placeholder="Es: 45.5"
              required
            />
          </div>
          <div className="form-group">
            <label>Tipo bicicletta *</label>
            <select
              value={formData.bikeType}
              onChange={e => setFormData({ ...formData, bikeType: e.target.value })}
              required
            >
              {bikeTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Dislivello positivo (m) *</label>
            <input
              type="number"
              min="0"
              value={formData.totalElevationGain}
              onChange={e => setFormData({ ...formData, totalElevationGain: e.target.value })}
              placeholder="Es: 1200"
              required
            />
          </div>
          <div className="form-group">
            <label>Dislivello negativo (m)</label>
            <input
              type="number"
              min="0"
              value={formData.totalElevationLoss}
              onChange={e => setFormData({ ...formData, totalElevationLoss: e.target.value })}
              placeholder="Es: 1200"
            />
          </div>
        </div>

        <div className="form-group">
          <label>File GPX *</label>
          <input
            type="file"
            accept=".gpx"
            onChange={handleFileChange}
            required
          />
          <small style={{ display: 'block', marginTop: 4, color: '#666', fontSize: 12 }}>
            Carica il file GPX del tour per visualizzarlo sulla mappa
          </small>
        </div>

        <div className="form-actions" style={{ display: 'flex', gap: 12, marginTop: 24 }}>
          <button type="button" className="btn-cancel" onClick={onCancel}>
            Annulla
          </button>
          <button type="submit" className="btn-submit">
            📤 Carica Tour
          </button>
        </div>
      </form>
    </div>
  );
}
