import { TrackData } from '../components/CreateTrackForm';
import { calculateTrackStats, TrackStats } from './elevationService';
import { getCurrentUser, canDevelop, isFreeUser } from './authService';
import { addUserMessage } from './notificationService';

// IndexedDB Backup System - More secure than localStorage
const DB_NAME = 'SingletrackDB';
const DB_VERSION = 1;
const BACKUP_STORE = 'autoBackups';

async function initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        
        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(BACKUP_STORE)) {
                db.createObjectStore(BACKUP_STORE, { keyPath: 'id' });
            }
        };
    });
}

async function saveBackupToIndexedDB(data: any): Promise<void> {
    try {
        const db = await initDB();
        const transaction = db.transaction(BACKUP_STORE, 'readwrite');
        const store = transaction.objectStore(BACKUP_STORE);
        
        await new Promise((resolve, reject) => {
            const request = store.put({
                id: 'latest',
                timestamp: new Date().toISOString(),
                data
            });
            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(null);
        });
        
        console.log('[IndexedDB Backup] Backup salvato con successo');
    } catch (err) {
        console.warn('[IndexedDB Backup] Errore nel salvataggio:', err);
    }
}

async function restoreBackupFromIndexedDB(): Promise<any | null> {
    try {
        const db = await initDB();
        const transaction = db.transaction(BACKUP_STORE, 'readonly');
        const store = transaction.objectStore(BACKUP_STORE);
        
        return new Promise((resolve) => {
            const request = store.get('latest');
            request.onerror = () => resolve(null);
            request.onsuccess = () => {
                const result = request.result;
                if (result) {
                    console.log('[IndexedDB Backup] Backup ripristinato da:', result.timestamp);
                    resolve(result.data);
                } else {
                    resolve(null);
                }
            };
        });
    } catch (err) {
        console.warn('[IndexedDB Backup] Errore nel ripristino:', err);
        return null;
    }
}

// Utility to update stored elevation stats for a track and notify listeners
export const updateTrackElevations = (trackId: string, elevationGain: number, elevationLoss: number, lengthKm?: number): void => {
    const tracks = getTracks();
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return;

    tracks[idx].elevationGain = Math.round(Number(elevationGain) || 0);
    tracks[idx].elevationLoss = Math.round(Number(elevationLoss) || 0);
    if (typeof lengthKm === 'number' && !isNaN(lengthKm)) {
        // Keep two decimals for length in km
        tracks[idx].length = Math.round(lengthKm * 100) / 100;
    }
    try { saveTracks(tracks); } finally {
        window.dispatchEvent(new CustomEvent('tracks:updated'));
    }
};

// Utility: recalculate elevation stats for a track by ID or name and persist.
// Returns the updated track or null. Useful if a single track's elevation seems off.
export async function recalcTrackElevations(idOrName: string): Promise<SavedTrack | null> {
    const tracks = getTracks();
    const track = tracks.find(t => t.id === idOrName || t.name?.toLowerCase() === idOrName.toLowerCase());
    if (!track || !track.points || track.points.length < 2) {
        console.warn('[trackStorage] Track not found or insufficient points for recalc:', idOrName);
        return null;
    }
    try {
        const stats: TrackStats = await calculateTrackStats(track.points as any);
        updateTrackElevations(track.id, stats.elevationGain, stats.elevationLoss, stats.length);
        const updated = getTracks().find(t => t.id === track.id) || null;
        if (updated) {
            console.info('[trackStorage] Elevation recalculated for', updated.name, 'D+', updated.elevationGain, 'D-', updated.elevationLoss, 'len km', updated.length);
        }
        return updated;
    } catch (err) {
        console.warn('[trackStorage] Failed to recalc elevation for track', track.name, err);
        return null;
    }
}

const STORAGE_KEY = 'singletrack_tracks';
const REVIEWS_KEY = 'singletrack_reviews';
const TOURS_KEY = 'singletrack_tours';
const POIS_KEY = 'singletrack_pois';
const PENDING_TRACKS_KEY = 'singletrack_pending_tracks';
const PENDING_POIS_KEY = 'singletrack_pending_pois';
const PENDING_TRACK_UPDATES_KEY = 'singletrack_pending_track_updates';

export interface Review {
    rating: number;
    comment: string;
    date: string;
    userName?: string;
    trailCondition: 'abbandonato' | 'sporco' | 'percorribile' | 'pulito' | 'perfetto';
}

export interface Tour {
    id: string;
    name: string;
    description: string;
    tracks: string[]; // Array of track IDs
    totalLength: number;
    totalElevationGain: number;
    totalElevationLoss: number;
    createdAt: string;
    createdBy?: string; // User ID who created the tour
    waypoints?: { lat: number; lng: number }[]; // Original clicked points
    routePoints?: { lat: number; lng: number }[]; // Computed route from routing
}

