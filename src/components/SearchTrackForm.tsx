import React, { useState, useEffect } from 'react';
import { getTracks, SavedTrack, getAverageRating, getDifficultyColor } from '../services/trackStorage';

interface SearchTrackFormProps {
    // No props needed for now
}

export default function SearchTrackForm({}: SearchTrackFormProps) {
    const [searchName, setSearchName] = useState<string>('');
    const [searchDifficulty, setSearchDifficulty] = useState<string>('all');
    const [searchMinRating, setSearchMinRating] = useState<number>(0);
    const [allTracks, setAllTracks] = useState<SavedTrack[]>([]);
    const [filteredTracks, setFilteredTracks] = useState<SavedTrack[]>([]);
    const [mapBounds, setMapBounds] = useState<any>(null);

    // Load all tracks on mount and when tracks are added
    useEffect(() => {
        const loadTracks = () => {
            const tracks = getTracks();
            setAllTracks(tracks);
        };
        
        loadTracks();
        
        const onTrackAdded = () => loadTracks();
        const onReviewAdded = () => loadTracks();
        const onTracksUpdated = () => loadTracks();
        
        window.addEventListener('track:added', onTrackAdded as EventListener);
        window.addEventListener('review:added', onReviewAdded as EventListener);
        window.addEventListener('tracks:updated', onTracksUpdated as EventListener);
        
        return () => {
            window.removeEventListener('track:added', onTrackAdded as EventListener);
            window.removeEventListener('review:added', onReviewAdded as EventListener);
            window.removeEventListener('tracks:updated', onTracksUpdated as EventListener);
        };
    }, []);

    // Listen for map bounds changes
    useEffect(() => {
        const onMapBoundsChange = (e: any) => {
            console.log('[SearchTrackForm] Received map bounds:', e.detail);
            setMapBounds(e.detail);
        };
        
        window.addEventListener('map:bounds-change', onMapBoundsChange as EventListener);
        
        // Request current bounds immediately
        console.log('[SearchTrackForm] Requesting initial map bounds');
        window.dispatchEvent(new CustomEvent('map:request-bounds'));
        
        // Request again after a delay to ensure map is ready
        const timeout = setTimeout(() => {
            console.log('[SearchTrackForm] Requesting bounds again after delay');
            window.dispatchEvent(new CustomEvent('map:request-bounds'));
        }, 1000);
        
        return () => {
            window.removeEventListener('map:bounds-change', onMapBoundsChange as EventListener);
            clearTimeout(timeout);
        };
    }, []);

    // Apply filters whenever search criteria change
    useEffect(() => {
        console.log('[SearchTrackForm] Applying filters. MapBounds:', mapBounds, 'AllTracks:', allTracks.length);
        let results = [...allTracks];

        // Filter by map bounds (only show tracks visible in current map view)
        if (mapBounds) {
            const beforeCount = results.length;
            results = results.filter(track => {
                if (!track.points || track.points.length === 0) return false;
                
                // Check if any point of the track is within map bounds
                const isVisible = track.points.some(point => {
                    const lat = point.lat;
                    const lng = point.lng;
                    return lat >= mapBounds.south && 
                           lat <= mapBounds.north && 
                           lng >= mapBounds.west && 
                           lng <= mapBounds.east;
                });
                return isVisible;
            });
            console.log(`[SearchTrackForm] Bounds filter: ${beforeCount} -> ${results.length} tracks (bounds: N:${mapBounds.north.toFixed(2)} S:${mapBounds.south.toFixed(2)} E:${mapBounds.east.toFixed(2)} W:${mapBounds.west.toFixed(2)})`);
        } else {
            console.log('[SearchTrackForm] No map bounds yet, showing all tracks');
        }

        // Filter by name
        if (searchName.trim()) {
            const nameLower = searchName.toLowerCase();
            results = results.filter(t => 
                t.name.toLowerCase().includes(nameLower) ||
                (t.description && t.description.toLowerCase().includes(nameLower))
            );
        }

        // Filter by difficulty
        if (searchDifficulty !== 'all') {
            results = results.filter(t => t.difficulty === searchDifficulty);
        }

        // Filter by minimum rating
        if (searchMinRating > 0) {
            results = results.filter(t => {
                const avgRating = getAverageRating(t.id);
                return avgRating >= searchMinRating;
            });
        }

        setFilteredTracks(results);
    }, [searchName, searchDifficulty, searchMinRating, allTracks, mapBounds]);

    const handleTrackClick = (track: SavedTrack) => {
        // Dispatch event to center map on track and show it
        window.dispatchEvent(new CustomEvent('track:focus', { detail: track }));
    };

    const handleReset = () => {
        setSearchName('');
        setSearchDifficulty('all');
        setSearchMinRating(0);
    };

    return (
        <div className="search-track-form">
            <h3>🔍 Cerca Singletrack</h3>

            <div className="search-filters">
                <div className="form-group">
                    <label>Nome o descrizione</label>
                    <input
                        type="text"
                        value={searchName}
                        onChange={(e) => setSearchName(e.target.value)}
                        placeholder="Cerca per nome..."
                    />
                </div>

                <div className="form-group">
                    <label>Difficoltà</label>
                    <select
                        value={searchDifficulty}
                        onChange={(e) => setSearchDifficulty(e.target.value)}
                        className="trail-condition-select"
                    >
                        <option value="all">Tutte</option>
                        <option value="facile">🟢 Facile</option>
                        <option value="medio">🔵 Medio</option>
                        <option value="difficile">🔴 Difficile</option>
                        <option value="estremo">⚫ Estremo</option>
                        <option value="ebike-climb">🟣 E-bike Climb</option>
                    </select>
                </div>

                <div className="form-group">
                    <label>Valutazione minima: {searchMinRating}/10</label>
                    <input
                        type="range"
                        min="0"
                        max="10"
                        step="1"
                        value={searchMinRating}
                        onChange={(e) => setSearchMinRating(parseInt(e.target.value))}
                        className="rating-slider"
                    />
                    <div className="rating-labels">
                        <span>0</span>
                        <span>5</span>
                        <span>10</span>
                    </div>
                </div>

                <button 
                    type="button" 
                    className="btn-submit" 
                    onClick={handleReset}
                    style={{ width: '100%', marginTop: '8px' }}
                >
                    🔄 Resetta filtri
                </button>
            </div>

            <div className="search-results">
                <div className="search-results-header">
                    <h4>Risultati ({filteredTracks.length})</h4>
                </div>

                {filteredTracks.length === 0 ? (
                    <div className="no-results">
                        <p>😔 Nessun singletrack trovato</p>
                        <p className="hint">Prova a modificare i filtri di ricerca</p>
                    </div>
                ) : (
                    <div className="track-results-list">
                        {filteredTracks.map((track) => {
                            const avgRating = getAverageRating(track.id);
                            const diffColor = getDifficultyColor(track.difficulty);
                            const ratingStyle: React.CSSProperties = {
                                background: diffColor,
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: 4,
                                fontSize: 12,
                                fontWeight: 600,
                                whiteSpace: 'nowrap',
                                marginLeft: 8
                            };
                            const difficultyStyle: React.CSSProperties = {
                                background: diffColor,
                                color: '#fff'
                            };
                            const terrainStyle: React.CSSProperties = {
                                background: '#f1c40f', // giallo
                                color: '#1a1a2e'
                            };
                            const lengthStyle: React.CSSProperties = {
                                background: '#9b59b6', // lilla
                                color: '#fff'
                            };
                            return (
                                <div 
                                    key={track.id} 
                                    className="track-result-item"
                                    onClick={() => handleTrackClick(track)}
                                >
                                    <div className="track-result-header">
                                        <h5 className="track-result-name">{track.name}</h5>
                                        {avgRating > 0 && (
                                            <div className="track-result-rating" style={ratingStyle}>
                                                ⭐ {avgRating.toFixed(1)}
                                            </div>
                                        )}
                                    </div>
                                    <div className="track-result-details">
                                        <span className="track-badge difficulty-badge" style={difficultyStyle}>
                                            {track.difficulty}
                                        </span>
                                        <span className="track-badge terrain-badge" style={terrainStyle}>
                                            {track.terrain}
                                        </span>
                                        {track.length && (
                                            <span className="track-badge length-badge" style={lengthStyle}>
                                                {track.length} km
                                            </span>
                                        )}
                                    </div>
                                    {track.description && (
                                        <p className="track-result-description">
                                            {track.description.length > 100 
                                                ? track.description.substring(0, 100) + '...' 
                                                : track.description
                                            }
                                        </p>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
