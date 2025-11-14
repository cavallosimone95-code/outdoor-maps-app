import React, { useEffect, useState } from 'react';
import POIList from './POIList';
import CreateTrackForm, { TrackData } from './CreateTrackForm';
import ReviewTrackForm from './ReviewTrackForm';
import CreateTourForm from './CreateTourForm';
import SearchTrackForm from './SearchTrackForm';
import SearchTourForm from './SearchTourForm';
import ExploreTourPanel from './ExploreTourPanel';
import UploadTourForm from './UploadTourForm';
import AddPOIForm from './AddPOIForm';
import { ApprovalPanel } from './ApprovalPanel';
import MessagesPanel from './MessagesPanel';
import SavedToursPanel from './SavedToursPanel';
import UserProfile from './UserProfile';
import DataManager from './DataManager';
import { fetchPOIs } from '../services/mapService';
import { addTrack, addReview, addTour, addCustomPOI, getPendingTracks, getPendingPOIs, getPendingTrackUpdates } from '../services/trackStorage';
import { getCurrentUser, getPendingUsers, canDevelop } from '../services/authService';
import { logoutViaBackend } from '../services/backendAuth';
import type { POI } from '../types';
import { getUnreadCount } from '../services/notificationService';

type ViewType = 'explore' | 'search' | 'create' | 'review' | 'tour' | 'saved-tours' | 'add-poi' | 'approval' | 'messages' | 'profile' | 'search-tour' | 'explore-tour' | 'upload-tour' | 'settings';
type POICategory = 'all' | 'bikeshop' | 'restaurant' | 'fountain' | 'market' | 'sleepnride' | 'viewpoint' | 'parking' | 'campsite';

interface TrackPoint {
    lat: number;
    lng: number;
}

