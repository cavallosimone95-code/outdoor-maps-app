import React, { useState, useEffect } from 'react';
import { parseGPXFile, GPXParseOptions } from '../utils/gpxParser';
import { calculateTrackStats } from '../services/elevationService';

interface TrackPoint {
    lat: number;
    lng: number;
}

interface CreateTrackFormProps {
    points: TrackPoint[];
    onCancel: () => void;
    onSave: (data: TrackData) => void;
    onClearLastPoint: () => void;
    onGPXLoad: (points: TrackPoint[], metadata: { name?: string; description?: string; distance?: number }) => void;
}

export interface TrackData {
    name: string;
    difficulty: 'facile' | 'medio' | 'difficile' | 'estremo' | 'ebike-climb';
    terrain: string;
    length?: number;
    duration?: number;
    description?: string;
    points: TrackPoint[];
    elevationGain?: number;
    elevationLoss?: number;
    lastReview?: string; // Data dell'ultima recensione
}

type CreationMode = 'manual' | 'gpx';
type SimplificationLevel = 'high' | 'medium' | 'low' | 'none';

export default function CreateTrackForm({ points, onCancel, onSave, onClearLastPoint, onGPXLoad }: CreateTrackFormProps) {
    const [mode, setMode] = useState<CreationMode>('manual');
    const [simplificationLevel, setSimplificationLevel] = useState<SimplificationLevel>('medium');
    const [gpxPoints, setGpxPoints] = useState<TrackPoint[]>([]); // Store all GPX points
    const [startIndex, setStartIndex] = useState<number>(0);
    const [endIndex, setEndIndex] = useState<number>(0);
    const [historyStack, setHistoryStack] = useState<{ points: TrackPoint[]; start: number; end: number }[]>([]);
    const [isCalculating, setIsCalculating] = useState<boolean>(false);
    const [formData, setFormData] = useState<Omit<TrackData, 'points'>>({
        name: '',
        difficulty: 'medio',
        terrain: '',
        length: undefined,
        duration: undefined,
        description: '',
        elevationGain: undefined,
        elevationLoss: undefined,
    });

    // Auto-calculate stats when points change
    useEffect(() => {
        if (points.length >= 2) {
            calculateStats();
        }
    }, [points]);

    // Listen for keyboard shortcuts to remove last point
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Only handle if not typing in an input/textarea
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }
            
            // Backspace or Delete removes last point (Ctrl+Z also works)
            if ((e.key === 'Backspace' || e.key === 'Delete') || (e.ctrlKey && e.key === 'z')) {
                e.preventDefault();
                if (points.length > 0 && mode === 'manual') {
                    onClearLastPoint();
                }
            }
        };
        
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [points.length, mode, onClearLastPoint]);

    // Listen for waypoint removal from map popup
    useEffect(() => {
        const onWaypointRemove = (e: any) => {
            const { index } = e.detail;
            if (typeof index === 'number' && mode === 'manual') {
                // For create track mode, we need to handle point removal differently
                // since we don't have direct access to points array
                // We'll dispatch an event that Sidebar can listen to
                window.dispatchEvent(new CustomEvent('track:point-remove', { detail: { index } }));
            }
        };
        
        window.addEventListener('waypoint:remove', onWaypointRemove as EventListener);
        return () => {
            window.removeEventListener('waypoint:remove', onWaypointRemove as EventListener);
        };
    }, [mode]);

    const calculateStats = async () => {
        if (points.length < 2) return;
        
        setIsCalculating(true);
        try {
            const stats = await calculateTrackStats(points);
            setFormData(prev => ({
                ...prev,
                length: stats.length,
                elevationGain: stats.elevationGain,
                elevationLoss: stats.elevationLoss
            }));
        } catch (error) {
            console.error('Error calculating stats:', error);
        } finally {
            setIsCalculating(false);
        }
    };

    // Calculate stats for an arbitrary set of points (used after GPX crop/undo)
    const calculateStatsFor = async (pts: TrackPoint[]) => {
        if (pts.length < 2) return;
        setIsCalculating(true);
        try {
            const stats = await calculateTrackStats(pts);
            setFormData(prev => ({
                ...prev,
                length: stats.length,
                elevationGain: stats.elevationGain,
                elevationLoss: stats.elevationLoss
            }));
        } catch (error) {
            console.error('Error calculating stats (custom points):', error);
        } finally {
            setIsCalculating(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            alert('Inserisci un nome per il singletrack');
            return;
        }
        if (points.length < 2) {
            alert('Devi selezionare almeno 2 punti sulla mappa');
            return;
        }
        onSave({ ...formData, points });
    };

    const handleChange = (field: keyof Omit<TrackData, 'points'>, value: any) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleGPXUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            const content = await file.text();
            
            // Configure simplification based on level
            const options: GPXParseOptions = {};
            switch (simplificationLevel) {
                case 'high':
                    options.tolerance = 20; // More aggressive simplification
                    options.maxPoints = 200;
                    break;
                case 'medium':
                    options.tolerance = 10; // Balanced
                    options.maxPoints = 500;
                    break;
                case 'low':
                    options.tolerance = 5; // Light simplification
                    options.maxPoints = 1000;
                    break;
                case 'none':
                    options.simplify = false; // No simplification
                    break;
            }
            
            const gpxData = parseGPXFile(content, options);
            
            // Store all GPX points for segment selection
            setGpxPoints(gpxData.points);
            setStartIndex(0);
            setEndIndex(gpxData.points.length - 1);
            
            // Load points from GPX
            onGPXLoad(gpxData.points, {
                name: gpxData.name,
                description: gpxData.description,
                distance: gpxData.distance
            });
            
            // Pre-fill form with GPX metadata
            setFormData(prev => ({
                ...prev,
                name: gpxData.name || prev.name,
                description: gpxData.description || prev.description,
                length: gpxData.distance || prev.length
            }));
            
            alert(`GPX caricato con successo!\n${gpxData.points.length} punti importati${gpxData.distance ? `\nDistanza: ${gpxData.distance} km` : ''}`);
        } catch (error) {
            alert(`Errore nel caricamento del file GPX: ${error instanceof Error ? error.message : 'File non valido'}`);
        }
        
        // Reset file input
        e.target.value = '';
    };

    const handleSegmentSelection = () => {
        if (gpxPoints.length === 0) return;
        
        // Save current state to history
        setHistoryStack(prev => [...prev, { 
            points: gpxPoints, 
            start: startIndex, 
            end: endIndex 
        }]);
        
        // Extract segment between start and end indices
        const segmentPoints = gpxPoints.slice(startIndex, endIndex + 1);
        
        // Clear the preview and show only the selected segment
        window.dispatchEvent(new CustomEvent('segment:applied', {
            detail: { points: segmentPoints }
        }));
        
        // Update the displayed track on the map
        onGPXLoad(segmentPoints, {
            name: formData.name,
            description: formData.description,
        });
        
        // Recalculate stats immediately for the selected segment
        calculateStatsFor(segmentPoints);

        // Update gpxPoints to the new segment
        setGpxPoints(segmentPoints);
        setStartIndex(0);
        setEndIndex(segmentPoints.length - 1);
        
        alert(`Segmento selezionato: ${segmentPoints.length} punti (dal punto ${startIndex + 1} al punto ${endIndex + 1})`);
    };

    const handleUndo = () => {
        if (historyStack.length === 0) return;
        
        const lastState = historyStack[historyStack.length - 1];
        setHistoryStack(prev => prev.slice(0, -1));
        
        setGpxPoints(lastState.points);
        setStartIndex(lastState.start);
        setEndIndex(lastState.end);
        
        // Update the displayed track on the map
        onGPXLoad(lastState.points, {
            name: formData.name,
            description: formData.description,
        });

        // Recalculate stats for the restored segment
        calculateStatsFor(lastState.points);
        
        alert('Ultima modifica annullata');
    };

    const handleStartIndexChange = (newStart: number) => {
        setStartIndex(newStart);
        if (newStart >= endIndex) {
            setEndIndex(newStart + 1);
        }
        
        // Update preview on map with highlighted points
        updateSegmentPreview(newStart, newStart >= endIndex ? newStart + 1 : endIndex);
    };

    const handleEndIndexChange = (newEnd: number) => {
        setEndIndex(newEnd);
        
        // Update preview on map with highlighted points
        updateSegmentPreview(startIndex, newEnd);
    };

    const updateSegmentPreview = (start: number, end: number) => {
        // Dispatch event to highlight the segment on the map
        window.dispatchEvent(new CustomEvent('segment:preview', {
            detail: {
                allPoints: gpxPoints,
                startIndex: start,
                endIndex: end
            }
        }));
    };

    return (
        <div className="create-track-form">
            <h3>Crea Nuovo Singletrack</h3>
            
            {/* Mode selector */}
            <div className="mode-selector">
                <button
                    type="button"
                    className={`mode-btn ${mode === 'manual' ? 'active' : ''}`}
                    onClick={() => setMode('manual')}
                >
                    ✏️ Manuale
                </button>
                <button
                    type="button"
                    className={`mode-btn ${mode === 'gpx' ? 'active' : ''}`}
                    onClick={() => setMode('gpx')}
                >
                    📁 Carica GPX
                </button>
            </div>

            {/* GPX Upload section */}
            {mode === 'gpx' && (
                <div className="gpx-upload-section">
                    <div className="simplification-selector">
                        <label>Livello di semplificazione:</label>
                        <select 
                            value={simplificationLevel} 
                            onChange={(e) => setSimplificationLevel(e.target.value as SimplificationLevel)}
                            className="simplification-select"
                        >
                            <option value="high">🟢 Alta (≈200 punti, veloce)</option>
                            <option value="medium">🟡 Media (≈500 punti, consigliato)</option>
                            <option value="low">🟠 Bassa (≈1000 punti, dettagliato)</option>
                            <option value="none">🔴 Nessuna (tutti i punti, lento)</option>
                        </select>
                        <p className="simplification-hint">
                            Una semplificazione più alta riduce i punti e migliora le prestazioni
                        </p>
                    </div>
                    
                    <label className="gpx-upload-label">
                        <input
                            type="file"
                            accept=".gpx"
                            onChange={handleGPXUpload}
                            style={{ display: 'none' }}
                        />
                        <div className="gpx-upload-box">
                            <div className="upload-icon">📂</div>
                            <div className="upload-text">
                                <strong>Clicca per selezionare un file GPX</strong>
                                <p>oppure trascina qui il file</p>
                            </div>
                        </div>
                    </label>
                </div>
            )}
            
            {/* Segment selector for GPX */}
            {mode === 'gpx' && gpxPoints.length > 0 && (
                <div className="segment-selector">
                    <div className="segment-header">
                        <h4>Seleziona Segmento del Tracciato</h4>
                        {historyStack.length > 0 && (
                            <button
                                type="button"
                                className="btn-undo"
                                onClick={handleUndo}
                                title="Annulla ultima modifica"
                            >
                                ↶ Annulla
                            </button>
                        )}
                    </div>
                    <p className="segment-info">
                        Totale punti caricati: <strong>{gpxPoints.length}</strong>
                    </p>
                    
                    <div className="segment-controls">
                        <div className="form-group">
                            <label>🟢 Punto di partenza:</label>
                            <input
                                type="range"
                                min="0"
                                max={Math.max(0, gpxPoints.length - 2)}
                                value={startIndex}
                                onChange={(e) => handleStartIndexChange(parseInt(e.target.value))}
                                className="segment-slider"
                            />
                            <span className="segment-label">Punto {startIndex + 1} di {gpxPoints.length}</span>
                        </div>
                        
                        <div className="form-group">
                            <label>🏁 Punto di arrivo:</label>
                            <input
                                type="range"
                                min={Math.min(startIndex + 1, gpxPoints.length - 1)}
                                max={gpxPoints.length - 1}
                                value={endIndex}
                                onChange={(e) => handleEndIndexChange(parseInt(e.target.value))}
                                className="segment-slider"
                            />
                            <span className="segment-label">Punto {endIndex + 1} di {gpxPoints.length}</span>
                        </div>
                    </div>
                    
                    <div className="segment-summary">
                        <p>Punti selezionati: <strong>{endIndex - startIndex + 1}</strong></p>
                        <button 
                            type="button" 
                            className="btn-apply-segment"
                            onClick={handleSegmentSelection}
                        >
                            ✂️ Applica Selezione
                        </button>
                    </div>
                </div>
            )}
            
            {/* Track points info (for manual mode or after GPX load) */}
            {(mode === 'manual' || points.length > 0) && (
                <div className="track-points-info">
                <div className="points-header">
                    <span className="points-count">📍 Punti: {points.length}</span>
                    {points.length > 0 && (
                        <button 
                            type="button" 
                            className="btn-clear-point"
                            onClick={onClearLastPoint}
                            title="Rimuovi ultimo punto"
                        >
                            ↶ Annulla
                        </button>
                    )}
                </div>
                
                {points.map((point, idx) => (
                    <div key={idx} className="point-info">
                        <span className="point-label">
                            {idx === 0 ? '🟢 Partenza:' : 
                             idx === points.length - 1 ? '🏁 Arrivo:' : 
                             `⚪ Punto ${idx}:`}
                        </span>
                        <span className="point-coords">
                            {point.lat.toFixed(5)}, {point.lng.toFixed(5)}
                        </span>
                    </div>
                ))}
            </div>
            )}

            {points.length >= 2 ? (
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label>Nome Singletrack *</label>
                        <input
                            type="text"
                            value={formData.name}
                            onChange={(e) => handleChange('name', e.target.value)}
                            placeholder="Es: Ridge Trail"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Difficoltà *</label>
                        <select
                            value={formData.difficulty}
                            onChange={(e) => handleChange('difficulty', e.target.value)}
                        >
                            <option value="facile">🟢 Facile</option>
                            <option value="medio">🔵 Medio</option>
                            <option value="difficile">🔴 Difficile</option>
                            <option value="estremo">⚫ Estremo</option>
                            <option value="ebike-climb">🟣 E-bike Climb</option>
                        </select>
                    </div>

                    <div className="form-group">
                        <label>Tipo di Terreno *</label>
                        <input
                            type="text"
                            value={formData.terrain}
                            onChange={(e) => handleChange('terrain', e.target.value)}
                            placeholder="Es: Sterrato, roccioso, tecnico"
                            required
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Lunghezza (km) {isCalculating && '⏳'}</label>
                            <input
                                type="number"
                                step="0.1"
                                value={formData.length || ''}
                                onChange={(e) => handleChange('length', e.target.value ? parseFloat(e.target.value) : undefined)}
                                placeholder="Auto-calcolato"
                                disabled={isCalculating}
                            />
                        </div>

                        <div className="form-group">
                            <label>Durata (min)</label>
                            <input
                                type="number"
                                value={formData.duration || ''}
                                onChange={(e) => handleChange('duration', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="45"
                            />
                        </div>
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Dislivello + (m) {isCalculating && '⏳'}</label>
                            <input
                                type="number"
                                value={formData.elevationGain || ''}
                                onChange={(e) => handleChange('elevationGain', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="Auto-calcolato"
                                disabled={isCalculating}
                            />
                        </div>

                        <div className="form-group">
                            <label>Dislivello - (m) {isCalculating && '⏳'}</label>
                            <input
                                type="number"
                                value={formData.elevationLoss || ''}
                                onChange={(e) => handleChange('elevationLoss', e.target.value ? parseInt(e.target.value) : undefined)}
                                placeholder="Auto-calcolato"
                                disabled={isCalculating}
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Descrizione</label>
                        <textarea
                            value={formData.description}
                            onChange={(e) => handleChange('description', e.target.value)}
                            placeholder="Descrivi il percorso, punti di interesse, consigli..."
                            rows={4}
                        />
                    </div>

                    <div className="form-actions">
                        <button type="button" className="btn-cancel" onClick={onCancel}>
                            Annulla
                        </button>
                        <button type="submit" className="btn-submit">
                            Salva Singletrack
                        </button>
                    </div>
                </form>
            ) : mode === 'manual' ? (
                <div className="instruction">
                    <p>👆 Clicca sulla mappa per tracciare il percorso:</p>
                    <ol>
                        <li>{points.length >= 1 ? '✅' : '⭕'} Punto di partenza</li>
                        <li>{points.length >= 2 ? '✅' : '⭕'} Punto di arrivo (minimo)</li>
                        <li>➕ Aggiungi altri punti intermedi se necessario</li>
                    </ol>
                    <p className="hint">La linea sarà colorata in base alla difficoltà scelta</p>
                </div>
            ) : null}
        </div>
    );
}
