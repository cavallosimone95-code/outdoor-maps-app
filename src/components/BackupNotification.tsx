import React, { useEffect, useState } from 'react';
import { getAutoBackup, restoreAutoBackup } from '../services/trackStorage';
import { getCurrentUser, canDevelop } from '../services/authService';

export default function BackupNotification() {
    const [showNotification, setShowNotification] = useState(false);
    const [backupDate, setBackupDate] = useState<string>('');

    useEffect(() => {
    const user = getCurrentUser();
    const isApprovedDeveloper = !!user && canDevelop(user) && user.approved;
        if (!isApprovedDeveloper) {
            setShowNotification(false);
            return;
        }

        const backup = getAutoBackup();
        if (backup && backup.timestamp) {
            const date = new Date(backup.timestamp);
            const now = new Date();
            const hoursDiff = (now.getTime() - date.getTime()) / (1000 * 60 * 60);

            // Mostra notifica solo se il backup è recente (ultime 24 ore)
            if (hoursDiff < 24) {
                setBackupDate(date.toLocaleString('it-IT'));
                setShowNotification(true);
            }
        }
    }, []);

    const handleRestore = () => {
        const confirmed = confirm(
            `🔄 Ripristinare il backup automatico?\n\n` +
            `Data backup: ${backupDate}\n\n` +
            `Questa operazione sostituirà i dati attuali.\n` +
            `Sei sicuro di voler continuare?`
        );

        if (confirmed) {
            const success = restoreAutoBackup();
            if (success) {
                alert('✅ Backup ripristinato con successo!\n\nLa pagina verrà ricaricata.');
                window.location.reload();
            } else {
                alert('❌ Errore durante il ripristino del backup.');
            }
        }
    };

    const handleDismiss = () => {
        setShowNotification(false);
    };

    if (!showNotification) return null;

    return (
        <div style={{
            position: 'fixed',
            top: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            color: '#fff',
            padding: '16px 20px',
            borderRadius: '12px',
            boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
            zIndex: 10000,
            maxWidth: '400px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            animation: 'slideDown 0.3s ease-out'
        }}>
            <div style={{ display: 'flex', alignItems: 'start', gap: '12px' }}>
                <div style={{ fontSize: '24px' }}>💾</div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>
                        Backup automatico disponibile
                    </div>
                    <div style={{ fontSize: '13px', opacity: 0.9 }}>
                        Salvato il {backupDate}
                    </div>
                </div>
                <button
                    onClick={handleDismiss}
                    style={{
                        background: 'rgba(255,255,255,0.2)',
                        border: 'none',
                        color: '#fff',
                        width: '24px',
                        height: '24px',
                        borderRadius: '50%',
                        cursor: 'pointer',
                        fontSize: '16px',
                        lineHeight: '1',
                        padding: 0
                    }}
                >
                    ×
                </button>
            </div>
            <div style={{ display: 'flex', gap: '8px' }}>
                <button
                    onClick={handleRestore}
                    style={{
                        flex: 1,
                        background: '#fff',
                        color: '#667eea',
                        border: 'none',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    🔄 Ripristina
                </button>
                <button
                    onClick={handleDismiss}
                    style={{
                        flex: 1,
                        background: 'rgba(255,255,255,0.15)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.3)',
                        padding: '8px 16px',
                        borderRadius: '6px',
                        fontWeight: 600,
                        cursor: 'pointer',
                        fontSize: '13px'
                    }}
                >
                    Ignora
                </button>
            </div>
        </div>
    );
}
