import React, { useState } from 'react';
import { getTracks, getCustomPOIs, saveTracks, saveCustomPOIs, getTours, saveTours, getReviews, saveReviews } from '../services/trackStorage';
import { getCurrentUser, canDevelop, getUsers, saveUsers } from '../services/authService';

export default function DataManager() {
    const [showExportSuccess, setShowExportSuccess] = useState(false);
    const [showImportSuccess, setShowImportSuccess] = useState(false);

    const handleExportData = () => {
        const tracks = getTracks();
        const pois = getCustomPOIs();
        const tours = getTours();
        const reviews = getReviews();
        const users = getUsers();
        
        const exportData = {
            version: '1.0',
            exportDate: new Date().toISOString(),
            tracks,
            customPOIs: pois,
            tours,
            reviews,
            users
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `singletrack_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        setTimeout(() => {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, 0);

        setShowExportSuccess(true);
        setTimeout(() => setShowExportSuccess(false), 3000);
    };

    const handleImportData = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const content = e.target?.result as string;
                const data = JSON.parse(content);

                if (!data.tracks && !data.customPOIs && !data.tours && !data.reviews) {
                    alert('❌ File non valido. Assicurati di selezionare un backup Singletrack.');
                    return;
                }

                const currentTracks = getTracks();
                const currentPOIs = getCustomPOIs();
                const currentTours = getTours();
                const currentReviews = getReviews();

                const message = `📥 Trovati nel backup:
- ${data.tracks?.length || 0} singletrack
- ${data.customPOIs?.length || 0} POI
- ${data.tours?.length || 0} tour
- ${data.reviews?.length || 0} recensioni

Attualmente hai:
- ${currentTracks.length} singletrack
- ${currentPOIs.length} POI
- ${currentTours.length} tour
- ${currentReviews.length} recensioni

Come vuoi procedere?`;

                const choice = confirm(message + '\n\nOK = Sostituisci tutto\nAnnulla = Unisci con dati esistenti');

                if (choice) {
                    // Sostituisci tutto
                    if (data.tracks) saveTracks(data.tracks);
                    if (data.customPOIs) saveCustomPOIs(data.customPOIs);
                    if (data.tours) saveTours(data.tours);
                    if (data.reviews) saveReviews(data.reviews);
                    if (data.users && getUsers().some(u => u.role === 'admin')) {
                        saveUsers(data.users); // Solo se l'utente è admin
                    }
                } else {
                    // Unisci
                    if (data.tracks) {
                        const merged = [...currentTracks];
                        data.tracks.forEach((track: any) => {
                            if (!merged.find(t => t.id === track.id)) {
                                merged.push(track);
                            }
                        });
                        saveTracks(merged);
                    }
                    if (data.customPOIs) {
                        const merged = [...currentPOIs];
                        data.customPOIs.forEach((poi: any) => {
                            if (!merged.find(p => p.id === poi.id)) {
                                merged.push(poi);
                            }
                        });
                        saveCustomPOIs(merged);
                    }
                    if (data.tours) {
                        const merged = [...currentTours];
                        data.tours.forEach((tour: any) => {
                            if (!merged.find(t => t.id === tour.id)) {
                                merged.push(tour);
                            }
                        });
                        saveTours(merged);
                    }
                    if (data.reviews) {
                        const merged = [...currentReviews];
                        data.reviews.forEach((review: any) => {
                            if (!merged.find(r => r.date === review.date && r.userName === review.userName)) {
                                merged.push(review);
                            }
                        });
                        saveReviews(merged);
                    }
                }

                setShowImportSuccess(true);
                setTimeout(() => setShowImportSuccess(false), 3000);

                // Ricarica la pagina per aggiornare tutto
                setTimeout(() => {
                    window.location.reload();
                }, 1000);

            } catch (err) {
                console.error('Import error:', err);
                alert('❌ Errore durante l\'importazione del file. Assicurati che sia un file JSON valido.');
            }
        };
        reader.readAsText(file);
        
        // Reset input
        event.target.value = '';
    };

    const handleClearAll = () => {
        const tracks = getTracks();
        const pois = getCustomPOIs();

        const message = `⚠️ ATTENZIONE!

Stai per cancellare TUTTI i dati:
- ${tracks.length} singletrack
- ${pois.length} punti di interesse

Questa azione è IRREVERSIBILE!

Consiglio: esporta prima un backup.

Sei sicuro di voler procedere?`;

        if (!confirm(message)) return;

        // Doppia conferma
        if (!confirm('Conferma ancora una volta: cancellare TUTTO?')) return;

        localStorage.removeItem('singletrack_tracks');
        localStorage.removeItem('singletrack_pois');
        localStorage.removeItem('singletrack_reviews');
        localStorage.removeItem('singletrack_tours');

        alert('✅ Tutti i dati sono stati cancellati.');
        window.location.reload();
    };

    const tracks = getTracks();
    const pois = getCustomPOIs();
    const tours = getTours();
    const reviews = getReviews();
    const currentUser = getCurrentUser();
    const isApprovedDeveloper = !!currentUser && canDevelop(currentUser) && currentUser.approved;

    return (
        <div className="data-manager">
            <h3>💾 Gestione Dati</h3>

            <div className="data-stats">
                <div className="stat-card">
                    <div className="stat-icon">🚵</div>
                    <div className="stat-content">
                        <div className="stat-value">{tracks.length}</div>
                        <div className="stat-label">Singletrack</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">📍</div>
                    <div className="stat-content">
                        <div className="stat-value">{pois.length}</div>
                        <div className="stat-label">POI</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">🗺️</div>
                    <div className="stat-content">
                        <div className="stat-value">{tours.length}</div>
                        <div className="stat-label">Tour</div>
                    </div>
                </div>
                <div className="stat-card">
                    <div className="stat-icon">⭐</div>
                    <div className="stat-content">
                        <div className="stat-value">{reviews.length}</div>
                        <div className="stat-label">Recensioni</div>
                    </div>
                </div>
            </div>

            <div className="data-actions">
                <h4>Backup & Ripristino</h4>
                <p className="info-text">
                    ℹ️ Esporta regolarmente i tuoi dati per non perderli. Il file può essere reimportato in qualsiasi momento.
                </p>

                <button 
                    className="btn-submit"
                    onClick={handleExportData}
                    style={{ width: '100%', marginBottom: '8px' }}
                >
                    📤 Esporta tutti i dati (JSON)
                </button>

                {showExportSuccess && (
                    <div className="success-message">
                        ✅ Backup esportato con successo!
                    </div>
                )}

                {isApprovedDeveloper && (
                    <label className="btn-submit" style={{ width: '100%', marginBottom: '8px', display: 'block', textAlign: 'center', cursor: 'pointer' }}>
                        📥 Importa backup
                        <input 
                            type="file" 
                            accept=".json"
                            onChange={handleImportData}
                            style={{ display: 'none' }}
                        />
                    </label>
                )}

                {showImportSuccess && (
                    <div className="success-message">
                        ✅ Dati importati! Ricaricamento...
                    </div>
                )}

                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(255,255,255,0.1)' }}>
                    <h4 style={{ color: '#e74c3c' }}>⚠️ Zona Pericolosa</h4>
                    <button 
                        className="btn-cancel"
                        onClick={handleClearAll}
                        style={{ width: '100%', background: 'rgba(231, 76, 60, 0.2)', borderColor: '#e74c3c' }}
                    >
                        🗑️ Cancella TUTTI i dati
                    </button>
                </div>
            </div>

            <div className="backup-tips" style={{ marginTop: '20px', padding: '12px', background: 'rgba(52, 152, 219, 0.1)', borderRadius: '6px', fontSize: '12px' }}>
                <strong>💡 Suggerimenti:</strong>
                <ul style={{ margin: '8px 0 0', paddingLeft: '20px', lineHeight: '1.6' }}>
                    <li>Esporta un backup prima di fare modifiche importanti</li>
                    <li>Salva i file backup in un posto sicuro (Google Drive, Dropbox, ecc)</li>
                    <li>Nomina i file con la data per identificarli facilmente</li>
                    <li>Puoi importare backup anche su altri dispositivi</li>
                </ul>
            </div>
        </div>
    );
}