export interface SavedTrack extends TrackData {
    id: string;
    createdAt: string;
    reviews?: Review[];
    createdBy?: string; // User ID
    approved?: boolean; // For standard users
    disabled?: boolean; // Track disabled by developers (hidden for standard users)
    elevationProfile?: { distance: number; elevation: number }[]; // Cached elevation profile for popup chart
}

export interface PendingTrack extends SavedTrack {
    userId: string;
    userName: string;
    submittedAt: string;
}

export interface PendingTrackUpdate {
    id: string;
    trackId: string;
    field: 'description';
    newValue: string;
    oldValue?: string;
    userId: string;
    userName: string;
    submittedAt: string;
}

// Auto-backup nel localStorage (backup di emergenza)
let saveCounter = 0;
function autoBackup() {
    saveCounter++;
    if (saveCounter % 5 === 0) {
        const tracks = getTracks();
        const pois = getCustomPOIs();
        const backup = {
            timestamp: new Date().toISOString(),
            tracks,
            customPOIs: pois
        };
        localStorage.setItem('singletrack_autobackup', JSON.stringify(backup));
        console.log('[Auto-Backup] Backup automatico salvato', new Date().toLocaleString());
    }
}

// Funzione per recuperare l'auto-backup
export function getAutoBackup() {
    const backup = localStorage.getItem('singletrack_autobackup');
    return backup ? JSON.parse(backup) : null;
}

// Funzione per ripristinare l'auto-backup
export function restoreAutoBackup(): boolean {
    const backup = getAutoBackup();
    if (!backup) return false;
    
    if (backup.tracks) saveTracks(backup.tracks);
    if (backup.customPOIs) saveCustomPOIs(backup.customPOIs);
    
    return true;
}

// Ripristina il backup da IndexedDB (più sicuro del localStorage)
export async function restoreFromIndexedDBBackup(): Promise<boolean> {
    try {
        const backup = await restoreBackupFromIndexedDB();
        if (!backup) return false;
        
        if (backup.tracks) saveTracks(backup.tracks);
        if (backup.pois) saveCustomPOIs(backup.pois);
        
        console.log('[Recovery] Dati ripristinati da IndexedDB backup');
        return true;
    } catch (err) {
        console.error('[Recovery] Errore nel ripristino:', err);
        return false;
    }
}

export function saveTracks(tracks: SavedTrack[]): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tracks));
    
    // Backup su IndexedDB per sicurezza
    saveBackupToIndexedDB({
        tracks,
        pois: getCustomPOIs(),
        users: getCurrentUser(),
        timestamp: new Date().toISOString()
    }).catch(err => console.warn('[saveTracks] IndexedDB backup failed:', err));
    
    // Auto-backup ogni 5 salvataggi
    autoBackup();
}

export const getTracks = (): SavedTrack[] => {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    try {
        const raw = JSON.parse(data);
        if (!Array.isArray(raw)) return [];

        let changed = false;

        const normalizePoint = (p: any): { lat: number; lng: number } | null => {
            try {
                if (!p) return null;
                if (typeof p.lat === 'number' && typeof p.lng === 'number') return { lat: p.lat, lng: p.lng };
                if (typeof p.latitude === 'number' && typeof p.longitude === 'number') return { lat: p.latitude, lng: p.longitude };
                if (Array.isArray(p) && p.length >= 2 && typeof p[0] === 'number' && typeof p[1] === 'number') return { lat: p[0], lng: p[1] };
                if (p.location && typeof p.location.lat === 'number' && typeof p.location.lng === 'number') return { lat: p.location.lat, lng: p.location.lng };
                if (p.coordinates && (p.coordinates.latitude || p.coordinates.lat) && (p.coordinates.longitude || p.coordinates.lng)) {
                    const lat = Number(p.coordinates.latitude ?? p.coordinates.lat);
                    const lng = Number(p.coordinates.longitude ?? p.coordinates.lng);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
                }
                if (typeof p.lat === 'string' && typeof p.lng === 'string') {
                    const lat = Number(p.lat); const lng = Number(p.lng);
                    if (!Number.isNaN(lat) && !Number.isNaN(lng)) return { lat, lng };
                }
            } catch {
                // ignore
            }
            return null;
        };

        const normalized: SavedTrack[] = raw.map((t: SavedTrack) => {
            const pts: any[] = Array.isArray((t as any).points) ? (t as any).points : [];
            const newPts = pts.map(normalizePoint).filter((p): p is { lat: number; lng: number } => !!p);
            if (newPts.length !== pts.length || newPts.some((p, i) => {
                const orig = pts[i];
                return !(orig && typeof orig.lat === 'number' && typeof orig.lng === 'number' && orig.lat === p.lat && orig.lng === p.lng);
            })) {
                changed = true;
            }
            return { ...t, points: newPts } as SavedTrack;
        });

        if (changed) {
            try { saveTracks(normalized); } catch {}
            console.info('[trackStorage] Migrated legacy tracks to {lat,lng}');
        }

        return normalized;
    } catch {
        return [];
    }
};

