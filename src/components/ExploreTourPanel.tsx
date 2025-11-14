import React, { useState, useEffect } from 'react';
import { getArchiveTours, ArchiveTour, deleteArchiveTour } from '../services/indexedDBStorage';
import { getCurrentUser, canDevelop } from '../services/authService';

export default function ExploreTourPanel() {
  const [tours, setTours] = useState<ArchiveTour[]>([]);
  const currentUser = getCurrentUser();
  // Use unified permission helper so admins & contributors can manage archive
  const isDeveloper = canDevelop(currentUser);

  useEffect(() => {
    loadTours();
    
    // Listen for tour updates
    const handleToursUpdate = () => loadTours();
    window.addEventListener('tours:updated', handleToursUpdate);
    
    return () => {
      window.removeEventListener('tours:updated', handleToursUpdate);
    };
  }, []);

  const loadTours = async () => {
    const allTours = await getArchiveTours();
    setTours(allTours);
  };

  // Generate a simple SVG preview of the GPX track
  const generateTrackPreview = (gpxData?: string): string => {
    if (!gpxData) {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#f0f0f0"/><text x="100" y="60" text-anchor="middle" fill="#999" font-size="14">No track data</text></svg>`;
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }

    try {
      const parser = new DOMParser();
      const gpxDoc = parser.parseFromString(gpxData, 'application/xml');
      const trkpts = gpxDoc.querySelectorAll('trkpt');

      if (trkpts.length === 0) {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#f0f0f0"/><text x="100" y="60" text-anchor="middle" fill="#999" font-size="14">No points</text></svg>`;
        return 'data:image/svg+xml,' + encodeURIComponent(svg);
      }

      // Extract coordinates
      let minLat = 90, maxLat = -90, minLon = 180, maxLon = -180;
      const points: { lat: number; lon: number }[] = [];

      trkpts.forEach(pt => {
        const lat = parseFloat(pt.getAttribute('lat') || '0');
        const lon = parseFloat(pt.getAttribute('lon') || '0');
        points.push({ lat, lon });
        minLat = Math.min(minLat, lat);
        maxLat = Math.max(maxLat, lat);
        minLon = Math.min(minLon, lon);
        maxLon = Math.max(maxLon, lon);
      });

      // Create SVG with proper scaling
      const padding = 10;
      const width = 200;
      const height = 120;
      const latRange = maxLat - minLat || 0.01;
      const lonRange = maxLon - minLon || 0.01;

      // Scale points to SVG coordinates
      const scaledPoints = points.map(p => ({
        x: padding + ((p.lon - minLon) / lonRange) * (width - 2 * padding),
        y: height - padding - ((p.lat - minLat) / latRange) * (height - 2 * padding)
      }));

      // Build path (sample points if too many)
      const sampleStep = Math.max(1, Math.floor(scaledPoints.length / 200));
      const sampledPoints = scaledPoints.filter((_, i) => i % sampleStep === 0 || i === scaledPoints.length - 1);
      
      const pathData = sampledPoints.map((p, i) => 
        `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`
      ).join(' ');

      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}"><rect width="${width}" height="${height}" fill="#e8f4f8"/><path d="${pathData}" stroke="#f39c12" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    } catch (error) {
      console.error('Error generating track preview:', error);
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 120"><rect width="200" height="120" fill="#f0f0f0"/><text x="100" y="60" text-anchor="middle" fill="#999" font-size="14">Error</text></svg>`;
      return 'data:image/svg+xml,' + encodeURIComponent(svg);
    }
  };

  const handleDeleteTour = async (tourId: string, tourName: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Previeni l'apertura del tour
    
    if (window.confirm(`Vuoi eliminare definitivamente il tour "${tourName}"?\n\nQuesta azione non può essere annullata.`)) {
      await deleteArchiveTour(tourId);
      await loadTours(); // Ricarica la lista
    }
  };

  const handleShowPreview = (tour: ArchiveTour, e: React.MouseEvent) => {
    e.stopPropagation();
    window.dispatchEvent(new CustomEvent('tour:added', { detail: tour }));
  };

  const handleDownloadGPX = (tour: ArchiveTour, e: React.MouseEvent) => {
    e.stopPropagation();
    
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

  return (
    <div className="explore-tour-panel" style={{ padding: 20 }}>
      <h3>📚 Esplora Tour</h3>
      <p style={{ fontSize: 14, color: '#666', marginBottom: 16 }}>
        {tours.length} tour disponibili in archivio
      </p>

      {tours.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: '#999' }}>
          <p>📭 Nessun tour disponibile</p>
          <p style={{ fontSize: 13 }}>I tour caricati dagli sviluppatori appariranno qui</p>
        </div>
      ) : (
        <div className="tours-list">
          {tours.map((tour) => (
            <div
              key={tour.id}
              className="tour-card"
              style={{
                background: '#fff',
                border: '1px solid #e0e0e0',
                borderRadius: 8,
                padding: 16,
                marginBottom: 12,
                transition: 'all 0.2s',
                position: 'relative'
              }}
            >
              {isDeveloper && (
                <button
                  onClick={(e) => handleDeleteTour(tour.id, tour.name, e)}
                  style={{
                    position: 'absolute',
                    top: 12,
                    right: 12,
                    background: '#e74c3c',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '6px 12px',
                    fontSize: 12,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s',
                    zIndex: 10
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#c0392b'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#e74c3c'}
                  title="Elimina tour (solo sviluppatori)"
                >
                  🗑️ Elimina
                </button>
              )}
              <h4 style={{ margin: '0 0 8px 0', color: '#2c3e50', paddingRight: isDeveloper ? '100px' : '0' }}>
                🚵 {tour.name}
              </h4>
              
              {/* Track preview thumbnail */}
              <div style={{ 
                marginBottom: 12,
                borderRadius: 4,
                overflow: 'hidden',
                border: '1px solid #e0e0e0',
                backgroundColor: '#f8f9fa'
              }}>
                <img 
                  src={generateTrackPreview(tour.gpxData)} 
                  alt={`Track preview for ${tour.name}`}
                  style={{ 
                    width: '100%', 
                    height: 'auto',
                    display: 'block'
                  }}
                />
              </div>

              {tour.description && (
                <p style={{ fontSize: 13, color: '#666', margin: '0 0 12px 0' }}>
                  {tour.description}
                </p>
              )}
              <div className="tour-stats" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                <div>
                  <strong>Lunghezza:</strong> {tour.totalLength} km
                </div>
                <div>
                  <strong>Dislivello +:</strong> {tour.totalElevationGain} m
                </div>
                <div>
                  <strong>Difficoltà:</strong> {tour.difficulty || 'N/D'}
                </div>
                <div>
                  <strong>Tipo bici:</strong> {tour.bikeType || 'N/D'}
                </div>
              </div>
              {tour.location && (
                <div style={{ marginTop: 8, fontSize: 12, color: '#3498db' }}>
                  📍 {tour.location}
                </div>
              )}

              {/* Pulsanti azione per tutti gli utenti */}
              <div style={{ 
                marginTop: 16, 
                paddingTop: 12, 
                borderTop: '1px solid #e0e0e0',
                display: 'flex',
                gap: 8
              }}>
                <button
                  onClick={(e) => handleShowPreview(tour, e)}
                  style={{
                    flex: 1,
                    background: '#3498db',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '10px 16px',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#2980b9'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#3498db'}
                  title="Visualizza il percorso sulla mappa"
                >
                  👁️ Mostra anteprima tour
                </button>
                <button
                  onClick={(e) => handleDownloadGPX(tour, e)}
                  style={{
                    flex: 1,
                    background: '#27ae60',
                    color: 'white',
                    border: 'none',
                    borderRadius: 4,
                    padding: '10px 16px',
                    fontSize: 13,
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    transition: 'background-color 0.2s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#229954'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = '#27ae60'}
                  title="Scarica il file GPX"
                >
                  💾 Scarica GPX
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
