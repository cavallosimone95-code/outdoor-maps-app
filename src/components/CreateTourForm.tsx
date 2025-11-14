import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import TourStatsPanel from './TourStatsPanel';
import { updateTour } from '../services/trackStorage';

interface Tour {
    id: string;
    name: string;
    description: string;
    // Keeping tracks for storage compatibility, but planning is waypoint-based
    tracks?: string[];
    totalLength?: number;
    totalElevationGain?: number;
    totalElevationLoss?: number;
    createdAt: string;
}

interface CreateTourFormProps {
    onCancel: () => void;
    onSave: (tour: Omit<Tour, 'id' | 'createdAt'>) => void;
}

export default function CreateTourForm({ onCancel, onSave }: CreateTourFormProps) {
    const [tourName, setTourName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [waypoints, setWaypoints] = useState<{ lat: number; lng: number }[]>([]);
    const [routePoints, setRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
    const [stats, setStats] = useState<{ length?: number; elevationGain?: number; elevationLoss?: number; minElevation?: number; maxElevation?: number }>({});
    const [elevationProfile, setElevationProfile] = useState<{ distance: number; elevation: number }[]>([]);
    const [loadingElevation, setLoadingElevation] = useState<boolean>(false);
    const [manualMode, setManualMode] = useState<boolean>(false);
    const [editingTourId, setEditingTourId] = useState<string | null>(null);

    // Listen for map clicks to add waypoints when in tour mode
    useEffect(() => {
        const onMapClick = (e: any) => {
            const p = e.detail as { lat: number; lng: number };
            
            // Check if clicking on first waypoint to close the loop
            if (waypoints.length >= 2) {
                const first = waypoints[0];
                const distance = Math.sqrt(
                    Math.pow(first.lat - p.lat, 2) + Math.pow(first.lng - p.lng, 2)
                );
                
                // If click is close to first point (within ~50m), close the loop
                if (distance < 0.0005) { // roughly 50 meters
                    if (confirm('Vuoi chiudere il tour tornando al punto di partenza?')) {
                        setWaypoints(prev => [...prev, first]);
                        return;
                    }
                }
            }
            
            setWaypoints(prev => [...prev, p]);
        };
        
        window.addEventListener('map:click', onMapClick as EventListener);
        return () => {
            window.removeEventListener('map:click', onMapClick as EventListener);
        };
    }, [waypoints]);

    // When waypoints change, notify map to compute routing
    useEffect(() => {
        console.log(`[CreateTourForm] 🔄 useEffect triggered - waypoints=${waypoints.length}, manualMode=${manualMode}`);
        window.dispatchEvent(new CustomEvent('mode:change', { detail: { mode: 'tour', points: waypoints, manualMode } }));
    }, [waypoints, manualMode]);

    // Listen for keyboard shortcuts to remove last waypoint
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            // Backspace or Delete removes last waypoint (Ctrl+Z also works)
            if ((e.key === 'Backspace' || e.key === 'Delete') || (e.ctrlKey && e.key === 'z')) {
                e.preventDefault();
                if (waypoints.length > 0) {
                    const removedIndex = waypoints.length - 1;
                    setWaypoints(prev => prev.slice(0, -1));
                    window.dispatchEvent(new CustomEvent('waypoint:remove', { detail: { index: removedIndex } }));
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [waypoints.length]);

    // Listen for waypoint removal from map popup
    useEffect(() => {
        const onWaypointRemove = (e: any) => {
            const { index } = e.detail;
            if (typeof index === 'number') {
                setWaypoints(prev => prev.filter((_, i) => i !== index));
            }
        };
        
        window.addEventListener('waypoint:remove', onWaypointRemove as EventListener);
        return () => {
            window.removeEventListener('waypoint:remove', onWaypointRemove as EventListener);
        };
    }, []);

    // Listen for tour:edit event to populate form with existing tour data
    useEffect(() => {
        const onTourEdit = (e: any) => {
            const tour = e.detail;
            if (tour && tour.id !== editingTourId) {
                // Only load if it's a different tour (prevent infinite loop)
                console.log('[CreateTourForm] Editing tour:', tour.name, 'waypoints:', tour.waypoints?.length || 0);
                setEditingTourId(tour.id || null);
                setTourName(tour.name || '');
                setDescription(tour.description || '');
                const wps = tour.waypoints || [];
                setWaypoints(wps);
                const rPoints = tour.routePoints || [];
                setRoutePoints(rPoints);
                // Don't load old stats from database - recalculate with new parameters
                setStats({}); // Start with empty stats
                
                // If we have existing routePoints, calculate stats directly from them
                // without triggering routing in MapView
                if (rPoints.length > 0) {
                    setTimeout(async () => {
                        try {
                            const mod = await import('../services/elevationService');
                            const { calculateTrackStats } = mod as any;
                            console.log('[CreateTourForm] Recalculating stats for existing route with', rPoints.length, 'points');
                            const freshStats = await calculateTrackStats(rPoints, {
                                win: 3, k: 0.8, floor: 0.5, cap: 3
                            });
                            console.log('[CreateTourForm] Recalculated stats:', freshStats);
                            setStats(freshStats);
                            window.dispatchEvent(new CustomEvent('tour:stats', { detail: freshStats }));
                            // Also emit the geometry
                            window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: rPoints } }));
                        } catch (err) {
                            console.error('[CreateTourForm] Failed to recalculate stats:', err);
                        }
                    }, 100);
                } else {
                    // No routePoints, let MapView do routing
                    setTimeout(() => {
                        window.dispatchEvent(new CustomEvent('mode:change', { 
                            detail: { mode: 'tour', points: wps, manualMode: false } 
                        }));
                    }, 100);
                }
            }
        };
        
        window.addEventListener('tour:edit', onTourEdit as EventListener);
        return () => {
            window.removeEventListener('tour:edit', onTourEdit as EventListener);
        };
    }, [editingTourId]);

    const handleRemoveWaypoint = (index: number) => {
        setWaypoints(prev => prev.filter((_, i) => i !== index));
        window.dispatchEvent(new CustomEvent('waypoint:remove', { detail: { index } }));
    };

    const handleInsertWaypoint = (afterIndex: number) => {
        console.log(`[CreateTourForm] 🔵 handleInsertWaypoint called with afterIndex=${afterIndex}, current waypoints=${waypoints.length}`);
        
        // Calculate midpoint between current waypoint and next one
        if (afterIndex >= waypoints.length - 1) {
            console.log('[CreateTourForm] ❌ Cannot insert after last waypoint');
            return;
        }
        
        const current = waypoints[afterIndex];
        const next = waypoints[afterIndex + 1];
        
        if (!current || !next) {
            console.log('[CreateTourForm] ❌ Invalid waypoints at indices', afterIndex, afterIndex + 1);
            return;
        }
        
        const midpoint = {
            lat: (current.lat + next.lat) / 2,
            lng: (current.lng + next.lng) / 2
        };
        
        console.log(`[CreateTourForm] ✅ Inserting waypoint at [${midpoint.lat.toFixed(5)}, ${midpoint.lng.toFixed(5)}] between indices ${afterIndex} and ${afterIndex + 1}`);
        console.log(`[CreateTourForm] 📊 Waypoints count: ${waypoints.length} → ${waypoints.length + 1}`);
        
        const newWaypoints = [
            ...waypoints.slice(0, afterIndex + 1),
            midpoint,
            ...waypoints.slice(afterIndex + 1)
        ];
        
        console.log(`[CreateTourForm] 📝 New waypoints array created with ${newWaypoints.length} elements`);
        
        setWaypoints(newWaypoints);
        
        // Force immediate notification to map
        setTimeout(() => {
            console.log('[CreateTourForm] 📤 Notifying map of waypoint change');
            window.dispatchEvent(new CustomEvent('mode:change', { 
                detail: { mode: 'tour', points: newWaypoints, manualMode } 
            }));
        }, 0);
    };

    const handleMoveUp = (index: number) => {
        if (index === 0) return;
        const newOrder = [...waypoints];
        [newOrder[index - 1], newOrder[index]] = [newOrder[index], newOrder[index - 1]];
        setWaypoints(newOrder);
    };

    const handleMoveDown = (index: number) => {
        if (index === waypoints.length - 1) return;
        const newOrder = [...waypoints];
        [newOrder[index], newOrder[index + 1]] = [newOrder[index + 1], newOrder[index]];
        setWaypoints(newOrder);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!tourName.trim()) {
            alert('Inserisci un nome per il tour');
            return;
        }

        if (waypoints.length < 2) {
            alert('Aggiungi almeno due punti (partenza e arrivo)');
            return;
        }

        // Use routePoints if available (from routing), otherwise use waypoints
        const tourPoints = routePoints.length > 0 ? routePoints : waypoints;

        const tour = {
            name: tourName.trim(),
            description: description.trim(),
            tracks: [],
            waypoints: waypoints, // Save original waypoints
            routePoints: tourPoints, // Save computed route
            totalLength: stats.length ? Math.round(stats.length * 10) / 10 : undefined,
            totalElevationGain: stats.elevationGain ? Math.round(stats.elevationGain) : undefined,
            totalElevationLoss: stats.elevationLoss ? Math.round(stats.elevationLoss) : undefined
        };

        // If editing, update the existing tour
        if (editingTourId) {
            const updatedTour = updateTour(editingTourId, tour);
            if (updatedTour) {
                window.dispatchEvent(new CustomEvent('tours:updated', { detail: updatedTour }));
                alert('Tour aggiornato!');
                
                // Stay in edit mode - don't reset form or call onCancel
                // Just keep the current state so user can continue editing
                console.log('[CreateTourForm] Tour aggiornato, rimango in modalità edit');
            } else {
                alert('Errore: non puoi modificare questo tour o il tour non esiste.');
                return;
            }
        } else {
            // Create new tour
            onSave(tour);
            
            // Reload page after successful tour creation
            console.log('[CreateTourForm] Tour creato, ricaricamento pagina...');
            window.location.reload();
            return; // Exit early, no need to reset form or call onCancel
        }
    };

    const handleCancel = () => {
        console.log('[CreateTourForm] handleCancel: exiting tour mode and clearing map');
        
        // Clear all elevation and stats data in the UI
        window.dispatchEvent(new CustomEvent('tour:stats', { detail: {} }));
        window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: [] } }));
        window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile: [] } }));
        
        // Exit tour mode by setting mode to explore with no points
        window.dispatchEvent(new CustomEvent('mode:change', {
            detail: { mode: 'explore', points: [] }
        }));
        
        // Also dispatch tour:clear for good measure
        window.dispatchEvent(new CustomEvent('tour:clear'));
        
        // Call the original onCancel
        onCancel();
    };

    // Listen for computed stats and geometry from the map
    useEffect(() => {
        const onStats = (e: any) => {
            console.log('[CreateTourForm] Received tour:stats', e.detail);
            setStats(e.detail || {});
            setLoadingElevation(false); // Stats received, stop loading
        };
        const onGeom = (e: any) => {
            console.log('[CreateTourForm] Received tour:geometry', e.detail);
            setRoutePoints((e.detail?.points || []) as { lat: number; lng: number }[]);
            setLoadingElevation(true); // Start loading elevation data
        };
        const onElevationProfile = (e: any) => {
            console.log('[CreateTourForm] Received tour:elevation-profile', e.detail);
            const profile = (e.detail?.profile || []) as { distance: number; elevation: number }[];
            console.log('[CreateTourForm] Profile data:', profile);
            setElevationProfile(profile);
            setLoadingElevation(false);
        };
        window.addEventListener('tour:stats', onStats as EventListener);
        window.addEventListener('tour:geometry', onGeom as EventListener);
        window.addEventListener('tour:elevation-profile', onElevationProfile as EventListener);
        return () => {
            window.removeEventListener('tour:stats', onStats as EventListener);
            window.removeEventListener('tour:geometry', onGeom as EventListener);
            window.removeEventListener('tour:elevation-profile', onElevationProfile as EventListener);
        };
    }, []);

    const handleClearWaypoints = () => {
            console.log('[CreateTourForm] handleClearWaypoints: clearing waypoints and map');
        
            // First dispatch mode:change to reset map state
            window.dispatchEvent(new CustomEvent('mode:change', {
                detail: { mode: 'tour', points: [] }
            }));
        
            // Then dispatch tour:clear to remove any existing lines/markers
            window.dispatchEvent(new CustomEvent('tour:clear'));
        
            // Finally clear the waypoints in the form state
            setWaypoints([]);
        };

    const handleUndoLast = () => {
        if (waypoints.length === 0) return;
        const idx = waypoints.length - 1;
        setWaypoints(prev => prev.slice(0, -1));
        window.dispatchEvent(new CustomEvent('waypoint:remove', { detail: { index: idx } }));
        // If we just cleared everything, also emit explicit clear events for safety
        if (waypoints.length === 1) {
            window.dispatchEvent(new CustomEvent('tour:geometry', { detail: { points: [] } }));
            window.dispatchEvent(new CustomEvent('tour:stats', { detail: {} }));
            window.dispatchEvent(new CustomEvent('tour:elevation-profile', { detail: { profile: [] } }));
            window.dispatchEvent(new CustomEvent('tour:clear'));
        }
    };

    const handleCloseTour = () => {
        if (waypoints.length < 2) {
            alert('Aggiungi almeno due punti prima di chiudere il tour');
            return;
        }
        const first = waypoints[0];
        const last = waypoints[waypoints.length - 1];
        
        // Check if already closed
        if (first.lat === last.lat && first.lng === last.lng) {
            alert('Il tour è già chiuso!');
            return;
        }
        
        setWaypoints(prev => [...prev, first]);
    };

    const downloadGPX = () => {
        if (routePoints.length === 0) {
            alert('Calcola prima un percorso (aggiungi almeno due punti).');
            return;
        }
        const gpxHeader = `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Singletrack" xmlns="http://www.topografix.com/GPX/1/1">`;
        const name = tourName || 'Tour';
        const meta = `<trk><name>${name}</name><trkseg>`;
        const seg = routePoints.map(p => `<trkpt lat="${p.lat}" lon="${p.lng}"></trkpt>`).join('');
        const footer = `</trkseg></trk></gpx>`;
        const gpx = `${gpxHeader}${meta}${seg}${footer}`;
        const blob = new Blob([gpx], { type: 'application/gpx+xml' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${name.replace(/\s+/g, '_').toLowerCase()}.gpx`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);
    };

    return (
        <div className="create-tour-form">
            {/* Render stats panel at bottom of page using portal */}
            {ReactDOM.createPortal(
                <TourStatsPanel
                    stats={stats}
                    elevationProfile={elevationProfile}
                    loadingElevation={loadingElevation}
                    routePoints={routePoints}
                />,
                document.body
            )}

            <h2>🚵 Crea Tour</h2>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Nome Tour *</label>
                    <input
                        type="text"
                        value={tourName}
                        onChange={(e) => setTourName(e.target.value)}
                        placeholder="Es: Giro delle Tre Valli"
                        required
                    />
                </div>

                <div className="form-group">
                    <label>Descrizione</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Descrivi il tour, difficoltà, punti di interesse..."
                        rows={3}
                        maxLength={300}
                    />
                    <p className="char-count">{description.length}/300 caratteri</p>
                </div>

                <div className="tour-selection-section">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ margin: 0 }}>Waypoints</h4>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', cursor: 'pointer' }}>
                            <input 
                                type="checkbox" 
                                checked={manualMode} 
                                onChange={(e) => setManualMode(e.target.checked)}
                                style={{ cursor: 'pointer' }}
                            />
                            <span>Modalità manuale</span>
                        </label>
                    </div>
                    {manualMode && (
                        <div style={{ 
                            padding: '8px 12px', 
                            background: 'rgba(52, 152, 219, 0.1)', 
                            border: '1px solid rgba(52, 152, 219, 0.3)',
                            borderRadius: '6px',
                            fontSize: '12px',
                            marginBottom: '12px',
                            color: 'rgba(255, 255, 255, 0.8)'
                        }}>
                            ℹ️ Modalità manuale attiva: i punti saranno collegati con linee dirette senza seguire le strade
                        </div>
                    )}
                    {waypoints.length === 0 ? (
                        <div className="no-tracks-selected">
                            <p>📍 Clicca sulla mappa per aggiungere: Partenza, punti intermedi e Arrivo</p>
                            <p className="hint">Suggerimento: puoi riordinare o rimuovere i punti sotto</p>
                        </div>
                    ) : (
                        <div className="selected-tracks-list">
                            {waypoints.map((wp, index) => (
                                <div key={`wp-${index}`}>
                                    <div className="selected-track-item">
                                        <div className="track-order">{index + 1}</div>
                                        <div className="track-details">
                                            <div className="track-name">{index === 0 ? 'Partenza' : index === waypoints.length - 1 ? 'Arrivo' : `Punto ${index + 1}`}</div>
                                            <div className="track-meta">{wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}</div>
                                        </div>
                                        <div className="track-controls">
                                            <button type="button" onClick={() => handleMoveUp(index)} disabled={index === 0} className="btn-move" title="Sposta su">▲</button>
                                            <button type="button" onClick={() => handleMoveDown(index)} disabled={index === waypoints.length - 1} className="btn-move" title="Sposta giù">▼</button>
                                            <button type="button" onClick={() => handleRemoveWaypoint(index)} className="btn-remove" title="Rimuovi">✕</button>
                                        </div>
                                    </div>
                                    {index < waypoints.length - 1 && (
                                        <div style={{ 
                                            display: 'flex', 
                                            justifyContent: 'center', 
                                            margin: '4px 0',
                                            opacity: 1
                                        }}>
                                            <button 
                                                type="button" 
                                                onClick={(e) => {
                                                    console.log(`[CreateTourForm] 🖱️ Button clicked for index ${index}`);
                                                    // Visual feedback
                                                    e.currentTarget.style.background = 'rgba(46, 204, 113, 0.5)';
                                                    e.currentTarget.textContent = '✓ Inserito!';
                                                    setTimeout(() => {
                                                        e.currentTarget.style.background = 'rgba(52, 152, 219, 0.3)';
                                                        e.currentTarget.textContent = '➕ Inserisci punto';
                                                    }, 500);
                                                    handleInsertWaypoint(index);
                                                }}
                                                className="btn-move"
                                                style={{ 
                                                    fontSize: '11px',
                                                    padding: '5px 14px',
                                                    background: 'rgba(52, 152, 219, 0.3)',
                                                    border: '1px solid rgba(52, 152, 219, 0.6)',
                                                    color: 'rgba(255, 255, 255, 0.95)',
                                                    fontWeight: '500',
                                                    transition: 'all 0.2s'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.background = 'rgba(52, 152, 219, 0.5)';
                                                    e.currentTarget.style.borderColor = 'rgba(52, 152, 219, 0.8)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.background = 'rgba(52, 152, 219, 0.3)';
                                                    e.currentTarget.style.borderColor = 'rgba(52, 152, 219, 0.6)';
                                                }}
                                                title="Inserisci un nuovo waypoint tra questo e il successivo (puoi cliccare più volte per aggiungere più punti)"
                                            >
                                                ➕ Inserisci punto
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button type="button" className="btn-cancel" onClick={handleCancel}>Annulla</button>
                    <button
                        type="button"
                        className="btn-submit"
                        onClick={handleUndoLast}
                        disabled={waypoints.length === 0}
                        title="Rimuove l'ultimo punto aggiunto"
                    >↩️ Annulla ultimo punto</button>
                    <button type="button" className="btn-submit" onClick={handleClearWaypoints}>Pulisci punti</button>
                    {waypoints.length >= 2 && (
                        <button type="button" className="btn-submit" onClick={handleCloseTour} title="Torna al punto di partenza">🔄 Chiudi Tour</button>
                    )}
                    <button type="button" className="btn-submit" onClick={downloadGPX}>Esporta GPX</button>
                    <button type="submit" className="btn-submit">{editingTourId ? 'Aggiorna Tour' : 'Crea Tour'}</button>
                </div>
            </form>
        </div>
    );
}