export const addTrack = (track: TrackData): SavedTrack => {
    const currentUser = getCurrentUser();
    
    const newTrack: SavedTrack = {
        ...track,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id,
        // Auto-approve for contributors/admins (developer-equivalent)
        approved: canDevelop(currentUser)
    };
    
    // If user is free tier, add to pending tracks
    if (currentUser && isFreeUser(currentUser)) {
        const pendingTrack: PendingTrack = {
            ...newTrack,
            userId: currentUser.id,
            userName: `${currentUser.firstName} ${currentUser.lastName}`,
            submittedAt: new Date().toISOString()
        };
        const pendingTracks = getPendingTracks();
        pendingTracks.push(pendingTrack);
        savePendingTracks(pendingTracks);
        
        // Notify user
        console.log('[Track] Traccia inviata per approvazione');
        return newTrack;
    }
    
    // If developer-equivalent, add directly to tracks
    const tracks = getTracks();
    tracks.push(newTrack);
    saveTracks(tracks);
    return newTrack;
};

export const deleteTrack = (id: string): void => {
    const currentUser = getCurrentUser();
    const tracks = getTracks();
    const track = tracks.find(t => t.id === id);
    
    // Only developer-equivalent users can delete tracks
    if (!canDevelop(currentUser)) {
        console.warn('[Track] Solo gli sviluppatori possono eliminare le tracce');
        alert('Solo gli sviluppatori possono eliminare le tracce.');
        return;
    }
    
    const filtered = tracks.filter(t => t.id !== id);
    saveTracks(filtered);
    console.log('[Track] Traccia eliminata:', track?.name);
};

// Toggle track disabled state (developers only)
export const toggleTrackDisabled = (id: string): void => {
    const currentUser = getCurrentUser();
    
    // Only developer-equivalent users can disable/enable tracks
    if (!canDevelop(currentUser)) {
        console.warn('[Track] Solo gli sviluppatori possono disattivare/riattivare le tracce');
        alert('Solo gli sviluppatori possono disattivare o riattivare le tracce.');
        return;
    }
    
    const tracks = getTracks();
    const trackIndex = tracks.findIndex(t => t.id === id);
    
    if (trackIndex === -1) {
        console.warn('[Track] Traccia non trovata');
        return;
    }
    
    // Toggle disabled state
    tracks[trackIndex].disabled = !tracks[trackIndex].disabled;
    saveTracks(tracks);
    
    const action = tracks[trackIndex].disabled ? 'disattivata' : 'riattivata';
    console.log(`[Track] Traccia ${action}:`, tracks[trackIndex].name);
    
    // Dispatch event to reload tracks on map
    window.dispatchEvent(new CustomEvent('tracks:updated'));
};

export const getDifficultyColor = (difficulty: string): string => {
    const colors: Record<string, string> = {
        facile: '#27ae60',      // Verde
        medio: '#3498db',       // Blu
        difficile: '#e74c3c',   // Rosso
        estremo: '#2c3e50',     // Nero
        'ebike-climb': '#9b59b6' // Lilla
    };
    return colors[difficulty] || '#95a5a6';
};

// Review management
export const addReview = (trackId: string, review: Review): void => {
    const tracks = getTracks();
    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex === -1) return;

    // Normalize review payload
    const normalized: Review = {
        rating: Math.max(1, Math.min(10, Number((review as any).rating || 0))),
        comment: (review as any).comment ? String((review as any).comment).trim() : '',
        date: (review as any).date && !isNaN(new Date((review as any).date).getTime())
            ? String((review as any).date)
            : new Date().toISOString(),
        userName: (review as any).userName ? String((review as any).userName).trim() : undefined,
        trailCondition: ((): Review['trailCondition'] => {
            const c = (review as any).trailCondition;
            const allowed = ['abbandonato','sporco','percorribile','pulito','perfetto'] as const;
            return allowed.includes(c) ? c : 'percorribile';
        })()
    };

    if (!tracks[trackIndex].reviews) {
        tracks[trackIndex].reviews = [];
    }

    tracks[trackIndex].reviews!.push(normalized);
    (tracks[trackIndex] as any).lastReview = normalized.date;

    saveTracks(tracks);
};

export const getTrackReviews = (trackId: string): Review[] => {
    const tracks = getTracks();
    const track = tracks.find(t => t.id === trackId);
    const raw = track?.reviews || [];
    // Sanitize existing data (filters out invalid entries from past bugs)
    const cleaned = raw
        .filter((r: any) => r && typeof r === 'object')
        .map((r: any) => {
            const dateStr = r.date && !isNaN(new Date(r.date).getTime()) ? String(r.date) : new Date().toISOString();
            const ratingNum = Number(r.rating);
            return {
                rating: isNaN(ratingNum) ? 0 : Math.max(1, Math.min(10, ratingNum)),
                comment: r.comment ? String(r.comment) : '',
                date: dateStr,
                userName: r.userName ? String(r.userName) : undefined,
                trailCondition: ((): Review['trailCondition'] => {
                    const allowed = ['abbandonato','sporco','percorribile','pulito','perfetto'] as const;
                    return allowed.includes(r.trailCondition) ? r.trailCondition : 'percorribile';
                })()
            } as Review;
        })
        .filter((r: Review) => r.rating > 0);

    // If cleaning changed something (length or any field), persist back
    if (cleaned.length !== raw.length || JSON.stringify(cleaned) !== JSON.stringify(raw)) {
        track!.reviews = cleaned;
        try { saveTracks(tracks); } catch {}
    }
    return cleaned;
};

