// IndexedDB storage for tours - much larger capacity than localStorage
// Typical limit: 50+ MB (can request unlimited with permission)

const DB_NAME = 'SingletrackDB';
const DB_VERSION = 1;
const STORE_NAME = 'tours';

let dbInstance: IDBDatabase | null = null;

// Open/create database
const openDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(request.result);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      
      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const objectStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        objectStore.createIndex('location', 'location', { unique: false });
        objectStore.createIndex('difficulty', 'difficulty', { unique: false });
        objectStore.createIndex('createdAt', 'createdAt', { unique: false });
        console.log('[IndexedDB] Object store created');
      }
    };
  });
};

export interface ArchiveTour {
  id: string;
  name: string;
  description?: string;
  location: string;
  radius?: number;
  difficulty: 'facile' | 'medio' | 'difficile' | 'estremo' | 'ebike-climb';
  totalLength: number;
  totalElevationGain: number;
  totalElevationLoss: number;
  bikeType: 'XC' | 'Hardtail' | 'Trail bike' | 'All Mountain' | 'Enduro' | 'E-bike' | 'Gravel';
  gpxData?: string;
  createdBy: string;
  createdAt: string;
  startLat?: number; // coordinate punto di partenza (per ricerca raggio reale)
  startLng?: number;
}

// Get all tours
export const getArchiveTours = async (): Promise<ArchiveTour[]> => {
  try {
    const db = await openDB();
    
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly');
      const objectStore = transaction.objectStore(STORE_NAME);
      const request = objectStore.getAll();

      request.onsuccess = () => {
        const tours = request.result as ArchiveTour[];
        console.log(`[IndexedDB] Loaded ${tours.length} tours`);
        resolve(tours);
      };
      request.onerror = () => reject(request.error);
    });
  } catch (error) {
    console.error('[IndexedDB] Error loading tours:', error);
    return [];
  }
};


// Populate startLat/startLng from existing gpxData for tours missing them
export const populateStartCoordsFromGPX = async (): Promise<number> => {
  try {
    const tours = await getArchiveTours();
    let updated = 0;
    for (const tour of tours) {
      if ((tour.startLat == null || tour.startLng == null) && tour.gpxData) {
        try {
          const parser = new DOMParser();
          const gpxDoc = parser.parseFromString(tour.gpxData, 'application/xml');
          const firstTrkpt = gpxDoc.querySelector('trkpt');
          if (firstTrkpt) {
            const latStr = firstTrkpt.getAttribute('lat');
            const lonStr = firstTrkpt.getAttribute('lon');
            const lat = latStr ? parseFloat(latStr) : NaN;
            const lng = lonStr ? parseFloat(lonStr) : NaN;
            if (!isNaN(lat) && !isNaN(lng)) {
              // Use existing updateArchiveTour with id + partial updates
              await updateArchiveTour(tour.id, { startLat: lat, startLng: lng });
              updated++;
            }
          }
        } catch (err) {
          console.warn('[IndexedDB] Failed extracting start coords for tour', tour.id, err);
        }
      }
    }
    return updated;
  } catch (err) {
    console.error('[IndexedDB] populateStartCoordsFromGPX error:', err);
    return 0;
  }
};

