import React, { useState } from 'react';
import { exportUsersFromLocalStorage, migrateUsersToBackend } from '../services/migrationService';

interface UserMigrationPanelProps {
    onClose: () => void;
    onMigrationComplete?: () => void;
}

export default function UserMigrationPanel({ onClose, onMigrationComplete }: UserMigrationPanelProps) {
    const [users, setUsers] = useState<any[]>([]);
    const [isMigrating, setIsMigrating] = useState(false);
    const [migrationStatus, setMigrationStatus] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);
    const [migrationToken, setMigrationToken] = useState('');
    const [showTokenInput, setShowTokenInput] = useState(false);

    const handleExport = () => {
        const exportedUsers = exportUsersFromLocalStorage();
        setUsers(exportedUsers);
        setMigrationStatus({
            type: 'info',
            text: `Trovati ${exportedUsers.length} utenti da sincronizzare`
        });
    };

    const handleMigrate = async () => {
        if (users.length === 0) {
            setMigrationStatus({
                type: 'error',
                text: 'Nessun utente da sincronizzare'
            });
            return;
        }

        if (!migrationToken) {
            setShowTokenInput(true);
            setMigrationStatus({
                type: 'error',
                text: 'È necessario il token di migrazione'
            });
            return;
        }

        setIsMigrating(true);
        setMigrationStatus({
            type: 'info',
            text: 'Sincronizzazione in corso...'
        });

        try {
            const result = await migrateUsersToBackend(users, migrationToken);

            if (result.success) {
                setMigrationStatus({
                    type: 'success',
                    text: `✅ ${result.message}`
                });

                // Clear localStorage after successful migration
                setTimeout(() => {
                    localStorage.removeItem('singletrack_users');
                    if (onMigrationComplete) {
                        onMigrationComplete();
                    }
                    onClose();
                }, 2000);
            } else {
                setMigrationStatus({
                    type: 'error',
                    text: `❌ ${result.message}`
                });
            }
        } catch (err) {
            setMigrationStatus({
                type: 'error',
                text: 'Errore durante la sincronizzazione'
            });
            console.error('Migration error:', err);
        } finally {
            setIsMigrating(false);
        }
    };

    return (
        <div className="migration-panel" style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999
        }}>
            <div style={{
                background: 'white',
                borderRadius: '8px',
                padding: '24px',
                maxWidth: '500px',
                width: '90%',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
            }}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px'
                }}>
                    <h3>🔄 Sincronizza Dati</h3>
                    <button onClick={onClose} style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer'
                    }}>×</button>
                </div>

                <p style={{ marginBottom: '16px', color: '#666' }}>
                    Sincronizza i tuoi dati locali con il server backend. Questa è un'operazione una tantum.
                </p>

                {migrationStatus && (
                    <div style={{
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        background: migrationStatus.type === 'success' ? '#d4edda' : 
                                   migrationStatus.type === 'error' ? '#f8d7da' : '#d1ecf1',
                        color: migrationStatus.type === 'success' ? '#155724' :
                               migrationStatus.type === 'error' ? '#721c24' : '#0c5460',
                        border: `1px solid ${
                            migrationStatus.type === 'success' ? '#c3e6cb' :
                            migrationStatus.type === 'error' ? '#f5c6cb' : '#bee5eb'
                        }`
                    }}>
                        {migrationStatus.text}
                    </div>
                )}

                {users.length > 0 && (
                    <div style={{
                        background: '#f5f5f5',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        maxHeight: '200px',
                        overflowY: 'auto'
                    }}>
                        <strong>{users.length} utente(i) trovato(i):</strong>
                        <ul style={{ marginTop: '8px', paddingLeft: '20px' }}>
                            {users.map((user, idx) => (
                                <li key={idx} style={{ fontSize: '14px', marginBottom: '4px' }}>
                                    {user.email} ({user.username})
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {showTokenInput && (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '8px' }}>
                            Token di Migrazione:
                        </label>
                        <input
                            type="password"
                            value={migrationToken}
                            onChange={(e) => setMigrationToken(e.target.value)}
                            placeholder="Inserisci il token fornito dall'admin"
                            style={{
                                width: '100%',
                                padding: '8px',
                                border: '1px solid #ddd',
                                borderRadius: '4px',
                                boxSizing: 'border-box'
                            }}
                        />
                    </div>
                )}

                <div style={{
                    display: 'flex',
                    gap: '8px',
                    justifyContent: 'flex-end'
                }}>
                    {users.length === 0 ? (
                        <button
                            onClick={handleExport}
                            style={{
                                padding: '8px 16px',
                                background: '#007bff',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                cursor: 'pointer'
                            }}
                        >
                            📤 Cerchi Dati Locali
                        </button>
                    ) : (
                        <>
                            <button
                                onClick={onClose}
                                style={{
                                    padding: '8px 16px',
                                    background: '#f5f5f5',
                                    color: '#333',
                                    border: '1px solid #ddd',
                                    borderRadius: '4px',
                                    cursor: 'pointer'
                                }}
                            >
                                Annulla
                            </button>
                            <button
                                onClick={handleMigrate}
                                disabled={isMigrating}
                                style={{
                                    padding: '8px 16px',
                                    background: '#28a745',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    cursor: isMigrating ? 'not-allowed' : 'pointer',
                                    opacity: isMigrating ? 0.6 : 1
                                }}
                            >
                                {isMigrating ? '⏳ Sincronizzazione...' : '🔄 Sincronizza'}
                            </button>
                        </>
                    )}
                </div>

                <p style={{
                    fontSize: '12px',
                    color: '#999',
                    marginTop: '16px',
                    borderTop: '1px solid #eee',
                    paddingTop: '12px'
                }}>
                    <strong>Nota:</strong> Assicurati di avere il token di migrazione fornito dall'amministratore prima di procedere.
                </p>
            </div>
        </div>
    );
}