export const getAverageRating = (trackId: string): number => {
    const reviews = getTrackReviews(trackId);
    if (reviews.length === 0) return 0;
    const valid = reviews.filter(r => typeof r.rating === 'number' && !isNaN(r.rating));
    if (valid.length === 0) return 0;
    const sum = valid.reduce((acc, review) => acc + review.rating, 0);
    return Math.round((sum / valid.length) * 10) / 10; // Round to 1 decimal
};

export const getLatestReview = (trackId: string): Review | null => {
    const reviews = getTrackReviews(trackId);
    if (reviews.length === 0) return null;
    // Sort by date descending with safe fallback
    const ts = (d: string) => {
        const t = new Date(d).getTime();
        return isNaN(t) ? 0 : t;
    };
    const sorted = [...reviews].sort((a, b) => ts(b.date) - ts(a.date));
    return sorted[0];
};

// Get all reviews across all tracks
export const getReviews = (): Review[] => {
    const data = localStorage.getItem(REVIEWS_KEY);
    return data ? JSON.parse(data) : [];
};

// Save all reviews
export const saveReviews = (reviews: Review[]): void => {
    localStorage.setItem(REVIEWS_KEY, JSON.stringify(reviews));
};

export const getTrailConditionLabel = (condition: string): string => {
    const labels: Record<string, string> = {
        abbandonato: '🔴 Abbandonato',
        sporco: '🟠 Sporco',
        percorribile: '🟡 Percorribile',
        pulito: '🟢 Pulito',
        perfetto: '🟢 Perfetto'
    };
    return labels[condition] || condition;
};

export const updateTrackDescription = (trackId: string, description: string): void => {
    const tracks = getTracks();
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return;
    (tracks[idx] as any).description = description;
    try { saveTracks(tracks); } finally {
        window.dispatchEvent(new CustomEvent('tracks:updated'));
    }
};

// Update track name (developers only)
export const updateTrackName = (trackId: string, newName: string): void => {
    const currentUser = getCurrentUser();
    if (!canDevelop(currentUser)) {
        console.warn('[Track] Solo gli sviluppatori possono rinominare i singletrack');
        alert('Solo gli sviluppatori possono rinominare i singletrack.');
        return;
    }
    const tracks = getTracks();
    const idx = tracks.findIndex(t => t.id === trackId);
    if (idx === -1) return;
    const name = String(newName || '').trim();
    if (!name) return;
    tracks[idx].name = name;
    try { saveTracks(tracks); } finally {
        window.dispatchEvent(new CustomEvent('tracks:updated'));
    }
};

// ==============================
// Pending track updates handling
// ==============================
export const getPendingTrackUpdates = (): PendingTrackUpdate[] => {
    const data = localStorage.getItem(PENDING_TRACK_UPDATES_KEY);
    if (!data) return [];
    try { return JSON.parse(data); } catch { return []; }
};

export const savePendingTrackUpdates = (updates: PendingTrackUpdate[]): void => {
    localStorage.setItem(PENDING_TRACK_UPDATES_KEY, JSON.stringify(updates));
};

// Submit a description update: developer applies immediately, standard users go to approval queue
export const submitTrackDescriptionUpdate = (trackId: string, description: string): { status: 'approved' | 'pending' } => {
    const currentUser = getCurrentUser();
    const tracks = getTracks();
    const track = tracks.find(t => t.id === trackId);
    const userLabel = currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : 'Utente sconosciuto';

    if (!track) {
        console.warn('[TrackUpdate] Traccia non trovata per update descrizione');
        return { status: 'pending' };
    }

    if (canDevelop(currentUser)) {
        updateTrackDescription(trackId, description);
        return { status: 'approved' };
    }

    const pending: PendingTrackUpdate = {
        id: `upd_${Date.now()}_${Math.random().toString(36).slice(2,8)}`,
        trackId,
        field: 'description',
        newValue: description,
        oldValue: (track as any).description || '',
        userId: currentUser?.id || 'unknown',
        userName: userLabel,
        submittedAt: new Date().toISOString()
    };
    const updates = getPendingTrackUpdates();
    updates.unshift(pending);
    savePendingTrackUpdates(updates);
    console.log('[TrackUpdate] Descrizione inviata per approvazione');
    return { status: 'pending' };
};

