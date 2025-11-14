// Data Export/Import utilities for backup and restoration

export interface DataBackup {
  version: string;
  exportDate: string;
  data: {
    tracks: any[];
    pois: any[];
    tours: any[];
    reviews: any[];
    users: any[];
    pendingTracks: any[];
    pendingPOIs: any[];
  };
}

const KEYS = {
  TRACKS: 'singletrack_tracks',
  POIS: 'singletrack_pois',
  TOURS: 'singletrack_tours',
  REVIEWS: 'singletrack_reviews',
  USERS: 'singletrack_users',
  PENDING_TRACKS: 'singletrack_pending_tracks',
  PENDING_POIS: 'singletrack_pending_pois',
};

/**
 * Export all data from localStorage to a JSON file
 */
export const exportAllData = (): DataBackup => {
  const backup: DataBackup = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    data: {
      tracks: JSON.parse(localStorage.getItem(KEYS.TRACKS) || '[]'),
      pois: JSON.parse(localStorage.getItem(KEYS.POIS) || '[]'),
      tours: JSON.parse(localStorage.getItem(KEYS.TOURS) || '[]'),
      reviews: JSON.parse(localStorage.getItem(KEYS.REVIEWS) || '[]'),
      users: JSON.parse(localStorage.getItem(KEYS.USERS) || '[]'),
      pendingTracks: JSON.parse(localStorage.getItem(KEYS.PENDING_TRACKS) || '[]'),
      pendingPOIs: JSON.parse(localStorage.getItem(KEYS.PENDING_POIS) || '[]'),
    }
  };

  return backup;
};

/**
 * Download backup as JSON file
 */
export const downloadBackup = (): void => {
  const backup = exportAllData();
  const dataStr = JSON.stringify(backup, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `singletrack_backup_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Import data from JSON file
 */
export const importData = (backup: DataBackup): { success: boolean; message: string } => {
  try {
    if (!backup.data) {
      return { success: false, message: 'Formato backup non valido' };
    }

    // Save all data to localStorage
    if (backup.data.tracks?.length > 0) {
      localStorage.setItem(KEYS.TRACKS, JSON.stringify(backup.data.tracks));
    }
    if (backup.data.pois?.length > 0) {
      localStorage.setItem(KEYS.POIS, JSON.stringify(backup.data.pois));
    }
    if (backup.data.tours?.length > 0) {
      localStorage.setItem(KEYS.TOURS, JSON.stringify(backup.data.tours));
    }
    if (backup.data.reviews?.length > 0) {
      localStorage.setItem(KEYS.REVIEWS, JSON.stringify(backup.data.reviews));
    }
    if (backup.data.users?.length > 0) {
      localStorage.setItem(KEYS.USERS, JSON.stringify(backup.data.users));
    }
    if (backup.data.pendingTracks?.length > 0) {
      localStorage.setItem(KEYS.PENDING_TRACKS, JSON.stringify(backup.data.pendingTracks));
    }
    if (backup.data.pendingPOIs?.length > 0) {
      localStorage.setItem(KEYS.PENDING_POIS, JSON.stringify(backup.data.pendingPOIs));
    }

    return {
      success: true,
      message: `✅ Dati importati con successo!\n- ${backup.data.tracks?.length || 0} tracks\n- ${backup.data.pois?.length || 0} POIs\n- ${backup.data.tours?.length || 0} tours`
    };
  } catch (error) {
    console.error('Error importing data:', error);
    return { success: false, message: 'Errore durante l\'importazione dei dati' };
  }
};

/**
 * Handle file upload for import
 */
export const handleFileUpload = (file: File): Promise<{ success: boolean; message: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        const backup = JSON.parse(content) as DataBackup;
        const result = importData(backup);
        resolve(result);
      } catch (error) {
        resolve({ success: false, message: 'File non valido. Assicurati che sia un backup JSON valido.' });
      }
    };
    reader.onerror = () => {
      resolve({ success: false, message: 'Errore durante la lettura del file' });
    };
    reader.readAsText(file);
  });
};
