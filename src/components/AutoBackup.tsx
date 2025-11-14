import { useEffect } from 'react';
import { getTracks, getCustomPOIs } from '../services/trackStorage';

export default function AutoBackup() {
    useEffect(() => {
        const checkAndBackup = () => {
            const lastBackup = localStorage.getItem('last_auto_backup');
            const now = new Date().getTime();
            const oneDayMs = 24 * 60 * 60 * 1000;

            // Se non c'è mai stato un backup o è passato più di un giorno
            if (!lastBackup || (now - parseInt(lastBackup)) > oneDayMs) {
                performAutoBackup();
                localStorage.setItem('last_auto_backup', now.toString());
            }
        };

        const performAutoBackup = () => {
            const tracks = getTracks();
            const pois = getCustomPOIs();

            // Solo se ci sono dati da salvare
            if (tracks.length === 0 && pois.length === 0) {
                console.log('[Auto-Backup] Nessun dato da salvare');
                return;
            }

            const exportData = {
                version: '1.0',
                exportDate: new Date().toISOString(),
                tracks,
                customPOIs: pois
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            
            const dateStr = new Date().toISOString().split('T')[0];
            a.download = `singletrack_auto_backup_${dateStr}.json`;
            
            document.body.appendChild(a);
            a.click();
            
            setTimeout(() => {
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
            }, 100);

            console.log(`[Auto-Backup] ✅ Backup automatico creato: ${a.download}`);
            
            // Mostra notifica all'utente
            showBackupNotification(tracks.length, pois.length);
        };

        const showBackupNotification = (tracksCount: number, poisCount: number) => {
            // Crea elemento notifica
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                top: 20px;
                right: 20px;
                background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                color: white;
                padding: 16px 20px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                z-index: 10000;
                font-size: 14px;
                font-weight: 600;
                display: flex;
                align-items: center;
                gap: 12px;
                animation: slideInRight 0.3s ease-out;
            `;
            
            notification.innerHTML = `
                <div style="font-size: 24px;">💾</div>
                <div>
                    <div style="margin-bottom: 4px;">Backup automatico creato!</div>
                    <div style="font-size: 12px; opacity: 0.9; font-weight: 400;">
                        ${tracksCount} singletrack, ${poisCount} POI salvati
                    </div>
                </div>
            `;
            
            document.body.appendChild(notification);
            
            // Rimuovi dopo 5 secondi
            setTimeout(() => {
                notification.style.animation = 'slideOutRight 0.3s ease-out';
                setTimeout(() => {
                    document.body.removeChild(notification);
                }, 300);
            }, 5000);
        };

        // Controlla al caricamento
        checkAndBackup();

        // Controlla ogni ora se è il momento di fare il backup
        const interval = setInterval(checkAndBackup, 60 * 60 * 1000);

        return () => clearInterval(interval);
    }, []);

    return null; // Component invisibile
}