export const approveTrackUpdate = (updateId: string): void => {
    const updates = getPendingTrackUpdates();
    const upd = updates.find(u => u.id === updateId);
    if (!upd) return;
    if (upd.field === 'description') {
        updateTrackDescription(upd.trackId, upd.newValue);
    }
    const filtered = updates.filter(u => u.id !== updateId);
    savePendingTrackUpdates(filtered);

    // Notify author
    if (upd.userId) {
        try {
            addUserMessage(
                upd.userId,
                'Modifica descrizione approvata',
                `La tua modifica alla descrizione del singletrack è stata approvata.`
            );
        } catch {}
    }
};

export const rejectTrackUpdate = (updateId: string, reason?: string): void => {
    const updates = getPendingTrackUpdates();
    const upd = updates.find(u => u.id === updateId);
    const filtered = updates.filter(u => u.id !== updateId);
    savePendingTrackUpdates(filtered);

    if (upd?.userId) {
        try {
            addUserMessage(
                upd.userId,
                'Modifica descrizione rifiutata',
                `La tua modifica è stata rifiutata.${reason ? ' Motivo: ' + reason : ''}`
            );
        } catch {}
    }
};

// Tour management
export const getTours = (): Tour[] => {
    const data = localStorage.getItem(TOURS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
};

// Migrate old tours without createdBy to current user (one-time migration helper)
export const migrateToursToCurrentUser = (): number => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
        console.warn('[Tour Migration] Nessun utente loggato per la migrazione');
        return 0;
    }
    
    const tours = getTours();
    let migratedCount = 0;
    
    const updatedTours = tours.map(tour => {
        if (!tour.createdBy) {
            migratedCount++;
            return { ...tour, createdBy: currentUser.id };
        }
        return tour;
    });
    
    if (migratedCount > 0) {
        saveTours(updatedTours);
        console.log(`[Tour Migration] Migrati ${migratedCount} tour all'utente corrente`);
    }
    
    return migratedCount;
};

// Migrate tours with only 2 waypoints to have sampled intermediate waypoints from routePoints
export const migrateTourWaypoints = (): number => {
    const tours = getTours();
    let migratedCount = 0;
    
    const sampleWaypoints = (points: { lat: number; lng: number }[]): { lat: number; lng: number }[] => {
        if (points.length < 2) return points;
        const result = [points[0]]; // Start
        const step = Math.max(1, Math.floor(points.length / 40)); // ~40-50 waypoints total for high fidelity
        for (let i = step; i < points.length - 1; i += step) {
            result.push(points[i]);
        }
        result.push(points[points.length - 1]); // End
        return result;
    };
    
    const updatedTours = tours.map(tour => {
        // If tour has less than 30 waypoints but has full routePoints, resample waypoints
        // This ensures high fidelity editing experience
        if (tour.waypoints && tour.waypoints.length < 30 && tour.routePoints && tour.routePoints.length > 20) {
            migratedCount++;
            console.log(`[Tour Migration] Migrating tour "${tour.name}": ${tour.waypoints.length} → ~40-50 waypoints`);
            return { ...tour, waypoints: sampleWaypoints(tour.routePoints) };
        }
        return tour;
    });
    
    if (migratedCount > 0) {
        saveTours(updatedTours);
        console.log(`[Tour Migration] Migrati ${migratedCount} tour con waypoint campionati`);
    }
    
    return migratedCount;
};

// Get tours for current user only
export const getUserTours = (): Tour[] => {
    const currentUser = getCurrentUser();
    const allTours = getTours();
    
    // If no user is logged in, return empty array
    if (!currentUser) return [];
    
    // Return only tours created by current user
    return allTours.filter(tour => tour.createdBy === currentUser.id);
};

export const saveTours = (tours: Tour[]): void => {
    localStorage.setItem(TOURS_KEY, JSON.stringify(tours));
};

