import React, { useState, useEffect } from 'react';
import { migrateFromLocalStorage, getStorageInfo } from '../services/indexedDBStorage';

export default function MigrationPanel() {
  const [migrationStatus, setMigrationStatus] = useState<'idle' | 'checking' | 'migrating' | 'done' | 'error'>('idle');
  const [migratedCount, setMigratedCount] = useState(0);
  const [hasLocalStorageData, setHasLocalStorageData] = useState(false);
  const [storageInfo, setStorageInfo] = useState({ usedMB: 0, quotaMB: 0, tours: 0 });
  const [showPanel, setShowPanel] = useState(true);

  useEffect(() => {
    checkForLocalStorageData();
    updateStorageInfo();
  }, []);

  const checkForLocalStorageData = () => {
    const localData = localStorage.getItem('singletrack_tour_archive');
    if (localData) {
      try {
        const tours = JSON.parse(localData);
        setHasLocalStorageData(tours.length > 0);
      } catch (error) {
        setHasLocalStorageData(false);
      }
    }
  };

  const updateStorageInfo = async () => {
    const info = await getStorageInfo();
    setStorageInfo(info);
  };

  const handleMigrate = async () => {
    setMigrationStatus('migrating');
    
    try {
      const count = await migrateFromLocalStorage();
      setMigratedCount(count);
      setMigrationStatus('done');
      await updateStorageInfo();
      
      // Clear localStorage after successful migration
      if (count > 0) {
        localStorage.removeItem('singletrack_tour_archive');
        setHasLocalStorageData(false);
      }
    } catch (error) {
      console.error('Migration failed:', error);
      setMigrationStatus('error');
    }
  };

  if (!hasLocalStorageData && storageInfo.tours === 0) {
    return null; // No data to migrate and no tours in IndexedDB
  }

  if (!showPanel) {
    return null; // User closed the panel
  }

  return (
    <div style={{
      position: 'fixed',
      top: 20,
      right: 20,
      backgroundColor: '#fff3cd',
      border: '2px solid #ffc107',
      borderRadius: 8,
      padding: 16,
      maxWidth: 400,
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
      zIndex: 10000
    }}>
      {/* Close button */}
      <button
        onClick={() => setShowPanel(false)}
        type="button"
        title="Nascondi notifica"
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: 'transparent',
          border: 'none',
          fontSize: 18,
          color: '#856404',
          cursor: 'pointer',
          padding: '4px 8px',
          lineHeight: 1,
          opacity: 0.6,
          transition: 'opacity 0.2s'
        }}
        onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
        onMouseLeave={(e) => e.currentTarget.style.opacity = '0.6'}
      >
        ✕
      </button>      <h3 style={{ margin: '0 0 12px 0', fontSize: 16, color: '#856404' }}>
        🔄 Aggiornamento Storage
      </h3>
      
      {hasLocalStorageData && migrationStatus === 'idle' && (
        <>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, lineHeight: 1.5, color: '#333' }}>
            Abbiamo aggiornato il sistema di archiviazione da <strong>localStorage</strong> (5 MB) a <strong>IndexedDB</strong> (50+ MB).
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, lineHeight: 1.5, color: '#333' }}>
            Clicca qui sotto per migrare i tuoi tour esistenti al nuovo sistema.
          </p>
          <button
            onClick={handleMigrate}
            style={{
              width: '100%',
              padding: '10px',
              backgroundColor: '#ffc107',
              border: 'none',
              borderRadius: 4,
              color: '#333',
              fontWeight: 600,
              fontSize: 14,
              cursor: 'pointer'
            }}
          >
            🚀 Migra ora
          </button>
        </>
      )}

      {migrationStatus === 'migrating' && (
        <p style={{ margin: 0, fontSize: 13, color: '#333' }}>
          ⏳ Migrazione in corso...
        </p>
      )}

      {migrationStatus === 'done' && (
        <>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#28a745', fontWeight: 600 }}>
            ✅ Migrazione completata!
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#333' }}>
            {migratedCount} tour migrati con successo a IndexedDB.
          </p>
          <button
            onClick={() => setMigrationStatus('idle')}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#28a745',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Chiudi
          </button>
        </>
      )}

      {migrationStatus === 'error' && (
        <>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#dc3545', fontWeight: 600 }}>
            ❌ Errore durante la migrazione
          </p>
          <p style={{ margin: '0 0 12px 0', fontSize: 13, color: '#333' }}>
            Controlla la console per i dettagli.
          </p>
          <button
            onClick={() => setMigrationStatus('idle')}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: '#dc3545',
              border: 'none',
              borderRadius: 4,
              color: 'white',
              fontSize: 13,
              cursor: 'pointer'
            }}
          >
            Riprova
          </button>
        </>
      )}

      {!hasLocalStorageData && storageInfo.tours > 0 && (
        <p style={{ margin: 0, fontSize: 13, color: '#28a745' }}>
          ✅ Stai usando IndexedDB con <strong>{storageInfo.tours}</strong> tour ({storageInfo.usedMB} MB / {storageInfo.quotaMB} MB)
        </p>
      )}
    </div>
  );
}
