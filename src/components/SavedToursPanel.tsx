import React, { useState, useEffect, useRef } from 'react';
import { getUserTours, deleteTour, Tour, addTour } from '../services/trackStorage';
import { parseGPXFile } from '../utils/gpxParser';

interface SavedToursPanelProps {}

const SavedToursPanel: React.FC<SavedToursPanelProps> = () => {
    const [tours, setTours] = useState<Tour[]>([]);
    const fileInputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        loadTours();
        
        // Listen for tour updates
        const handleTourAdded = () => {
            loadTours();
        };
        const handleToursUpdated = () => {
            loadTours();
        };
        window.addEventListener('tour:added', handleTourAdded as EventListener);
        window.addEventListener('tours:updated', handleToursUpdated as EventListener);
        
        return () => {
            window.removeEventListener('tour:added', handleTourAdded as EventListener);
            window.removeEventListener('tours:updated', handleToursUpdated as EventListener);
        };
    }, []);

    const loadTours = () => {
        const existingTours = getUserTours(); // Load only current user's tours
        setTours(existingTours);
    };

    const handleShowTour = (tourId: string) => {
        const tour = tours.find(t => t.id === tourId);
        if (!tour) return;

        // Use routePoints if available, otherwise use waypoints
        const points = (tour as any).routePoints || (tour as any).waypoints || [];
        
        if (points.length < 2) {
            alert('Questo tour non ha abbastanza punti da visualizzare');
            return;
        }

        // Dispatch event to show tour on map with full tour object
        window.dispatchEvent(new CustomEvent('tour:display', { detail: tour }));
    };

    const handleEditTour = (tourId: string) => {
        const tour = tours.find(t => t.id === tourId);
        if (!tour) return;

        // Dispatch event to edit tour (will open CreateTourForm with pre-filled data)
        window.dispatchEvent(new CustomEvent('tour:edit', { detail: tour }));
    };

    const handleDeleteTour = (tourId: string) => {
        const tour = tours.find(t => t.id === tourId);
        if (!tour) return;

        if (confirm(`Vuoi eliminare il tour "${tour.name}"?`)) {
            deleteTour(tourId);
            loadTours();
            
            // Notify map to hide the tour
            window.dispatchEvent(new CustomEvent('tour:deleted', { detail: { tourId } }));
        }
    };

    const handleDownloadGPX = (tourId: string) => {
        const tour = tours.find(t => t.id === tourId);
        if (!tour) return;

        // Create GPX content
        const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="Singletrack App" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${tour.name}</name>
    <desc>${tour.description || ''}</desc>
  </metadata>`;

        const gpxFooter = `</gpx>`;

        let gpxTracks = '';
        tour.tracks.forEach((trackId, idx) => {
            const { getTrackById } = require('../services/trackStorage');
            const track = getTrackById(trackId);
            if (!track) return;

            gpxTracks += `
  <trk>
    <name>${track.name} (${idx + 1})</name>
    <trkseg>`;

            track.points.forEach((point: any) => {
                gpxTracks += `
      <trkpt lat="${point.lat}" lon="${point.lng}">
        ${point.elevation !== undefined ? `<ele>${point.elevation}</ele>` : ''}
      </trkpt>`;
            });

            gpxTracks += `
    </trkseg>
  </trk>`;
        });

        const gpxContent = gpxHeader + gpxTracks + gpxFooter;

        // Download GPX file
        const blob = new Blob([gpxContent], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${tour.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.gpx`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleImportChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const nameFromFile = file.name.replace(/\.(gpx|fit)$/i, '');
        const ext = (file.name.split('.').pop() || '').toLowerCase();

        try {
            if (ext === 'gpx') {
                const content = await file.text();
                const gpx = parseGPXFile(content, { tolerance: 10, simplify: true, maxPoints: 2000 });
                const routePoints = gpx.points.map(p => ({ lat: p.lat, lng: p.lng }));

                // Sample intermediate waypoints from routePoints
                // so that when editing the tour, the user sees multiple key points along the route
                const sampleWaypoints = (points: { lat: number; lng: number }[]): { lat: number; lng: number }[] => {
                    if (points.length < 2) return points;
                    const result = [points[0]]; // Start
                    const step = Math.max(1, Math.floor(points.length / 40)); // ~40-50 waypoints total for high fidelity route
                    for (let i = step; i < points.length - 1; i += step) {
                        result.push(points[i]);
                    }
                    result.push(points[points.length - 1]); // End
                    return result;
                };

                const newTour = addTour({
                    name: gpx.name || nameFromFile || 'Attività Garmin',
                    description: gpx.description || 'Import da Garmin Connect (GPX)',
                    tracks: [],
                    totalLength: gpx.distance || 0,
                    totalElevationGain: gpx.elevationGain || 0,
                    totalElevationLoss: 0,
                    // Sample waypoints instead of just start/end so editing shows full route structure
                    waypoints: sampleWaypoints(routePoints),
                    routePoints,
                } as any);

                // Refresh list and notify map
                loadTours();
                window.dispatchEvent(new CustomEvent('tour:added', { detail: newTour }));
                alert(`Tour importato: ${newTour.name}`);
            } else if (ext === 'fit') {
                alert('Import FIT non ancora abilitato. Esporta l\'attività da Garmin come GPX e riprova.');
            } else {
                alert('Formato non supportato. Carica un file .gpx');
            }
        } catch (err: any) {
            console.error('Errore durante import GPX:', err);
            alert(`Errore durante l\'import: ${err?.message || err}`);
        } finally {
            // reset input so same file can be reselected
            e.target.value = '';
        }
    };

    return (
        <div className="saved-tours-panel">
            <div style={{ marginBottom: '20px' }}>
                <h2 style={{ margin: '0 0 8px 0', fontSize: '20px', color: 'rgba(255,255,255,0.95)' }}>
                    🚴 Tour Salvati
                </h2>
                <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                    I tuoi tour personalizzati
                </p>
                <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        className="btn-submit"
                        onClick={handleImportClick}
                        style={{ padding: '8px 12px', fontSize: '13px' }}
                        title="Importa file GPX"
                    >
                        ⬆️ Importa da .GPX
                    </button>
                    <input
                        ref={fileInputRef}
                        type="file"
                        accept=".gpx,.fit"
                        onChange={handleImportChange}
                        style={{ display: 'none' }}
                    />
                </div>
            </div>

            {tours.length === 0 ? (
                <div className="no-tracks-selected" style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px dashed rgba(255,255,255,0.2)',
                    borderRadius: '8px',
                    padding: '32px 24px',
                    textAlign: 'center'
                }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.3 }}>🗺️</div>
                    <p style={{ margin: 0, fontSize: '14px', color: 'rgba(255,255,255,0.6)' }}>
                        Nessun tour salvato ancora
                    </p>
                    <p style={{ margin: '8px 0 0 0', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
                        Crea il tuo primo tour dalla sezione "Crea Tour"
                    </p>
                </div>
            ) : (
                <div className="tours-list">
                    {tours.map((tour) => (
                        <div key={tour.id} className="tour-card" style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px',
                            padding: '16px',
                            marginBottom: '12px',
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                        }}
                        onMouseEnter={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.2)';
                        }}
                        onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)';
                        }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', color: 'rgba(255,255,255,0.95)' }}>
                                        🚴 {tour.name}
                                    </h4>
                                    {tour.description && (
                                        <p style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'rgba(255,255,255,0.7)' }}>
                                            {tour.description}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '16px', fontSize: '13px', color: 'rgba(255,255,255,0.6)', flexWrap: 'wrap' }}>
                                        {tour.totalLength && (
                                            <span>📏 {tour.totalLength} km</span>
                                        )}
                                        {tour.totalElevationGain !== undefined && tour.totalElevationGain > 0 && (
                                            <span>⬆️ D+ {tour.totalElevationGain} m</span>
                                        )}
                                        {tour.totalElevationLoss !== undefined && tour.totalElevationLoss > 0 && (
                                            <span>⬇️ D- {tour.totalElevationLoss} m</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                                <button 
                                    type="button"
                                    onClick={() => handleShowTour(tour.id)}
                                    className="btn-submit"
                                    style={{ flex: '1', minWidth: '100px', padding: '8px 12px', fontSize: '13px' }}
                                >
                                    👁️ Mostra
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleEditTour(tour.id)}
                                    className="btn-submit"
                                    style={{ 
                                        flex: '1', 
                                        minWidth: '100px', 
                                        padding: '8px 12px', 
                                        fontSize: '13px',
                                        background: 'linear-gradient(135deg, #f39c12 0%, #e67e22 100%)'
                                    }}
                                >
                                    ✏️ Modifica
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleDownloadGPX(tour.id)}
                                    className="btn-submit"
                                    style={{ 
                                        flex: '1', 
                                        minWidth: '100px', 
                                        padding: '8px 12px', 
                                        fontSize: '13px',
                                        background: 'linear-gradient(135deg, #3498db 0%, #2980b9 100%)'
                                    }}
                                >
                                    📥 GPX
                                </button>
                                <button 
                                    type="button"
                                    onClick={() => handleDeleteTour(tour.id)}
                                    className="btn-cancel"
                                    style={{ flex: '1', minWidth: '100px', padding: '8px 12px', fontSize: '13px' }}
                                >
                                    🗑️ Elimina
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default SavedToursPanel;
