import React, { useState, useEffect } from 'react';

interface POIData {
    name: string;
    description: string;
    type: 'bikeshop' | 'restaurant' | 'fountain' | 'market' | 'sleepnride' | 'viewpoint' | 'parking' | 'campsite' | 'ebike-charging' | 'bike-rental' | 'mtb-guide';
    location: {
        lat: number;
        lng: number;
    };
}

interface AddPOIFormProps {
    onCancel: () => void;
    onSave: (poi: POIData) => void;
}

export default function AddPOIForm({ onCancel, onSave }: AddPOIFormProps) {
    const [poiName, setPoiName] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [poiType, setPoiType] = useState<POIData['type']>('viewpoint');
    const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
    const [isSelectingLocation, setIsSelectingLocation] = useState<boolean>(false);

    // Listen for map clicks when selecting location
    useEffect(() => {
        if (!isSelectingLocation) return;

        const onMapClick = (e: any) => {
            const point = e.detail as { lat: number; lng: number };
            setLocation(point);
            setIsSelectingLocation(false);
            console.log('POI location selected:', point);
        };

        window.addEventListener('map:click', onMapClick as EventListener);
        return () => window.removeEventListener('map:click', onMapClick as EventListener);
    }, [isSelectingLocation]);

    // Notify map about POI selection mode
    useEffect(() => {
        if (isSelectingLocation) {
            window.dispatchEvent(new CustomEvent('mode:change', { 
                detail: { mode: 'select-poi-location', points: [] } 
            }));
        } else {
            window.dispatchEvent(new CustomEvent('mode:change', { 
                detail: { mode: 'explore', points: [] } 
            }));
        }
    }, [isSelectingLocation]);

    const handleStartSelection = () => {
        setIsSelectingLocation(true);
    };

    const handleCancelSelection = () => {
        setIsSelectingLocation(false);
        setLocation(null);
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!poiName.trim()) {
            alert('Inserisci un nome per il punto di interesse');
            return;
        }

        if (!location) {
            alert('Seleziona una posizione sulla mappa');
            return;
        }

        const poi: POIData = {
            name: poiName.trim(),
            description: description.trim(),
            type: poiType,
            location
        };

        onSave(poi);
    };

    const poiTypes: { value: POIData['type']; label: string; icon: string }[] = [
        { value: 'bikeshop', label: 'Ciclofficina', icon: '🔧' },
        { value: 'restaurant', label: 'Bar/Ristorante', icon: '🍴' },
        { value: 'fountain', label: 'Fontana', icon: '💧' },
        { value: 'market', label: 'Market', icon: '🏪' },
        { value: 'sleepnride', label: "Sleep'n'ride", icon: '🏠' },
        { value: 'viewpoint', label: 'Punto panoramico', icon: '📸' },
        { value: 'parking', label: 'Parcheggio', icon: '🅿️' },
        { value: 'campsite', label: 'Campeggio', icon: '⛺' },
        { value: 'ebike-charging', label: 'Punto ricarica E-bike', icon: '🔌' },
        { value: 'bike-rental', label: 'Noleggio bici', icon: '🚲' },
        { value: 'mtb-guide', label: 'Guida MTB', icon: '🧭' },
    ];

    return (
        <div className="add-poi-form">
            <h3>📍 Aggiungi Punto di Interesse</h3>

            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label>Nome *</label>
                    <input
                        type="text"
                        value={poiName}
                        onChange={(e) => setPoiName(e.target.value)}
                        placeholder="Es: Bar Centrale, Fontana del Parco..."
                        required
                        disabled={isSelectingLocation}
                    />
                </div>

                <div className="form-group">
                    <label>Tipo *</label>
                    <select
                        value={poiType}
                        onChange={(e) => setPoiType(e.target.value as POIData['type'])}
                        className="trail-condition-select"
                        disabled={isSelectingLocation}
                    >
                        {poiTypes.map(type => (
                            <option key={type.value} value={type.value}>
                                {type.icon} {type.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="form-group">
                    <label>Descrizione</label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Aggiungi dettagli utili (orari, servizi, ecc)..."
                        rows={3}
                        maxLength={300}
                        disabled={isSelectingLocation}
                    />
                    <p className="char-count">{description.length}/300 caratteri</p>
                </div>

                <div className="form-group">
                    <label>Posizione sulla mappa *</label>
                    {!location ? (
                        isSelectingLocation ? (
                            <div className="instruction">
                                <p>📍 Clicca sulla mappa per selezionare la posizione</p>
                                <button 
                                    type="button" 
                                    className="btn-cancel"
                                    onClick={handleCancelSelection}
                                    style={{ width: '100%', marginTop: '8px' }}
                                >
                                    Annulla selezione
                                </button>
                            </div>
                        ) : (
                            <button 
                                type="button" 
                                className="btn-submit"
                                onClick={handleStartSelection}
                                style={{ width: '100%' }}
                            >
                                📍 Seleziona sulla mappa
                            </button>
                        )
                    ) : (
                        <div className="location-selected">
                            <div className="location-info">
                                <span className="location-label">✅ Posizione selezionata</span>
                                <span className="location-coords">
                                    {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
                                </span>
                            </div>
                            <button 
                                type="button" 
                                className="btn-cancel"
                                onClick={handleCancelSelection}
                                style={{ marginTop: '8px' }}
                            >
                                Cambia posizione
                            </button>
                        </div>
                    )}
                </div>

                <div className="form-actions">
                    <button 
                        type="button" 
                        className="btn-cancel" 
                        onClick={onCancel}
                        disabled={isSelectingLocation}
                    >
                        Annulla
                    </button>
                    <button 
                        type="submit" 
                        className="btn-submit"
                        disabled={isSelectingLocation}
                    >
                        💾 Salva POI
                    </button>
                </div>
            </form>
        </div>
    );
}
