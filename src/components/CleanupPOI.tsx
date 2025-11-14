import React, { useEffect } from 'react';

export const CleanupPOI: React.FC = () => {
    useEffect(() => {
        // Elimina tutti i POI nella zona di Milano
        const pois = JSON.parse(localStorage.getItem('singletrack_pois') || '[]');
        console.log('POI totali prima:', pois.length);
        
        const filtered = pois.filter((p: any) => {
            // Controlla se è nella zona di Milano (lat ~45.4, lng ~9.1)
            const isMilano = p.location && 
                           p.location.lat >= 45.3 && p.location.lat <= 45.6 && 
                           p.location.lng >= 9.0 && p.location.lng <= 9.3;
            
            if (isMilano) {
                console.log('Eliminato POI Milano:', p.name, '-', p.location.lat, p.location.lng);
                return false;
            }
            return true;
        });
        
        localStorage.setItem('singletrack_pois', JSON.stringify(filtered));
        console.log(`Eliminati ${pois.length - filtered.length} POI dalla zona di Milano`);
        console.log('POI rimanenti:', filtered.length);
        
        // Notifica la mappa di ricaricare i POI
        setTimeout(() => {
            window.dispatchEvent(new CustomEvent('poi:added'));
            alert(`Eliminati ${pois.length - filtered.length} POI dalla zona di Milano!`);
        }, 500);
    }, []);

    return null;
};