// Add a tour
export const addArchiveTour = async (tour: Omit<ArchiveTour, 'id' | 'createdAt'>): Promise<ArchiveTour> => {
  const db = await openDB();
  
  const newTour: ArchiveTour = {
    ...tour,
    id: `tour-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    createdAt: new Date().toISOString()
  };

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.add(newTour);

    request.onsuccess = () => {
      console.log('[IndexedDB] Tour added:', newTour.name);
      
      // Dispatch event for components listening
      window.dispatchEvent(new CustomEvent('tours:updated'));
      
      resolve(newTour);
    };
    request.onerror = () => reject(request.error);
  });
};

// Update a tour
export const updateArchiveTour = async (tourId: string, updates: Partial<ArchiveTour>): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const getRequest = objectStore.get(tourId);

    getRequest.onsuccess = () => {
      const tour = getRequest.result;
      if (!tour) {
        reject(new Error('Tour not found'));
        return;
      }

      const updatedTour = { ...tour, ...updates };
      const updateRequest = objectStore.put(updatedTour);

      updateRequest.onsuccess = () => {
        console.log('[IndexedDB] Tour updated:', tourId);
        window.dispatchEvent(new CustomEvent('tours:updated'));
        resolve();
      };
      updateRequest.onerror = () => reject(updateRequest.error);
    };
    getRequest.onerror = () => reject(getRequest.error);
  });
};

// Delete a tour
export const deleteArchiveTour = async (tourId: string): Promise<void> => {
  const db = await openDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const objectStore = transaction.objectStore(STORE_NAME);
    const request = objectStore.delete(tourId);

    request.onsuccess = () => {
      console.log('[IndexedDB] Tour deleted:', tourId);
      window.dispatchEvent(new CustomEvent('tours:updated'));
      resolve();
    };
    request.onerror = () => reject(request.error);
  });
};

// Search tours with filters
export const searchArchiveTours = async (filters: {
  location?: string;          // testo località (optional se si usano coordinate centro)
  centerLat?: number;         // lat centro ricerca
  centerLng?: number;         // lng centro ricerca
  radius?: number;            // raggio in km
  difficulty?: string;
  bikeType?: string;
  minKm?: number;
  maxKm?: number;
  minElev?: number;
  maxElev?: number;
}): Promise<ArchiveTour[]> => {
  const allTours = await getArchiveTours();
  
  return allTours.filter(tour => {
    // Location text filter (solo se non si è fornito centro+radius)
    if (filters.location && !(filters.centerLat !== undefined && filters.centerLng !== undefined && filters.radius)) {
      if (!tour.location.toLowerCase().includes(filters.location.toLowerCase())) {
        return false;
      }
    }
    
    // Difficulty filter (skip if 'all')
    if (filters.difficulty && filters.difficulty !== 'all' && tour.difficulty !== filters.difficulty) {
      return false;
    }
    
    // Bike type filter (skip if 'all')
    if (filters.bikeType && filters.bikeType !== 'all' && tour.bikeType !== filters.bikeType) {
      return false;
    }
    
    // Length filters
    if (filters.minKm !== undefined && filters.minKm !== null && tour.totalLength < filters.minKm) {
      return false;
    }
    if (filters.maxKm !== undefined && filters.maxKm !== null && tour.totalLength > filters.maxKm) {
      return false;
    }
    
    // Elevation gain filters
    if (filters.minElev !== undefined && filters.minElev !== null && tour.totalElevationGain < filters.minElev) {
      return false;
    }
    if (filters.maxElev !== undefined && filters.maxElev !== null && tour.totalElevationGain > filters.maxElev) {
      return false;
    }
    
    // Proximity filter (Haversine) se centro e raggio sono forniti
    if (filters.centerLat !== undefined && filters.centerLng !== undefined && filters.radius) {
      if (typeof tour.startLat !== 'number' || typeof tour.startLng !== 'number') {
        // Tour privo di coordinate: escludi dalla ricerca basata sul raggio
        return false;
      }
      const R = 6371; // raggio terrestre km
      const toRad = (deg: number) => deg * Math.PI / 180;
      const dLat = toRad(tour.startLat - filters.centerLat);
      const dLng = toRad(tour.startLng - filters.centerLng);
      const a = Math.sin(dLat/2)**2 + Math.cos(toRad(filters.centerLat)) * Math.cos(toRad(tour.startLat)) * Math.sin(dLng/2)**2;
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      const distanceKm = R * c;
      if (distanceKm > filters.radius) return false;
    }
    return true;
  });
};

// Get storage usage estimate (IndexedDB API)
export const getStorageInfo = async (): Promise<{ usedMB: number; quotaMB: number; tours: number }> => {
  try {
    const tours = await getArchiveTours();
    
    // Modern browsers support Storage API
    if ('storage' in navigator && 'estimate' in navigator.storage) {
      const estimate = await navigator.storage.estimate();
      const usedBytes = estimate.usage || 0;
      const quotaBytes = estimate.quota || 0;
      
      return {
        usedMB: parseFloat((usedBytes / (1024 * 1024)).toFixed(2)),
        quotaMB: parseFloat((quotaBytes / (1024 * 1024)).toFixed(2)),
        tours: tours.length
      };
    }
    
    // Fallback: estimate based on data size
    const totalSize = tours.reduce((sum, tour) => {
      return sum + (tour.gpxData?.length || 0) + JSON.stringify(tour).length;
    }, 0);
    
    return {
      usedMB: parseFloat((totalSize / (1024 * 1024)).toFixed(2)),
      quotaMB: 50, // Typical minimum for IndexedDB
      tours: tours.length
    };
  } catch (error) {
    console.error('[IndexedDB] Error getting storage info:', error);
    return { usedMB: 0, quotaMB: 50, tours: 0 };
  }
};

// Migrate data from localStorage to IndexedDB
export const migrateFromLocalStorage = async (): Promise<number> => {
  try {
    const localData = localStorage.getItem('singletrack_tour_archive');
    if (!localData) {
      console.log('[Migration] No localStorage data to migrate');
      return 0;
    }

    const tours: ArchiveTour[] = JSON.parse(localData);
    console.log(`[Migration] Found ${tours.length} tours in localStorage`);

    let migrated = 0;
    for (const tour of tours) {
      try {
        await addArchiveTour(tour);
        migrated++;
      } catch (error) {
        console.error('[Migration] Failed to migrate tour:', tour.name, error);
      }
    }

    console.log(`[Migration] Successfully migrated ${migrated}/${tours.length} tours`);
    
    // Optionally clear localStorage after successful migration
    // localStorage.removeItem('singletrack_tour_archive');
    
    return migrated;
  } catch (error) {
    console.error('[Migration] Error during migration:', error);
    return 0;
  }
};
