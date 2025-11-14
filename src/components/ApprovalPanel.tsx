import React, { useState, useEffect } from 'react';
import '../styles/approval-panel.css';
import { 
    getPendingTracks, 
    getPendingPOIs, 
    approveTrack, 
    rejectTrack, 
    approvePOI, 
    rejectPOI,
    PendingTrack,
    PendingPOI,
    getPendingTrackUpdates,
    approveTrackUpdate,
    rejectTrackUpdate,
    PendingTrackUpdate,
    getTracks
} from '../services/trackStorage';
import { 
    getPendingUsers, 
    approveUser, 
    rejectUser,
    getApprovedUsers,
    getDevelopers,
    getBannedUsers,
    promoteToDeveloper,
    banUser,
    unbanUser,
    demoteFromDeveloper,
    deleteUser,
    User 
} from '../services/authService';
import { 
    getPendingUsersFromBackend,
    getApprovedUsersFromBackend,
    approveUserViaBackend,
    rejectUserViaBackend,
    changeUserRoleViaBackend,
    testUserManagementEndpoints,
    BackendUser
} from '../services/userManagementService';

export const ApprovalPanel: React.FC = () => {
    const [pendingTracks, setPendingTracks] = useState<PendingTrack[]>([]);
    const [pendingPOIs, setPendingPOIs] = useState<PendingPOI[]>([]);
    const [pendingUsers, setPendingUsers] = useState<User[]>([]);
    const [approvedUsers, setApprovedUsers] = useState<User[]>([]);
    const [developers, setDevelopers] = useState<User[]>([]);
    const [bannedUsers, setBannedUsers] = useState<User[]>([]);
    const [activeTab, setActiveTab] = useState<'users' | 'tracks' | 'pois' | 'updates' | 'approved-users' | 'developers' | 'banned-users'>('users');
    const [previewingTrackId, setPreviewingTrackId] = useState<string | null>(null);
    const [pendingUpdates, setPendingUpdates] = useState<PendingTrackUpdate[]>([]);
    
    // Backend user management state
    const [backendPendingUsers, setBackendPendingUsers] = useState<BackendUser[]>([]);
    const [backendApprovedUsers, setBackendApprovedUsers] = useState<BackendUser[]>([]);
    const [useBackendUserManagement, setUseBackendUserManagement] = useState<boolean>(false);

    useEffect(() => {
        loadPendingContent();
    }, []);

    const loadPendingContent = async () => {
        // Load tracks and POIs (always from localStorage for now)
        setPendingTracks(getPendingTracks());
        setPendingPOIs(getPendingPOIs());
        setPendingUpdates(getPendingTrackUpdates());
        
        // Test if backend user management is available
        const backendAvailable = await testUserManagementEndpoints();
        console.log('[ApprovalPanel] Backend user management available:', backendAvailable);
        
        if (backendAvailable) {
            setUseBackendUserManagement(true);
            // Load users from backend
            const pendingFromBackend = await getPendingUsersFromBackend();
            const approvedFromBackend = await getApprovedUsersFromBackend();
            
            setBackendPendingUsers(pendingFromBackend);
            setBackendApprovedUsers(approvedFromBackend);
            
            console.log('[ApprovalPanel] Loaded from backend:', {
                pending: pendingFromBackend.length,
                approved: approvedFromBackend.length
            });
        } else {
            setUseBackendUserManagement(false);
            // Fallback to localStorage
            setPendingUsers(getPendingUsers());
            setApprovedUsers(getApprovedUsers());
            setDevelopers(getDevelopers());
            setBannedUsers(getBannedUsers());
            
            console.log('[ApprovalPanel] Using localStorage fallback for users');
        }
    };

    const handleApproveTrack = (trackId: string) => {
        if (window.confirm('Approvare questa traccia?')) {
            approveTrack(trackId);
            loadPendingContent();
            window.dispatchEvent(new CustomEvent('tracks:updated'));
            if (previewingTrackId === trackId) {
                window.dispatchEvent(new CustomEvent('track:preview:clear'));
                setPreviewingTrackId(null);
            }
        }
    };

    const handleRejectTrack = (trackId: string, trackName: string) => {
        if (!window.confirm(`Rifiutare la traccia "${trackName}"?`)) return;
        const reason = window.prompt('Motivazione del rifiuto (facoltativa):');
        rejectTrack(trackId, reason || undefined);
        if (previewingTrackId === trackId) {
            window.dispatchEvent(new CustomEvent('track:preview:clear'));
            setPreviewingTrackId(null);
        }
        loadPendingContent();
    };

    const handlePreviewTrack = (track: PendingTrack) => {
        if (previewingTrackId === track.id) {
            window.dispatchEvent(new CustomEvent('track:preview:clear'));
            setPreviewingTrackId(null);
            return;
        }
        // Dispatch preview event
        window.dispatchEvent(new CustomEvent('track:preview', { detail: { points: track.points, name: track.name } }));
        setPreviewingTrackId(track.id);
    };

    const handleApprovePOI = (poiId: string) => {
        if (window.confirm('Approvare questo POI?')) {
            approvePOI(poiId);
            loadPendingContent();
            window.dispatchEvent(new CustomEvent('pois:updated'));
        }
    };

    const handleRejectPOI = (poiId: string, poiName: string) => {
        if (!window.confirm(`Rifiutare il POI "${poiName}"?`)) return;
        const reason = window.prompt('Motivazione del rifiuto (facoltativa):');
        rejectPOI(poiId, reason || undefined);
        loadPendingContent();
    };

    const handleApproveUser = async (userId: string) => {
        if (!window.confirm('Approvare questo utente? Potrà accedere all\'app.')) return;
        
        if (useBackendUserManagement) {
            const result = await approveUserViaBackend(userId);
            if (result.success) {
                alert('Utente approvato con successo!');
                loadPendingContent(); // Refresh the lists
            } else {
                alert(`Errore: ${result.message}`);
            }
        } else {
            // localStorage fallback
            approveUser(userId);
            loadPendingContent();
        }
    };

    const handleRejectUser = async (userId: string) => {
        if (!window.confirm('Rifiutare questo utente? Il suo account sarà eliminato definitivamente.')) return;
        
        if (useBackendUserManagement) {
            const result = await rejectUserViaBackend(userId);
            if (result.success) {
                alert('Utente rifiutato/eliminato con successo!');
                loadPendingContent(); // Refresh the lists
            } else {
                alert(`Errore: ${result.message}`);
            }
        } else {
            // localStorage fallback
            rejectUser(userId);
            loadPendingContent();
        }
    };

    const handlePromoteToDeveloper = (userId: string, username: string) => {
        if (window.confirm(`Promuovere "${username}" a Sviluppatore? Avrà accesso completo all'app e al pannello di approvazione.`)) {
            promoteToDeveloper(userId);
            loadPendingContent();
        }
    };

    const handleBanUser = (userId: string, username: string) => {
        const reason = window.prompt(`Bannare l'utente "${username}"?\n\nInserisci il motivo del ban (opzionale):`);
        if (reason !== null) {
            const result = banUser(userId, reason || 'No reason provided');
            alert(result.message);
            if (result.success) {
                loadPendingContent();
            }
        }
    };

    const handleUnbanUser = (userId: string, username: string) => {
        if (window.confirm(`Sbannare l'utente "${username}"? Potrà accedere di nuovo all'app.`)) {
            const result = unbanUser(userId);
            alert(result.message);
            if (result.success) {
                loadPendingContent();
            }
        }
    };

    const handleDemoteFromDeveloper = (userId: string, username: string) => {
        const result = window.confirm(`Declassare l'utente "${username}" da sviluppatore a utente standard? Perderà l'accesso alle funzioni di approvazione.`);
        if (result) {
            const demoteResult = demoteFromDeveloper(userId, 'free');
            alert(demoteResult.message);
            if (demoteResult.success) {
                loadPendingContent();
            }
        }
    };

    const handleDeleteUser = (userId: string, username: string) => {
        const confirmDelete = window.confirm(
            `⚠️ ATTENZIONE!\n\nStai per eliminare DEFINITIVAMENTE l'utente "${username}" dall'app.\n\nI seguenti dati verranno MANTENUTTI:\n✓ Tracce approvate caricate\n✓ Punti di interesse approvati\n✓ Recensioni ai singletrack\n\nSolo l'account utente (email, password, profilo) verrà cancellato.\n\nSei veramente sicuro?`
        );
        
        if (confirmDelete) {
            const secondConfirm = window.confirm(
                `ULTIMA CONFERMA:\n\nSei sicuro di voler eliminare "${username}"? Questa azione è IRREVERSIBILE.`
            );
            
            if (secondConfirm) {
                const deleteResult = deleteUser(userId);
                alert(deleteResult.message);
                if (deleteResult.success) {
                    loadPendingContent();
                }
            }
        }
    };

    const getDifficultyLabel = (difficulty: string): string => {
        const labels: Record<string, string> = {
            facile: '🟢 Facile',
            medio: '🔵 Medio',
            difficile: '🔴 Difficile',
            estremo: '⚫ Estremo',
            'ebike-climb': '🟣 E-bike Climb'
        };
        return labels[difficulty] || difficulty;
    };

    const getTypeLabel = (type: string): string => {
        const labels: Record<string, string> = {
            bikeshop: '🔧 Bike Shop',
            restaurant: '🍴 Ristorante',
            fountain: '💧 Fontana',
            market: '🏪 Market',
            sleepnride: '🏠 Sleep & Ride',
            viewpoint: '📸 Punto Panoramico',
            parking: '🅿️ Parcheggio',
            campsite: '⛺ Campeggio'
        };
        return labels[type] || type;
    };

    return (
        <div style={{ padding: '20px' }}>
            <h2 style={{ 
                fontFamily: 'Courier New, monospace',
                color: '#2c3e50',
                marginBottom: '20px'
            }}>
                🔍 Pannello Approvazione
            </h2>

            <div style={{ 
                display: 'flex', 
                gap: '10px', 
                marginBottom: '20px',
                borderBottom: '2px solid #e0e0e0',
                flexWrap: 'wrap'
            }}>
                <button
                    onClick={() => setActiveTab('users')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'users' ? '#667eea' : 'transparent',
                        color: activeTab === 'users' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    In Attesa ({pendingUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('approved-users')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'approved-users' ? '#667eea' : 'transparent',
                        color: activeTab === 'approved-users' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    Utenti Attivi ({approvedUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('developers')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'developers' ? '#667eea' : 'transparent',
                        color: activeTab === 'developers' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    Sviluppatori ({developers.length})
                </button>
                <button
                    onClick={() => setActiveTab('banned-users')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'banned-users' ? '#e74c3c' : 'transparent',
                        color: activeTab === 'banned-users' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    🚫 Bannati ({bannedUsers.length})
                </button>
                <button
                    onClick={() => setActiveTab('tracks')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'tracks' ? '#667eea' : 'transparent',
                        color: activeTab === 'tracks' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    Tracce ({pendingTracks.length})
                </button>
                <button
                    onClick={() => setActiveTab('pois')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'pois' ? '#667eea' : 'transparent',
                        color: activeTab === 'pois' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    POI ({pendingPOIs.length})
                </button>
                <button
                    onClick={() => setActiveTab('updates')}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeTab === 'updates' ? '#667eea' : 'transparent',
                        color: activeTab === 'updates' ? 'white' : '#666',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        borderRadius: '8px 8px 0 0',
                        transition: 'all 0.3s'
                    }}
                >
                    Modifiche ({pendingUpdates.length})
                </button>
            </div>

            {activeTab === 'users' && (
                <div>
                    {useBackendUserManagement && (
                        <div style={{ 
                            background: '#e8f5e8', 
                            padding: '12px', 
                            borderRadius: '8px', 
                            marginBottom: '16px',
                            fontSize: '14px',
                            color: '#2d5a2d'
                        }}>
                            🌐 <strong>Backend User Management Active</strong><br/>
                            Gli utenti sono gestiti tramite database backend. {backendPendingUsers.length} in attesa di approvazione.
                        </div>
                    )}
                    
                    {(!useBackendUserManagement && pendingUsers.length === 0) || (useBackendUserManagement && backendPendingUsers.length === 0) ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            ✓ Nessun utente in attesa di approvazione
                        </p>
                    ) : (
                        (useBackendUserManagement ? backendPendingUsers : pendingUsers).map(user => (
                            <div
                                key={user.id}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {user.firstName} {user.lastName}
                                        </h3>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            👤 Username: <strong>{user.username}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            ✉️ Email: <strong>{user.email}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            🎯 Ruolo: <strong>{user.role}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            📅 Registrato il: {new Date(user.createdAt).toLocaleString('it-IT')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ 
                                            fontSize: '0.85em', 
                                            color: '#666',
                                            background: '#fff3cd',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold'
                                        }}>
                                            ⏳ In attesa
                                        </div>
                                    </div>
                                </div>

                                {('birthDate' in user) && (
                                    <div style={{ 
                                        padding: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        fontSize: '0.85em',
                                        color: '#555',
                                        marginBottom: '12px'
                                    }}>
                                        <strong>Data di nascita:</strong> {new Date((user as User).birthDate).toLocaleDateString('it-IT')}
                                    </div>
                                )}

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => handleRejectUser(user.id)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#c0392b'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#e74c3c'}
                                    >
                                        ❌ Rifiuta
                                    </button>
                                    <button
                                        onClick={() => handleApproveUser(user.id)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#229954'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#27ae60'}
                                    >
                                        ✅ Approva
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'approved-users' && (
                <div>
                    {approvedUsers.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            Nessun utente approvato al momento
                        </p>
                    ) : (
                        approvedUsers.map(user => (
                            <div
                                key={user.id}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {user.firstName} {user.lastName}
                                        </h3>
                                        <div style={{ 
                                            display: 'flex',
                                            gap: '6px',
                                            marginBottom: '12px',
                                            flexWrap: 'wrap'
                                        }}>
                                            <div className="approval-panel-badges-container approved-user-badge" style={{ background: '#d4edda', display: 'inline-block', width: 'auto' }}>
                                                ✅ Attivo
                                            </div>
                                            <div className="approval-panel-badges-container standard-user-badge" style={{ display: 'inline-block', width: 'auto' }}>
                                                👤 Standard
                                            </div>
                                        </div>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            � Username: <strong>{user.username}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            ✉️ Email: <strong>{user.email}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            � Registrato il: {new Date(user.createdAt).toLocaleString('it-IT')}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ 
                                    padding: '12px',
                                    background: 'white',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    color: '#555',
                                    marginBottom: '12px',
                                    border: '1px solid #e0e0e0'
                                }}>
                                    <strong>Data di nascita:</strong> {new Date(user.birthDate).toLocaleDateString('it-IT')}
                                </div>

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => handlePromoteToDeveloper(user.id, user.username)}
                                        style={{
                                            padding: '8px 16px',
                                            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        ⬆️ Promuovi a Sviluppatore
                                    </button>
                                    <button
                                        onClick={() => handleBanUser(user.id, user.username)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        🚫 Banna Utente
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'developers' && (
                <div>
                    {developers.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            Nessuno sviluppatore presente al momento
                        </p>
                    ) : (
                        developers.map(user => (
                            <div
                                key={user.id}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {user.firstName} {user.lastName}
                                        </h3>
                                        <div style={{ 
                                            display: 'flex',
                                            gap: '6px',
                                            marginBottom: '12px',
                                            flexWrap: 'wrap'
                                        }}>
                                            <div className="approval-panel-badges-container developer-badge" style={{ display: 'inline-block', width: 'auto' }}>
                                                🛠️ Sviluppatore
                                            </div>
                                            {user.approved ? (
                                                <div className="approval-panel-badges-container status-badge-active" style={{ display: 'inline-block', width: 'auto' }}>
                                                    ✅ Attivo
                                                </div>
                                            ) : (
                                                <div className="approval-panel-badges-container status-badge-pending" style={{ display: 'inline-block', width: 'auto' }}>
                                                    ⏳ In attesa
                                                </div>
                                            )}
                                        </div>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            👤 Username: <strong>{user.username}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            ✉️ Email: <strong>{user.email}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            📅 Creato il: {new Date(user.createdAt).toLocaleString('it-IT')}
                                        </p>
                                    </div>
                                </div>

                                <div style={{ 
                                    padding: '12px',
                                    background: 'white',
                                    borderRadius: '4px',
                                    fontSize: '0.85em',
                                    color: '#555',
                                    border: '1px solid #e0e0e0'
                                }}>
                                    <strong>Data di nascita:</strong> {new Date(user.birthDate).toLocaleDateString('it-IT')}
                                </div>

                                <div style={{ 
                                    display: 'flex',
                                    gap: '8px',
                                    marginTop: '12px'
                                }}>
                                    {user.role === 'admin' ? (
                                        <div style={{
                                            padding: '8px 16px',
                                            background: '#d4edda',
                                            color: '#155724',
                                            border: '1px solid #c3e6cb',
                                            borderRadius: '4px',
                                            fontSize: '0.85em',
                                            fontWeight: 'bold'
                                        }}>
                                            🔒 Account Admin protetto
                                        </div>
                                    ) : (
                                        <button
                                            onClick={() => handleDemoteFromDeveloper(user.id, user.username)}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#e67e22',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '4px',
                                                cursor: 'pointer',
                                                fontSize: '0.85em',
                                                fontWeight: 'bold',
                                                transition: 'background 0.2s'
                                            }}
                                            onMouseOver={e => e.currentTarget.style.background = '#d35400'}
                                            onMouseOut={e => e.currentTarget.style.background = '#e67e22'}
                                        >
                                            ⬇️ Declassa a Standard
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'banned-users' && (
                <div>
                    {bannedUsers.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            ✓ Nessun utente bannato
                        </p>
                    ) : (
                        bannedUsers.map(user => (
                            <div
                                key={user.id}
                                style={{
                                    border: '2px solid #e74c3c',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#fadbd8'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {user.firstName} {user.lastName}
                                        </h3>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            👤 Username: <strong>{user.username}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            ✉️ Email: <strong>{user.email}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            📅 Bannato il: {user.bannedAt ? new Date(user.bannedAt).toLocaleString('it-IT') : 'N/D'}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ 
                                            fontSize: '0.85em', 
                                            color: '#c0392b',
                                            background: '#fadbd8',
                                            padding: '4px 8px',
                                            borderRadius: '4px',
                                            fontWeight: 'bold',
                                            border: '1px solid #e74c3c'
                                        }}>
                                            🚫 Bannato
                                        </div>
                                    </div>
                                </div>

                                {user.bannedReason && (
                                    <div style={{ 
                                        padding: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        fontSize: '0.85em',
                                        color: '#555',
                                        marginBottom: '12px',
                                        borderLeft: '3px solid #e74c3c'
                                    }}>
                                        <strong>Motivo:</strong> {user.bannedReason}
                                    </div>
                                )}

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => handleUnbanUser(user.id, user.username)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        ✅ Sbanna Utente
                                    </button>
                                    <button
                                        onClick={() => handleDeleteUser(user.id, user.username)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#c0392b',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.8'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        🗑️ Elimina Definitivamente
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'tracks' && (
                <div>
                    {pendingTracks.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            ✓ Nessuna traccia in attesa di approvazione
                        </p>
                    ) : (
                        pendingTracks.map(track => (
                            <div
                                key={track.id}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {track.name}
                                        </h3>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            👤 Inviato da: <strong>{track.userName}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            📅 {new Date(track.submittedAt).toLocaleString('it-IT')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ marginBottom: '4px' }}>
                                            {getDifficultyLabel(track.difficulty)}
                                        </div>
                                        <div style={{ fontSize: '0.9em', color: '#666' }}>
                                            📏 {track.length?.toFixed(2) || '0.00'} km
                                        </div>
                                    </div>
                                </div>

                                {track.description && (
                                    <p style={{ 
                                        margin: '0 0 12px 0',
                                        padding: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        fontSize: '0.9em',
                                        color: '#555'
                                    }}>
                                        {track.description}
                                    </p>
                                )}

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => handleRejectTrack(track.id, track.name)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#c0392b'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#e74c3c'}
                                    >
                                        ❌ Rifiuta
                                    </button>
                                    <button
                                        onClick={() => handlePreviewTrack(track)}
                                        style={{
                                            padding: '8px 16px',
                                            background: previewingTrackId === track.id ? '#8e44ad' : '#2980b9',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'opacity 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.opacity = '0.85'}
                                        onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                                    >
                                        {previewingTrackId === track.id ? '👁️ Nascondi Anteprima' : '👁️ Anteprima'}
                                    </button>
                                    <button
                                        onClick={() => handleApproveTrack(track.id)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#229954'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#27ae60'}
                                    >
                                        ✅ Approva
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'pois' && (
                <div>
                    {pendingPOIs.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            ✓ Nessun POI in attesa di approvazione
                        </p>
                    ) : (
                        pendingPOIs.map(poi => (
                            <div
                                key={poi.id}
                                style={{
                                    border: '1px solid #e0e0e0',
                                    borderRadius: '8px',
                                    padding: '16px',
                                    marginBottom: '12px',
                                    background: '#f9f9f9'
                                }}
                            >
                                <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'flex-start',
                                    marginBottom: '12px'
                                }}>
                                    <div>
                                        <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                            {poi.name}
                                        </h3>
                                        <p style={{ 
                                            margin: '0 0 4px 0', 
                                            color: '#666',
                                            fontSize: '0.9em'
                                        }}>
                                            👤 Inviato da: <strong>{poi.userName}</strong>
                                        </p>
                                        <p style={{ 
                                            margin: '0', 
                                            color: '#999',
                                            fontSize: '0.85em'
                                        }}>
                                            📅 {new Date(poi.submittedAt).toLocaleString('it-IT')}
                                        </p>
                                    </div>
                                    <div style={{ textAlign: 'right' }}>
                                        <div style={{ fontSize: '1.2em', marginBottom: '4px' }}>
                                            {getTypeLabel(poi.type)}
                                        </div>
                                        <div style={{ fontSize: '0.85em', color: '#666' }}>
                                            📍 {poi.location.lat.toFixed(5)}, {poi.location.lng.toFixed(5)}
                                        </div>
                                    </div>
                                </div>

                                {poi.description && (
                                    <p style={{ 
                                        margin: '0 0 12px 0',
                                        padding: '8px',
                                        background: 'white',
                                        borderRadius: '4px',
                                        fontSize: '0.9em',
                                        color: '#555'
                                    }}>
                                        {poi.description}
                                    </p>
                                )}

                                <div style={{ 
                                    display: 'flex', 
                                    gap: '8px',
                                    justifyContent: 'flex-end'
                                }}>
                                    <button
                                        onClick={() => handleRejectPOI(poi.id, poi.name)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#e74c3c',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#c0392b'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#e74c3c'}
                                    >
                                        ❌ Rifiuta
                                    </button>
                                    <button
                                        onClick={() => handleApprovePOI(poi.id)}
                                        style={{
                                            padding: '8px 16px',
                                            background: '#27ae60',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer',
                                            fontWeight: 'bold',
                                            transition: 'background 0.3s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#229954'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = '#27ae60'}
                                    >
                                        ✅ Approva
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {activeTab === 'updates' && (
                <div>
                    {pendingUpdates.length === 0 ? (
                        <p style={{ color: '#999', textAlign: 'center', padding: '40px' }}>
                            ✓ Nessuna modifica in attesa di approvazione
                        </p>
                    ) : (
                        pendingUpdates.map(upd => {
                            const track = getTracks().find(t => t.id === upd.trackId);
                            return (
                                <div
                                    key={upd.id}
                                    style={{
                                        border: '1px solid #e0e0e0',
                                        borderRadius: '8px',
                                        padding: '16px',
                                        marginBottom: '12px',
                                        background: '#f9f9f9'
                                    }}
                                >
                                    <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between',
                                        alignItems: 'flex-start',
                                        marginBottom: '12px'
                                    }}>
                                        <div>
                                            <h3 style={{ margin: '0 0 8px 0', color: '#2c3e50' }}>
                                                {track?.name || `Traccia ${upd.trackId}`}
                                            </h3>
                                            <p style={{ 
                                                margin: '0 0 4px 0', 
                                                color: '#666',
                                                fontSize: '0.9em'
                                            }}>
                                                👤 Proposta da: <strong>{upd.userName}</strong>
                                            </p>
                                            <p style={{ 
                                                margin: '0', 
                                                color: '#999',
                                                fontSize: '0.85em'
                                            }}>
                                                📅 {new Date(upd.submittedAt).toLocaleString('it-IT')}
                                            </p>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ 
                                                fontSize: '0.85em', 
                                                color: '#3f51b5',
                                                background: '#e8eaf6',
                                                padding: '4px 8px',
                                                borderRadius: '4px',
                                                fontWeight: 'bold'
                                            }}>
                                                ✏️ Aggiornamento descrizione
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
                                        <div style={{ background: 'white', borderRadius: 6, padding: 10 }}>
                                            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Descrizione attuale</div>
                                            <div style={{ fontSize: 13, color: '#555', whiteSpace: 'pre-wrap' }}>{upd.oldValue || '—'}</div>
                                        </div>
                                        <div style={{ background: 'white', borderRadius: 6, padding: 10 }}>
                                            <div style={{ fontSize: 12, color: '#999', marginBottom: 6 }}>Nuova descrizione</div>
                                            <div style={{ fontSize: 13, color: '#2c3e50', whiteSpace: 'pre-wrap' }}>{upd.newValue || '—'}</div>
                                        </div>
                                    </div>

                                    <div style={{ 
                                        display: 'flex', 
                                        gap: '8px',
                                        justifyContent: 'flex-end'
                                    }}>
                                        <button
                                            onClick={() => {
                                                if (!window.confirm('Rifiutare questa modifica?')) return;
                                                const reason = window.prompt('Motivazione del rifiuto (facoltativa):');
                                                rejectTrackUpdate(upd.id, reason || undefined);
                                                loadPendingContent();
                                            }}
                                            style={{
                                                padding: '8px 16px',
                                                background: '#e74c3c',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                transition: 'background 0.3s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#c0392b'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = '#e74c3c'}
                                        >
                                            ❌ Rifiuta
                                        </button>
                                        <button
                                            onClick={() => {
                                                if (!window.confirm('Approvare questa modifica?')) return;
                                                approveTrackUpdate(upd.id);
                                                loadPendingContent();
                                                window.dispatchEvent(new CustomEvent('tracks:updated'));
                                            }}
                                            style={{
            									padding: '8px 16px',
                                                background: '#27ae60',
                                                color: 'white',
                                                border: 'none',
                                                borderRadius: '6px',
                                                cursor: 'pointer',
                                                fontWeight: 'bold',
                                                transition: 'background 0.3s'
                                            }}
                                            onMouseEnter={(e) => e.currentTarget.style.background = '#229954'}
                                            onMouseLeave={(e) => e.currentTarget.style.background = '#27ae60'}
                                        >
                                            ✅ Approva
                                        </button>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
};