export const addTour = (tour: Omit<Tour, 'id' | 'createdAt'>): Tour => {
    const currentUser = getCurrentUser();
    const tours = getTours();
    const newTour: Tour = {
        ...tour,
        id: Date.now().toString(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id // Associate tour with current user
    };
    tours.push(newTour);
    saveTours(tours);
    return newTour;
};

// Update an existing tour
export const updateTour = (tourId: string, updates: Partial<Tour>): Tour | null => {
    const currentUser = getCurrentUser();
    const tours = getTours();
    const tourIndex = tours.findIndex(t => t.id === tourId);
    
    if (tourIndex === -1) {
        console.warn('[Tour] Tour non trovato');
        return null;
    }
    
    const tour = tours[tourIndex];
    
    // Check if user owns this tour or has developer-equivalent rights
    if (tour.createdBy !== currentUser?.id && !canDevelop(currentUser)) {
        console.warn('[Tour] Utente non autorizzato a modificare questo tour');
        return null;
    }
    
    // Update the tour
    tours[tourIndex] = {
        ...tour,
        ...updates,
        id: tourId, // Preserve ID
        createdAt: tour.createdAt, // Preserve creation date
        createdBy: tour.createdBy // Preserve owner
    };
    
    saveTours(tours);
    return tours[tourIndex];
};

export const deleteTour = (id: string): void => {
    const currentUser = getCurrentUser();
    const tours = getTours();
    const tour = tours.find(t => t.id === id);
    
    // Check if user owns this tour or has developer-equivalent rights
    if (tour && tour.createdBy !== currentUser?.id && !canDevelop(currentUser)) {
        console.warn('[Tour] Utente non autorizzato a eliminare questo tour');
        return;
    }
    
    const filtered = tours.filter(t => t.id !== id);
    saveTours(filtered);
};

export const getTourWithTracks = (tourId: string): { tour: Tour; tracks: SavedTrack[] } | null => {
    const currentUser = getCurrentUser();
    const tours = getTours();
    const tour = tours.find(t => t.id === tourId);
    if (!tour) return null;
    
    // Check if user owns this tour or has developer-equivalent rights
    if (tour.createdBy !== currentUser?.id && !canDevelop(currentUser)) {
        console.warn('[Tour] Utente non autorizzato a visualizzare questo tour');
        return null;
    }
    
    const allTracks = getTracks();
    const tourTracks = tour.tracks
        .map(trackId => allTracks.find(t => t.id === trackId))
        .filter((t): t is SavedTrack => t !== undefined);
    
    return { tour, tracks: tourTracks };
};

// Custom POI management
export interface CustomPOI {
    id: string;
    name: string;
    description: string;
    type: 'bikeshop' | 'restaurant' | 'fountain' | 'market' | 'sleepnride' | 'viewpoint' | 'parking' | 'campsite' | 'ebike-charging' | 'bike-rental' | 'mtb-guide';
    location: {
        lat: number;
        lng: number;
    };
    createdAt: string;
    createdBy?: string; // User ID
    approved?: boolean; // For standard users
    disabled?: boolean; // POI disabled by developers (hidden for standard users)
}

export interface PendingPOI extends CustomPOI {
    userId: string;
    userName: string;
    submittedAt: string;
}

export const getCustomPOIs = (): CustomPOI[] => {
    const data = localStorage.getItem(POIS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
};

export function saveCustomPOIs(pois: CustomPOI[]): void {
    localStorage.setItem(POIS_KEY, JSON.stringify(pois));
    
    // Auto-backup ogni 5 salvataggi
    autoBackup();
}

export const addCustomPOI = (poi: Omit<CustomPOI, 'id' | 'createdAt'>): CustomPOI => {
    const currentUser = getCurrentUser();
    
    const newPOI: CustomPOI = {
        ...poi,
        id: `poi_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.id,
        // Auto-approve for contributors/admins (developer-equivalent)
        approved: canDevelop(currentUser)
    };
    
    // If user is free tier, add to pending POIs
    if (currentUser && isFreeUser(currentUser)) {
        const pendingPOI: PendingPOI = {
            ...newPOI,
            userId: currentUser.id,
            userName: `${currentUser.firstName} ${currentUser.lastName}`,
            submittedAt: new Date().toISOString()
        };
        const pendingPOIs = getPendingPOIs();
        pendingPOIs.push(pendingPOI);
        savePendingPOIs(pendingPOIs);
        
        // Notify user
        console.log('[POI] POI inviato per approvazione');
        return newPOI;
    }
    
    // If developer-equivalent, add directly to POIs
    const pois = getCustomPOIs();
    pois.push(newPOI);
    saveCustomPOIs(pois);
    return newPOI;
};

export const deleteCustomPOI = (id: string): void => {
    const currentUser = getCurrentUser();
    const pois = getCustomPOIs();
    const poi = pois.find(p => p.id === id);
    
    // Only developer-equivalent users can delete POIs
    if (!canDevelop(currentUser)) {
        console.warn('[POI] Solo gli sviluppatori possono eliminare i POI');
        alert('Solo gli sviluppatori possono eliminare i punti di interesse.');
        return;
    }
    
    const filtered = pois.filter(p => p.id !== id);
    saveCustomPOIs(filtered);
    console.log('[POI] POI eliminato:', poi?.name);
};

// Toggle POI disabled state (developers only)
export const togglePOIDisabled = (id: string): void => {
    const currentUser = getCurrentUser();
    
    // Only developer-equivalent users can disable/enable POIs
    if (!canDevelop(currentUser)) {
        console.warn('[POI] Solo gli sviluppatori possono disattivare/riattivare i POI');
        alert('Solo gli sviluppatori possono disattivare o riattivare i punti di interesse.');
        return;
    }
    
    const pois = getCustomPOIs();
    const poiIndex = pois.findIndex(p => p.id === id);
    
    if (poiIndex === -1) {
        console.warn('[POI] POI non trovato');
        return;
    }
    
    // Toggle disabled state
    pois[poiIndex].disabled = !pois[poiIndex].disabled;
    saveCustomPOIs(pois);
    
    const action = pois[poiIndex].disabled ? 'disattivato' : 'riattivato';
    console.log(`[POI] POI ${action}:`, pois[poiIndex].name);
    
    // Dispatch event to reload POIs on map
    window.dispatchEvent(new CustomEvent('poi:added'));
};

// Pending content management
export const getPendingTracks = (): PendingTrack[] => {
    const data = localStorage.getItem(PENDING_TRACKS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
};

export const savePendingTracks = (tracks: PendingTrack[]): void => {
    localStorage.setItem(PENDING_TRACKS_KEY, JSON.stringify(tracks));
};

export const getPendingPOIs = (): PendingPOI[] => {
    const data = localStorage.getItem(PENDING_POIS_KEY);
    if (!data) return [];
    try {
        return JSON.parse(data);
    } catch {
        return [];
    }
};

export const savePendingPOIs = (pois: PendingPOI[]): void => {
    localStorage.setItem(PENDING_POIS_KEY, JSON.stringify(pois));
};

export const approveTrack = (trackId: string): void => {
    const pendingTracks = getPendingTracks();
    const track = pendingTracks.find(t => t.id === trackId);
    
    if (!track) return;
    
    // Add to approved tracks
    const tracks = getTracks();
    const approvedTrack: SavedTrack = {
        ...track,
        approved: true
    };
    tracks.push(approvedTrack);
    saveTracks(tracks);
    
    // Remove from pending
    const filtered = pendingTracks.filter(t => t.id !== trackId);
    savePendingTracks(filtered);
    
    // Notify author
    if (track.userId) {
        addUserMessage(
            track.userId,
            'Traccia approvata',
            `La tua traccia "${track.name}" è stata approvata ed è ora visibile sulla mappa.`
        );
    }

    console.log('[Approval] Traccia approvata:', track.name);
};

export const rejectTrack = (trackId: string, reason?: string): void => {
    const pendingTracks = getPendingTracks();
    const track = pendingTracks.find(t => t.id === trackId);
    const filtered = pendingTracks.filter(t => t.id !== trackId);
    savePendingTracks(filtered);
    
    // Notify author with reason
    if (track && track.userId) {
        const msg = reason ? `Motivazione: ${reason}` : 'Motivazione non specificata.';
        addUserMessage(
            track.userId,
            'Traccia rifiutata',
            `La tua traccia "${track.name}" è stata rifiutata. ${msg}`
        );
    }

    console.log('[Approval] Traccia rifiutata');
};

export const approvePOI = (poiId: string): void => {
    const pendingPOIs = getPendingPOIs();
    const poi = pendingPOIs.find(p => p.id === poiId);
    
    if (!poi) return;
    
    // Add to approved POIs
    const pois = getCustomPOIs();
    const approvedPOI: CustomPOI = {
        ...poi,
        approved: true
    };
    pois.push(approvedPOI);
    saveCustomPOIs(pois);
    
    // Remove from pending
    const filtered = pendingPOIs.filter(p => p.id !== poiId);
    savePendingPOIs(filtered);
    
    // Notify author
    if ((poi as any).userId) {
        addUserMessage(
            (poi as any).userId,
            'POI approvato',
            `Il tuo punto di interesse "${poi.name}" è stato approvato ed è ora visibile sulla mappa.`
        );
    }

    console.log('[Approval] POI approvato:', poi.name);
};

export const rejectPOI = (poiId: string, reason?: string): void => {
    const pendingPOIs = getPendingPOIs();
    const poi = pendingPOIs.find(p => p.id === poiId);
    const filtered = pendingPOIs.filter(p => p.id !== poiId);
    savePendingPOIs(filtered);
    
    // Notify author with reason
    if (poi && (poi as any).userId) {
        const msg = reason ? `Motivazione: ${reason}` : 'Motivazione non specificata.';
        addUserMessage(
            (poi as any).userId,
            'POI rifiutato',
            `Il tuo punto di interesse "${poi.name}" è stato rifiutato. ${msg}`
        );
    }

    console.log('[Approval] POI rifiutato');
};

// ============================================
// TOUR ARCHIVE MANAGEMENT (Developer uploads)
// ============================================

const TOUR_ARCHIVE_KEY = 'singletrack_tour_archive';

export interface ArchiveTour {
    id: string;
    name: string;
    description: string;
    location: string;
    radius?: number;
    difficulty: 'facile' | 'medio' | 'difficile' | 'estremo' | 'ebike-climb';
    totalLength: number;
    totalElevationGain: number;
    totalElevationLoss: number;
    bikeType: 'XC' | 'Hardtail' | 'Trail bike' | 'All Mountain' | 'Enduro' | 'E-bike' | 'Gravel';
    gpxFile?: File;
    gpxData?: string; // Base64 encoded GPX
    createdBy: string; // Developer user ID
    createdAt: string;
}

export const getArchiveTours = (): ArchiveTour[] => {
    try {
        const stored = localStorage.getItem(TOUR_ARCHIVE_KEY);
        return stored ? JSON.parse(stored) : [];
    } catch (error) {
        console.error('Error loading tour archive:', error);
        return [];
    }
};

const saveArchiveTours = (tours: ArchiveTour[]): void => {
    try {
        const data = JSON.stringify(tours);
        const sizeInMB = (new Blob([data]).size / (1024 * 1024)).toFixed(2);
        console.log(`[TourArchive] Saving ${tours.length} tours, total size: ${sizeInMB} MB`);
        
        localStorage.setItem(TOUR_ARCHIVE_KEY, data);
        // Dispatch event for components listening
        window.dispatchEvent(new CustomEvent('tours:updated', { detail: tours }));
    } catch (error) {
        console.error('Error saving tour archive:', error);
        
        // Check if it's a quota exceeded error
        if (error instanceof DOMException && error.name === 'QuotaExceededError') {
            alert(
                '⚠️ Spazio di archiviazione esaurito!\n\n' +
                'Il database locale è pieno. Per liberare spazio:\n' +
                '1. Elimina alcuni tour dall\'archivio\n' +
                '2. Oppure riduci la dimensione dei file GPX prima di caricarli\n\n' +
                'Limite tipico: 5-10 MB per sito web'
            );
        }
        
        throw error;
    }
};

export const addArchiveTour = (tour: Omit<ArchiveTour, 'id' | 'createdAt'>): ArchiveTour => {
    const tours = getArchiveTours();
    const newTour: ArchiveTour = {
        ...tour,
        id: `tour-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString()
    };
    
    tours.push(newTour);
    saveArchiveTours(tours);
    
    console.log('[TourArchive] Tour added:', newTour.name);
    return newTour;
};

export const updateArchiveTour = (tourId: string, updates: Partial<ArchiveTour>): void => {
    const tours = getArchiveTours();
    const index = tours.findIndex(t => t.id === tourId);
    
    if (index !== -1) {
        tours[index] = { ...tours[index], ...updates };
        saveArchiveTours(tours);
        console.log('[TourArchive] Tour updated:', tourId);
    }
};

export const deleteArchiveTour = (tourId: string): void => {
    const tours = getArchiveTours();
    const filtered = tours.filter(t => t.id !== tourId);
    saveArchiveTours(filtered);
    console.log('[TourArchive] Tour deleted:', tourId);
};

// Get storage usage information
export const getStorageInfo = (): { usedMB: number; tours: number; avgTourSizeMB: number } => {
    try {
        const tours = getArchiveTours();
        const data = JSON.stringify(tours);
        const usedBytes = new Blob([data]).size;
        const usedMB = usedBytes / (1024 * 1024);
        const avgTourSizeMB = tours.length > 0 ? usedMB / tours.length : 0;
        
        return {
            usedMB: parseFloat(usedMB.toFixed(2)),
            tours: tours.length,
            avgTourSizeMB: parseFloat(avgTourSizeMB.toFixed(2))
        };
    } catch (error) {
        return { usedMB: 0, tours: 0, avgTourSizeMB: 0 };
    }
};

export const searchArchiveTours = (filters: {
    location?: string;
    radius?: number;
    difficulty?: string;
    minKm?: number;
    maxKm?: number;
    minElev?: number;
    maxElev?: number;
    bikeType?: string;
}): ArchiveTour[] => {
    let tours = getArchiveTours();
    
    if (filters.location) {
        const term = filters.location.toLowerCase();
        if (filters.radius && filters.radius > 0) {
            // Heuristic: if a radius is provided but we don't have coordinates,
            // relax the filter to match by country (text after the last comma).
            const parts = term.split(',').map(s => s.trim()).filter(Boolean);
            const country = parts.length > 1 ? parts[parts.length - 1] : term;
            tours = tours.filter(t => t.location.toLowerCase().includes(country));
        } else {
            tours = tours.filter(t => t.location.toLowerCase().includes(term));
        }
    }
    
    if (filters.difficulty && filters.difficulty !== 'all') {
        tours = tours.filter(t => t.difficulty === filters.difficulty);
    }
    
    if (filters.minKm !== undefined && filters.minKm !== null) {
        tours = tours.filter(t => t.totalLength >= filters.minKm!);
    }
    
    if (filters.maxKm !== undefined && filters.maxKm !== null) {
        tours = tours.filter(t => t.totalLength <= filters.maxKm!);
    }
    
    if (filters.minElev !== undefined && filters.minElev !== null) {
        tours = tours.filter(t => t.totalElevationGain >= filters.minElev!);
    }
    
    if (filters.maxElev !== undefined && filters.maxElev !== null) {
        tours = tours.filter(t => t.totalElevationGain <= filters.maxElev!);
    }
    
    if (filters.bikeType && filters.bikeType !== 'all') {
        tours = tours.filter(t => t.bikeType === filters.bikeType);
    }
    
    return tours;
};