const Sidebar: React.FC = () => {
    const [pois, setPois] = useState<POI[]>([]);
    const [activeView, setActiveView] = useState<ViewType>('explore');
    const [selectedCategory, setSelectedCategory] = useState<POICategory>('all');
    const [trackPoints, setTrackPoints] = useState<TrackPoint[]>([]);
    const [selectedTrack, setSelectedTrack] = useState<any>(null);
    const [unreadCount, setUnreadCount] = useState<number>(0);
    const [poisVisible, setPoisVisible] = useState<boolean>(true);
    const [showMenu, setShowMenu] = useState<boolean>(true);

    useEffect(() => {
        let mounted = true;
        (async () => {
            try {
                const data = await fetchPOIs();
                if (mounted) setPois(data);
            } catch (err) {
                // ignore for now
            }
        })();
        return () => { mounted = false; };
    }, []);

    // Listen for map clicks when in create mode
    useEffect(() => {
        const handleMapClick = (e: any) => {
            if (activeView !== 'create') return;
            
            const point = e.detail;
            setTrackPoints(prev => [...prev, point]);
            console.log('Point added:', point);
        };

        window.addEventListener('map:click', handleMapClick as EventListener);
        return () => window.removeEventListener('map:click', handleMapClick as EventListener);
    }, [activeView]);

    // Notify map about current mode (create/tour/explore)
    useEffect(() => {
        const mode = activeView === 'create' ? 'create' : activeView === 'tour' ? 'tour' : 'explore';
        window.dispatchEvent(new CustomEvent('mode:change', { 
            detail: { mode, points: [] } 
        }));
        
        // Notify about sidebar panel state (to hide TourStatsPanel when needed)
        const panelsWithForms = ['search', 'create', 'review', 'tour', 'add-poi', 'search-tour', 'upload-tour', 'saved-tours', 'settings'];
        const hasPanelOpen = panelsWithForms.includes(activeView);
        window.dispatchEvent(new CustomEvent('sidebar:panel-state', { 
            detail: { panelOpen: hasPanelOpen } 
        }));
        
        // Reset track points when leaving create mode
        if (mode !== 'create') {
            setTrackPoints([]);
        }
    }, [activeView]);

    // Notify map about POI category filter changes
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('poi:filter', { 
            detail: { category: selectedCategory } 
        }));
    }, [selectedCategory]);

    // Notify map about POI visibility changes
    useEffect(() => {
        window.dispatchEvent(new CustomEvent('poi:visibility', { 
            detail: { visible: poisVisible } 
        }));
    }, [poisVisible]);

    // Notify map about track points changes (only in create mode)
    useEffect(() => {
        if (activeView === 'create') {
            window.dispatchEvent(new CustomEvent('mode:change', { 
                detail: { mode: 'create', points: trackPoints } 
            }));
        }
    }, [trackPoints, activeView]);

    // Notifications unread counter
    useEffect(() => {
        const user = getCurrentUser();
        const refresh = () => setUnreadCount(user ? getUnreadCount(user.id) : 0);
        refresh();
        const handler = () => refresh();
        window.addEventListener('notifications:updated', handler as EventListener);
        return () => window.removeEventListener('notifications:updated', handler as EventListener);
    }, []);

    // Listen for track selection from map
    useEffect(() => {
        const handleTrackSelected = (e: any) => {
            // Don't open review in sidebar anymore - it's handled by the bottom panel in mainApp
            // Keep this handler for backward compatibility but don't change view
            console.log('[Sidebar] Track selected, bottom panel will handle it');
        };

        const handleTracksUpdated = () => {
            // Refresh the map when tracks are approved
            window.dispatchEvent(new CustomEvent('tracks:refresh'));
        };

        const handlePOIsUpdated = () => {
            // Refresh the map when POIs are approved
            window.dispatchEvent(new CustomEvent('pois:refresh'));
        };

        const handleTrackPointRemove = (e: any) => {
            const { index } = e.detail;
            if (typeof index === 'number' && activeView === 'create') {
                setTrackPoints(prev => prev.filter((_, i) => i !== index));
            }
        };

        const handleTourEdit = (e: any) => {
            const tour = e.detail;
            if (tour) {
                // Switch to tour view to edit
                setActiveView('tour');
                // Re-dispatch the event after a short delay to ensure CreateTourForm is mounted
                setTimeout(() => {
                    window.dispatchEvent(new CustomEvent('tour:edit', { detail: tour }));
                }, 100);
            }
        };

        window.addEventListener('track:selected', handleTrackSelected as EventListener);
        window.addEventListener('tracks:updated', handleTracksUpdated as EventListener);
        window.addEventListener('pois:updated', handlePOIsUpdated as EventListener);
        window.addEventListener('track:point-remove', handleTrackPointRemove as EventListener);
        window.addEventListener('tour:edit', handleTourEdit as EventListener);
        
        return () => {
            window.removeEventListener('track:selected', handleTrackSelected as EventListener);
            window.removeEventListener('tracks:updated', handleTracksUpdated as EventListener);
            window.removeEventListener('pois:updated', handlePOIsUpdated as EventListener);
            window.removeEventListener('track:point-remove', handleTrackPointRemove as EventListener);
            window.removeEventListener('tour:edit', handleTourEdit as EventListener);
        };
    }, [activeView]);

    const handleCancelCreate = () => {
        setTrackPoints([]);
        setActiveView('explore');
        setShowMenu(true); // torna al menù principale anche su annulla
    };

    const handleClearLastPoint = () => {
        setTrackPoints(prev => prev.slice(0, -1));
    };

    const handleSaveTrack = (data: TrackData) => {
        console.log('Saving track:', data);
        const currentUser = getCurrentUser();
        const savedTrack = addTrack(data);
        
        // Different message based on user role
        if (canDevelop(currentUser)) {
            alert(`Singletrack "${data.name}" creato con successo!\n${data.points.length} punti tracciati`);
            // Notify map to add the track
            window.dispatchEvent(new CustomEvent('track:added', { detail: savedTrack }));
        } else {
            alert(`Singletrack "${data.name}" inviato per approvazione.\nUn amministratore lo verificherà a breve.\n${data.points.length} punti tracciati`);
        }
        
        setTrackPoints([]);
        setActiveView('explore');
        setShowMenu(true); // torna alla vista iniziale con il menù visibile
    };

    const handleGPXLoad = (points: TrackPoint[], metadata: { name?: string; description?: string; distance?: number }) => {
        console.log('GPX loaded with', points.length, 'points');
        setTrackPoints(points);
        
        // Notify map to display the GPX track points
        window.dispatchEvent(new CustomEvent('mode:change', { 
            detail: { mode: 'create', points: points } 
        }));
    };

    const handleReviewSubmit = (trackId: string, review: any) => {
        addReview(trackId, review);
        alert(`Grazie per la tua recensione di "${selectedTrack?.name}"!`);
        setSelectedTrack(null);
        setActiveView('explore');
        
        // Notify map to refresh track data
        window.dispatchEvent(new CustomEvent('review:added', { detail: { trackId } }));
    };

    const handleCancelReview = () => {
        setSelectedTrack(null);
        setActiveView('explore');
    };

    const handleSaveTour = (tour: any) => {
        const savedTour = addTour(tour);
        alert(`Tour "${tour.name}" creato con successo!\n${tour.tracks.length} singletrack selezionati`);
        
        // Notify map to display the tour
        window.dispatchEvent(new CustomEvent('tour:added', { detail: savedTour }));
        setActiveView('explore');
    };

    const handleCancelTour = () => {
        setActiveView('explore');
        setShowMenu(true); // Show menu when returning to explore view
    };

    const handleSavePOI = (poi: any) => {
        const currentUser = getCurrentUser();
        const savedPOI = addCustomPOI(poi);
        
        // Different message based on user role
        if (canDevelop(currentUser)) {
            alert(`Punto di interesse "${poi.name}" aggiunto con successo!`);
            // Notify map to display the new POI
            window.dispatchEvent(new CustomEvent('poi:added', { detail: savedPOI }));
        } else {
            alert(`Punto di interesse "${poi.name}" inviato per approvazione.\nUn amministratore lo verificherà a breve.`);
        }
        
        // Stay in add-poi view instead of going to explore
        setActiveView('add-poi');
        setShowMenu(false);
    };

    const handleCancelPOI = () => {
        setActiveView('explore');
    };

    const currentUser = getCurrentUser();


    const menuItems: { id: ViewType; label: string; icon: string }[] = [
        { id: 'explore', label: 'Esplora Mappa', icon: '🗺️' },
        { id: 'search', label: 'Cerca Singletrack', icon: '🔍' },
        { id: 'create', label: 'Crea Singletrack', icon: '✏️' },
        { id: 'add-poi', label: 'Inserisci POI', icon: '➕' },
        { id: 'search-tour', label: 'Ricerca Tour', icon: '🔎' },
        { id: 'tour', label: 'Crea Tour', icon: '🚵' },
        { id: 'saved-tours', label: 'I miei tour', icon: '📚' }
    ];

    // Add approval panel and upload tour only for developers/admins
    if (canDevelop(currentUser)) {
        const pendingUsersCount = getPendingUsers().length;
        const pendingTracksCount = getPendingTracks().length;
        const pendingPOIsCount = getPendingPOIs().length;
        const pendingUpdatesCount = getPendingTrackUpdates().length;
        const totalPending = pendingUsersCount + pendingTracksCount + pendingPOIsCount + pendingUpdatesCount;
        const approvalLabel = totalPending > 0 ? `Approvazioni (${totalPending})` : 'Approvazioni';
        menuItems.push({ id: 'approval', label: approvalLabel, icon: '✅' });
        menuItems.push({ id: 'upload-tour', label: 'Carica Tour', icon: '📤' });
    }
    if (currentUser) {
        menuItems.push({ id: 'messages', label: unreadCount > 0 ? `Messaggi (${unreadCount})` : 'Messaggi', icon: '🔔' });
        menuItems.push({ id: 'profile', label: 'Profilo', icon: '👤' });
        menuItems.push({ id: 'settings', label: 'Impostazioni', icon: '⚙️' });
    }

    const categories: { id: POICategory; label: string; icon: string }[] = [
        { id: 'all', label: 'Tutti', icon: '📍' },
        { id: 'bikeshop', label: 'Ciclofficine', icon: '🔧' },
        { id: 'restaurant', label: 'Bar/ristoranti', icon: '🍴' },
        { id: 'fountain', label: 'Fontane', icon: '💧' },
        { id: 'market', label: 'Market', icon: '🏪' },
        { id: 'sleepnride', label: "Sleep'n'ride", icon: '🏠' },
        { id: 'viewpoint', label: 'Panoramici', icon: '📸' },
        { id: 'parking', label: 'Parcheggi', icon: '🅿️' },
        { id: 'campsite', label: 'Campeggi', icon: '⛺' },
    ];

    const filteredPois = selectedCategory === 'all' 
        ? pois 
        : pois.filter(poi => poi.type === selectedCategory);

    const handleLogout = async () => {
        if (confirm('Vuoi disconnetterti?')) {
            await logoutViaBackend();
            window.location.reload();
        }
    };

    const handleMenuItemClick = (view: ViewType) => {
        setActiveView(view);
        setShowMenu(false);
    };

    const handleBackToMenu = () => {
        console.log('[Sidebar] handleBackToMenu: reloading page to clear everything');
        // Reload the page to ensure everything is cleared
        window.location.reload();
    };

    return (
        <div className="sidebar">
            <div className="sidebar-header">
                <div className="sidebar-logo" onClick={() => window.location.reload()} style={{ cursor: 'pointer' }}>
                    <img src="/images/logo.png" alt="Singletrack Logo" />
                    <h1>Singletrack</h1>
                </div>
                <div className="tagline">Outdoor Trail Maps</div>
                {currentUser && (
                    <div style={{ 
                        marginTop: '12px', 
                        padding: '8px 12px', 
                        background: 'rgba(255,255,255,0.1)', 
                        borderRadius: '6px',
                        fontSize: '12px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}>
                        <div style={{ flex: 1 }}>
                            <div style={{ 
                                fontWeight: 600, 
                                color: '#E8D4B8',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}>
                                👤 {currentUser.username}
                                {canDevelop(currentUser) && (
                                    <span style={{
                                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                        color: 'white',
                                        padding: '2px 6px',
                                        borderRadius: '4px',
                                        fontSize: '9px',
                                        fontWeight: 'bold',
                                        textTransform: 'uppercase',
                                        letterSpacing: '0.5px'
                                    }}>
                                        {currentUser.role === 'admin' ? 'ADMIN' : 'DEV'}
                                    </span>
                                )}
                            </div>
                            <div style={{ fontSize: '10px', opacity: 0.7, marginTop: '2px' }}>
                                {currentUser.firstName} {currentUser.lastName}
                            </div>
                        </div>
                        <button
                            onClick={handleLogout}
                            style={{
                                background: 'rgba(231, 76, 60, 0.2)',
                                border: '1px solid rgba(231, 76, 60, 0.4)',
                                color: '#fff',
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                fontWeight: 600
                            }}
                            title="Disconnetti"
                        >
                            🚪
                        </button>
                    </div>
                )}
            </div>
            
            {!showMenu && activeView !== 'explore' && (
                <button
                    onClick={handleBackToMenu}
                    style={{
                        width: '100%',
                        padding: '12px',
                        background: 'linear-gradient(135deg, #95a5a6 0%, #7f8c8d 100%)',
                        color: 'white',
                        border: 'none',
                        borderRadius: '0',
                        fontSize: '14px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                    }}
                >
                    ← Torna al Menù
                </button>
            )}
            
            <nav className="sidebar-nav" style={{ display: showMenu ? 'block' : 'none' }}>
                <button
                    key="explore-btn"
                    className={`nav-button ${activeView === 'explore' ? 'active' : ''}`}
                    onClick={() => setActiveView('explore')}
                >
                    <span className="nav-icon">🗺️</span>
                    <span className="nav-label">Esplora Mappa</span>
                </button>
                {menuItems.slice(1).map((item) => (
                    <button
                        key={item.id}
                        className={`nav-button ${activeView === item.id ? 'active' : ''}`}
                        onClick={() => handleMenuItemClick(item.id)}
                    >
                        <span className="nav-icon">{item.icon}</span>
                        <span className="nav-label">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className={`sidebar-content ${activeView === 'tour' ? 'with-bottom-panel' : ''}`}>
                {activeView === 'explore' && (
                    <>
                        {/* ...existing code... (puoi lasciare solo la gestione POI visibili se vuoi) */}
                    </>
                )}
                {activeView === 'search' && (
                    <SearchTrackForm />
                )}
                {activeView === 'search-tour' && (
                    <>
                        <SearchTourForm onSearch={(results) => {
                            console.log(`Trovati ${results.length} tour`);
                            // I risultati vengono già mostrati nel SearchTourForm
                        }} />
                        <div style={{ padding: '16px', borderTop: '1px solid #ddd', textAlign: 'center' }}>
                            <button 
                                onClick={() => setActiveView('explore-tour')}
                                style={{
                                    padding: '12px 24px',
                                    backgroundColor: '#3498db',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontSize: '14px',
                                    fontWeight: '600'
                                }}
                            >
                                📚 Esplora Tour
                            </button>
                        </div>
                    </>
                )}
                {activeView === 'create' && (
                    <CreateTrackForm
                        points={trackPoints}
                        onCancel={handleCancelCreate}
                        onSave={handleSaveTrack}
                        onClearLastPoint={handleClearLastPoint}
                        onGPXLoad={handleGPXLoad}
                    />
                )}
                {activeView === 'review' && (
                    <ReviewTrackForm
                        track={selectedTrack}
                        onCancel={handleCancelReview}
                        onSubmit={handleReviewSubmit}
                    />
                )}
                {activeView === 'tour' && (
                    <CreateTourForm
                        onCancel={handleCancelTour}
                        onSave={handleSaveTour}
                    />
                )}
                {activeView === 'saved-tours' && (
                    <SavedToursPanel />
                )}
                {activeView === 'add-poi' && (
                    <AddPOIForm
                        onCancel={handleCancelPOI}
                        onSave={handleSavePOI}
                    />
                )}
                {activeView === 'approval' && canDevelop(currentUser) && (
                    <ApprovalPanel />
                )}
                {activeView === 'messages' && currentUser && (
                    <MessagesPanel />
                )}
                {activeView === 'profile' && currentUser && (
                    <UserProfile onClose={() => {
                        setActiveView('explore');
                        // Refresh page to clear state and return to main screen
                        setTimeout(() => {
                            window.location.reload();
                        }, 300);
                    }} />
                )}
                {activeView === 'explore-tour' && (
                    <ExploreTourPanel />
                )}
                {activeView === 'upload-tour' && canDevelop(currentUser) && (
                    <UploadTourForm 
                        onCancel={() => setActiveView('search-tour')}
                        onSave={(tourData) => {
                            console.log('Tour uploaded:', tourData);
                            setActiveView('explore-tour');
                        }} 
                    />
                )}
                {activeView === 'settings' && currentUser && (
                    <DataManager />
                )}
            </div>
        </div>
    );
};

export default Sidebar;