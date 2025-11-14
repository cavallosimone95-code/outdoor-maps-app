import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import MapView from './components/MapViewClean';
import BackupNotification from './components/BackupNotification';
import AutoBackup from './components/AutoBackup';
import AuthPage from './components/AuthPage';
import TourStatsPanel from './components/TourStatsPanel';
import MigrationPanel from './components/MigrationPanel';
import ReviewTrackForm from './components/ReviewTrackForm';
import EditTrackDescriptionPanel from './components/EditTrackDescriptionPanel';
import ReviewHistoryPanel from './components/ReviewHistoryPanel';
import { isAuthenticated, initializeDefaultAccounts } from './services/authService';
import { populateStartCoordsFromGPX } from './services/indexedDBStorage';
import { migrateToursToCurrentUser, migrateTourWaypoints, addReview, restoreFromIndexedDBBackup } from './services/trackStorage';
import './services/elevationAudit'; // Load global elevation verification functions

export default function MainApp() {
  const [authenticated, setAuthenticated] = useState(false);
  const [stats, setStats] = useState<{
    length?: number;
    elevationGain?: number;
    elevationLoss?: number;
    minElevation?: number;
    maxElevation?: number;
  }>({});
  const [elevationProfile, setElevationProfile] = useState<{ distance: number; elevation: number }[]>([]);
  const [loadingElevation, setLoadingElevation] = useState(false);
  const [sidebarPanelOpen, setSidebarPanelOpen] = useState(false);
  const [reviewTrack, setReviewTrack] = useState<any>(null);
  const [reviewHistoryTrack, setReviewHistoryTrack] = useState<any>(null);
  const [editDescTrack, setEditDescTrack] = useState<any>(null);

  useEffect(() => {
    // Initialize default developer account and migrate users to new password system
    initializeDefaultAccounts();
    
    // Check authentication from both localStorage and backend
    const checkAuthentication = async () => {
      // First check localStorage
      if (isAuthenticated()) {
        setAuthenticated(true);
      } else {
        // If not authenticated locally, try to get user from backend
        try {
          const { getCurrentUserFromBackend } = await import('./services/backendAuth');
          const user = await getCurrentUserFromBackend();
          if (user) {
            // User is authenticated via backend, save to localStorage
            localStorage.setItem('singletrack_current_user', JSON.stringify(user));
            setAuthenticated(true);
            return;
          }
        } catch (error) {
          console.warn('Backend authentication check failed:', error);
        }
        
        // Not authenticated
        setAuthenticated(false);
      }
    };
    
    checkAuthentication();

    // Try to restore from IndexedDB backup if localStorage is empty
    (async () => {
      const localTracks = localStorage.getItem('singletrack_tracks');
      const localPOIs = localStorage.getItem('singletrack_pois');
      
      // Se localStorage è vuoto ma IndexedDB ha un backup, ripristina
      if ((!localTracks || !localPOIs) && (localTracks === null || localPOIs === null)) {
        console.log('[Recovery] Tentando ripristino da backup IndexedDB...');
        const restored = await restoreFromIndexedDBBackup();
        if (restored) {
          console.log('[Recovery] ✅ Dati ripristinati da IndexedDB');
          window.location.reload();
        } else {
          console.log('[Recovery] Nessun backup disponibile su IndexedDB');
        }
      }
    })();
    
    import('./services/authMigration').then(({ migrateUsersToHash }) => {
      migrateUsersToHash();
    });
    
    // Migrate current user session if needed
    try {
      const data = localStorage.getItem('singletrack_current_user');
      if (data) {
        let user = JSON.parse(data);
        let changed = false;
        
        // Add approved field if missing (for old accounts)
        if (user.approved === undefined) {
          user.approved = true;
          changed = true;
        }
        
        // Migrate old roles
        if (user.role === 'developer' || user.role === 'standard') {
          if (user.role === 'developer') {
            user.role = user.id === 'dev_001' ? 'admin' : 'contributor';
            user.approved = true;
          } else if (user.role === 'standard') {
            user.role = 'free';
          }
          changed = true;
        }
        
        if (changed) {
          localStorage.setItem('singletrack_current_user', JSON.stringify(user));
          console.log('[Auth] Migrated user account to new role system:', user.role);
        }
      }
    } catch (e) {
      console.warn('[Auth] Migration failed:', e);
    }
    (async () => {
      try {
        const updated = await populateStartCoordsFromGPX();
        if (updated > 0) {
          console.log(`[Tours] Popolate coordinate di partenza per ${updated} tour`);
        }
      } catch (e) {
        console.warn('Populate start coords failed', e);
      }
    })();
    
    // Migrate existing tours to current user (one-time migration for existing data)
    if (isAuthenticated()) {
      const migrated = migrateToursToCurrentUser();
      if (migrated > 0) {
        console.log(`[App] Migrati ${migrated} tour esistenti all'utente corrente`);
      }
      
      // Migrate tours with only 2 waypoints to have sampled intermediate waypoints
      const waypointsMigrated = migrateTourWaypoints();
      if (waypointsMigrated > 0) {
        console.log(`[App] Migrati ${waypointsMigrated} tour con waypoint campionati`);
      }
    }

    // Auto elevation audit and recalculation (one-time) — runs once per browser unless reset
    (async () => {
      try {
        const already = localStorage.getItem('elev_autorun_done') === '1';
        const allow = (process.env.REACT_APP_ELEV_AUTORUN === 'true') || !already;
        if (!allow) return;
        const { auditTrackElevations } = await import('./services/elevationAudit');
        console.info('[Elevation] Avvio ricalcolo automatico dislivelli con DEM…');
        const summary = await auditTrackElevations({
          forceRecalculate: true,
          updateStorage: true,
          // Leave maxTracks undefined to process all; you may set a cap during early runs
          // maxTracks: 100,
          batchDelayMs: 400,
          tuningOverrides: { 
            method: 'simple',
            k: 0.3, 
            floor: 0.5, 
            cap: 10, 
            win: 3,
            spikeShortMeters: 10,
            spikeShortJump: 100,
            spikeSlope: 10,
            spikeSlopeMinJump: 80
          }
        });
        console.info('[Elevation] Ricalcolo completato:', summary);
        try { localStorage.setItem('elev_autorun_done', '1'); } catch {}
        // Inform UI to refresh stats shown in popups
        try { window.dispatchEvent(new CustomEvent('tracks:updated')); } catch {}
      } catch (e) {
        console.warn('[Elevation] Auto audit failed:', e);
      }
    })();

    // Listen for tour stats and elevation profile events
    const onStats = (e: any) => {
      const detail = e.detail || {};
      console.log('[MainApp] Received tour:stats event:', detail);
      setStats({
        length: detail.length,
        elevationGain: detail.elevationGain,
        elevationLoss: detail.elevationLoss,
        minElevation: detail.minElevation,
        maxElevation: detail.maxElevation
      });
    };

    const onElevationProfile = (e: any) => {
      const profile = (e.detail?.profile || []) as { distance: number; elevation: number }[];
      console.log('[MainApp] Received tour:elevation-profile event, points:', profile.length);
      setElevationProfile(profile);
      setLoadingElevation(false);
    };

    const onSidebarPanelState = (e: any) => {
      const panelOpen = e.detail?.panelOpen || false;
      setSidebarPanelOpen(panelOpen);
    };

    const onTrackReviewClicked = (e: any) => {
      const trackId = e.detail;
      console.log('[MainApp] Track review clicked:', trackId);
      // Find track from storage
      const tracks = JSON.parse(localStorage.getItem('singletrack_tracks') || '[]');
      console.log('[MainApp] Found tracks:', tracks.length);
      const track = tracks.find((t: any) => t.id === trackId);
      console.log('[MainApp] Found track:', track);
      if (track) {
        console.log('[MainApp] Setting reviewTrack');
        setReviewTrack(track);
      } else {
        console.error('[MainApp] Track not found:', trackId);
      }
    };

    const onTrackReviewHistoryClicked = (e: any) => {
      const trackId = e.detail;
      console.log('[MainApp] Track review history clicked:', trackId);
      // Find track from storage
      const tracks = JSON.parse(localStorage.getItem('singletrack_tracks') || '[]');
      const track = tracks.find((t: any) => t.id === trackId);
      if (track) {
        console.log('[MainApp] Setting reviewHistoryTrack');
        setReviewHistoryTrack(track);
      } else {
        console.error('[MainApp] Track not found:', trackId);
      }
    };

    const onTrackEditDescriptionClicked = (e: any) => {
      const trackId = e.detail;
      console.log('[MainApp] Track edit description clicked:', trackId);
      const tracks = JSON.parse(localStorage.getItem('singletrack_tracks') || '[]');
      const track = tracks.find((t: any) => t.id === trackId);
      if (track) {
        setEditDescTrack(track);
      }
    };

    window.addEventListener('tour:stats', onStats as EventListener);
    window.addEventListener('tour:elevation-profile', onElevationProfile as EventListener);
    window.addEventListener('sidebar:panel-state', onSidebarPanelState as EventListener);
    window.addEventListener('track:review-clicked', onTrackReviewClicked as EventListener);
    window.addEventListener('track:review-history-clicked', onTrackReviewHistoryClicked as EventListener);
  window.addEventListener('track:edit-description-clicked', onTrackEditDescriptionClicked as EventListener);

    return () => {
      window.removeEventListener('tour:stats', onStats as EventListener);
      window.removeEventListener('tour:elevation-profile', onElevationProfile as EventListener);
      window.removeEventListener('sidebar:panel-state', onSidebarPanelState as EventListener);
      window.removeEventListener('track:review-clicked', onTrackReviewClicked as EventListener);
      window.removeEventListener('track:review-history-clicked', onTrackReviewHistoryClicked as EventListener);
      window.removeEventListener('track:edit-description-clicked', onTrackEditDescriptionClicked as EventListener);
    };
  }, []);

  const handleAuthenticated = () => {
    setAuthenticated(true);
  };

  const handleReviewSubmit = (trackId: string, review: any) => {
    // Persist review for the given track
    addReview(trackId, review);
    window.dispatchEvent(new CustomEvent('review:added', { detail: { trackId } }));
    setReviewTrack(null);
  };

  const handleReviewCancel = () => {
    setReviewTrack(null);
  };

  const handleReviewHistoryClose = () => {
    setReviewHistoryTrack(null);
  };

  const handleEditDescCancel = () => {
    setEditDescTrack(null);
  };

  const handleEditDescSave = (trackId: string, description: string) => {
    // Lazy import to avoid circular types
    const { submitTrackDescriptionUpdate } = require('./services/trackStorage');
    const res = submitTrackDescriptionUpdate(trackId, description);
    if (res.status === 'approved') {
      alert('Descrizione aggiornata con successo.');
    } else {
      alert('Modifica inviata per approvazione. Sarà visibile dopo la verifica di uno sviluppatore.');
    }
    setEditDescTrack(null);
  };

  if (!authenticated) {
    return <AuthPage onAuthenticated={handleAuthenticated} />;
  }

  return (
    <>
      <BackupNotification />
      <AutoBackup />
      <MigrationPanel />
      <div style={{ display: 'flex', height: '100vh', position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
        <aside style={{ width: 320, height: '100vh', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <Sidebar />
        </aside>
        <main style={{ flex: 1, height: '100vh', overflow: 'hidden', position: 'relative' }}>
          <MapView />
        </main>
      </div>
      {/* Tour stats panel - visible when tour is loaded and no sidebar panel is open */}
      {!sidebarPanelOpen && (elevationProfile.length > 0 || stats.length !== undefined) && (
        <TourStatsPanel
          stats={stats}
          elevationProfile={elevationProfile}
          loadingElevation={loadingElevation}
          routePoints={[]}
        />
      )}
      {/* Review panel - floating at bottom when track review is requested */}
      {reviewTrack && (
        <>
          {/* Overlay - click to close */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999
            }}
            onClick={handleReviewCancel}
          />
          {/* Review panel */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 'calc(320px + 0.5cm)',
            right: '0.5cm',
            maxHeight: '60vh',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'auto',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            padding: '20px'
          }}>
            <ReviewTrackForm
              track={reviewTrack}
              onCancel={handleReviewCancel}
              onSubmit={handleReviewSubmit}
            />
          </div>
        </>
      )}
      {/* Review History panel - floating at bottom when review history is requested */}
      {reviewHistoryTrack && (
        <>
          {/* Overlay - click to close */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999
            }}
            onClick={handleReviewHistoryClose}
          />
          {/* Review History panel */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 'calc(320px + 0.5cm)',
            right: '0.5cm',
            maxHeight: '70vh',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'hidden',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            padding: '20px'
          }}>
            <ReviewHistoryPanel
              track={reviewHistoryTrack}
              onClose={handleReviewHistoryClose}
            />
          </div>
        </>
      )}

      {/* Edit Description panel */}
      {editDescTrack && (
        <>
          {/* Overlay - click to close */}
          <div 
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.3)',
              zIndex: 999
            }}
            onClick={handleEditDescCancel}
          />
          {/* Panel */}
          <div style={{
            position: 'fixed',
            bottom: 0,
            left: 'calc(320px + 0.5cm)',
            right: '0.5cm',
            maxHeight: '60vh',
            background: 'linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)',
            boxShadow: '0 -4px 12px rgba(0,0,0,0.15)',
            zIndex: 1000,
            overflow: 'auto',
            borderTopLeftRadius: '12px',
            borderTopRightRadius: '12px',
            padding: '20px'
          }}>
            <EditTrackDescriptionPanel
              track={editDescTrack}
              onCancel={handleEditDescCancel}
              onSave={handleEditDescSave}
            />
          </div>
        </>
      )}
    </>
  );
}
