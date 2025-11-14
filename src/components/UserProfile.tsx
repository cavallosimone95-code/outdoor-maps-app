import React, { useState, useEffect } from 'react';
import { getCurrentUserFromBackend, updateUserProfileViaBackend, changePasswordViaBackend } from '../services/backendAuth';

interface CurrentUser {
    id: string;
    email: string;
    username: string;
    firstName: string;
    lastName: string;
    birthDate: string;
    bio: string;
    location: string;
    phone: string;
    website: string;
    profilePhoto?: string;
    role: string;
    socialLinks?: {
        instagram?: string;
        facebook?: string;
        strava?: string;
    };
}

interface UserProfileProps {
    onClose: () => void;
}

export default function UserProfile({ onClose }: UserProfileProps) {
    const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
    const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    // Profile form data
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        birthDate: '',
        bio: '',
        location: '',
        phone: '',
        website: '',
        instagram: '',
        facebook: '',
        strava: ''
    });
    
    // Password form data
    const [passwordData, setPasswordData] = useState({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
    });
    
    const [profilePhotoPreview, setProfilePhotoPreview] = useState<string>('');
    const [photoChanged, setPhotoChanged] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    useEffect(() => {
        // Fetch user from backend
        const fetchUser = async () => {
            try {
                console.log('[UserProfile] Fetching user from backend...');
                console.log('[UserProfile] API Base URL:', process.env.REACT_APP_API_BASE);
                console.log('[UserProfile] Access Token:', localStorage.getItem('accessToken') ? 'Present' : 'Missing');
                console.log('[UserProfile] Local User:', localStorage.getItem('singletrack_current_user') ? 'Present' : 'Missing');
                
                const user = await getCurrentUserFromBackend();
                console.log('[UserProfile] Backend response:', user);
                
                if (user) {
                    console.log('[UserProfile] User loaded successfully:', user.username);
                    setCurrentUser(user);
                    setFormData({
                        firstName: user.firstName || '',
                        lastName: user.lastName || '',
                        birthDate: user.birthDate || '',
                        bio: user.bio || '',
                        location: user.location || '',
                        phone: user.phone || '',
                        website: user.website || '',
                        instagram: user.socialLinks?.instagram || '',
                        facebook: user.socialLinks?.facebook || '',
                        strava: user.socialLinks?.strava || ''
                    });
                    setProfilePhotoPreview(user.profilePhoto || '');
                } else {
                    console.warn('[UserProfile] No user returned from backend');
                }
            } catch (err) {
                console.error('[UserProfile] Error fetching user:', err);
            }
        };
        fetchUser();
    }, []);

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            // Check file type
            if (!file.type.startsWith('image/')) {
                setMessage({ type: 'error', text: 'Per favore carica un file immagine.' });
                return;
            }

            // Check file size (max 2MB)
            if (file.size > 2 * 1024 * 1024) {
                setMessage({ type: 'error', text: 'L\'immagine è troppo grande. Massimo 2MB.' });
                return;
            }

            const reader = new FileReader();
            reader.onloadend = () => {
                setProfilePhotoPreview(reader.result as string);
                setPhotoChanged(true);
                setMessage({ type: 'success', text: 'Foto caricata con successo. Salva i cambiamenti per confermare.' });
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setIsSaving(true);
        setMessage(null);

        try {
            const profileUpdate = {
                firstName: formData.firstName,
                lastName: formData.lastName,
                birthDate: formData.birthDate,
                bio: formData.bio,
                location: formData.location,
                phone: formData.phone,
                website: formData.website,
                profilePhoto: profilePhotoPreview,
                socialLinks: {
                    instagram: formData.instagram,
                    facebook: formData.facebook,
                    strava: formData.strava
                }
            };

            const result = await updateUserProfileViaBackend(profileUpdate);
            
            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setIsEditing(false);
                setPhotoChanged(false);
                if (result.user) {
                    setCurrentUser(result.user);
                }
                // Dispatch event to update UI
                window.dispatchEvent(new CustomEvent('user:profile-updated'));
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Errore durante il salvataggio. Riprova più tardi.' });
            console.error('Profile update error:', err);
        } finally {
            setIsSaving(false);
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentUser) return;

        setMessage(null);

        if (passwordData.newPassword !== passwordData.confirmPassword) {
            setMessage({ type: 'error', text: 'Le password non coincidono' });
            return;
        }

        try {
            const result = await changePasswordViaBackend(
                passwordData.currentPassword,
                passwordData.newPassword
            );

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (err) {
            setMessage({ type: 'error', text: 'Errore durante il cambio password. Riprova più tardi.' });
            console.error('Password change error:', err);
        }
    };

    if (!currentUser) {
        return (
            <div className="user-profile-panel">
                <div className="panel-header">
                    <h3>👤 Profilo Utente</h3>
                    <button className="close-btn" onClick={onClose}>×</button>
                </div>
                <div style={{ padding: '20px' }}>
                    <p>Nessun utente connesso</p>
                    <div style={{ fontSize: '12px', color: '#666', marginTop: '10px' }}>
                        <p>Debug Info:</p>
                        <p>• API Base: {process.env.REACT_APP_API_BASE || 'undefined'}</p>
                        <p>• Access Token: {localStorage.getItem('accessToken') ? 'Present' : 'Missing'}</p>
                        <p>• Local User: {localStorage.getItem('singletrack_current_user') ? 'Present' : 'Missing'}</p>
                        <p>• Check console for more details</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="user-profile-panel">
            <div className="panel-header">
                <h3>👤 Profilo Utente</h3>
                <button className="close-btn" onClick={onClose}>×</button>
            </div>

            <div className="profile-tabs">
                <button 
                    className={activeTab === 'profile' ? 'tab-active' : ''}
                    onClick={() => setActiveTab('profile')}
                >
                    📝 Profilo
                </button>
                <button 
                    className={activeTab === 'security' ? 'tab-active' : ''}
                    onClick={() => setActiveTab('security')}
                >
                    🔒 Sicurezza
                </button>
            </div>

            {message && (
                <div className={`message ${message.type}`}>
                    {message.text}
                </div>
            )}

            {activeTab === 'profile' && (
                <div className="profile-content">
                    <div className="profile-photo-section">
                        <div className="photo-preview">
                            {profilePhotoPreview ? (
                                <img src={profilePhotoPreview} alt="Profile" />
                            ) : (
                                <div className="photo-placeholder">
                                    {currentUser.firstName?.[0]}{currentUser.lastName?.[0]}
                                </div>
                            )}
                            {photoChanged && <div className="photo-changed-indicator">✓ Modificato</div>}
                        </div>
                        <div className="photo-upload">
                            <label htmlFor="photo-input" className="upload-btn">
                                📷 {isEditing ? 'Cambia foto' : 'Carica foto profilo'}
                            </label>
                            <input
                                id="photo-input"
                                type="file"
                                accept="image/*"
                                onChange={handlePhotoChange}
                                style={{ display: 'none' }}
                            />
                        </div>
                    </div>

                    <div className="profile-info">
                        <div className="info-item">
                            <strong>Username:</strong> @{currentUser.username}
                        </div>
                        <div className="info-item">
                            <strong>Email:</strong> {currentUser.email}
                        </div>
                        <div className="info-item">
                            <strong>Ruolo:</strong> 
                            <span className={`role-badge ${currentUser.role}`}>
                                {currentUser.role === 'admin' && '🛠️ Admin'}
                                {currentUser.role === 'contributor' && '👨‍💻 Contributor'}
                                {currentUser.role === 'plus' && '✨ Plus'}
                                {currentUser.role === 'free' && '👤 Free'}
                                {currentUser.role === 'developer' && '👨‍💻 Developer'}
                                {currentUser.role === 'standard' && '👤 Standard'}
                            </span>
                        </div>
                    </div>

                    {!isEditing ? (
                        <div className="profile-details">
                            <div className="detail-section">
                                <h4>Informazioni Personali</h4>
                                <div className="detail-item">
                                    <strong>Nome:</strong> {formData.firstName} {formData.lastName}
                                </div>
                                <div className="detail-item">
                                    <strong>Data di nascita:</strong> {formData.birthDate}
                                </div>
                                {formData.location && (
                                    <div className="detail-item">
                                        <strong>📍 Località:</strong> {formData.location}
                                    </div>
                                )}
                                {formData.phone && (
                                    <div className="detail-item">
                                        <strong>📱 Telefono:</strong> {formData.phone}
                                    </div>
                                )}
                                {formData.website && (
                                    <div className="detail-item">
                                        <strong>🌐 Sito web:</strong> 
                                        <a href={formData.website} target="_blank" rel="noopener noreferrer">
                                            {formData.website}
                                        </a>
                                    </div>
                                )}
                            </div>

                            {formData.bio && (
                                <div className="detail-section">
                                    <h4>Bio</h4>
                                    <p>{formData.bio}</p>
                                </div>
                            )}

                            {(formData.instagram || formData.facebook || formData.strava) && (
                                <div className="detail-section">
                                    <h4>Social</h4>
                                    {formData.instagram && (
                                        <div className="social-link">
                                            📸 Instagram: <a href={`https://instagram.com/${formData.instagram}`} target="_blank" rel="noopener noreferrer">@{formData.instagram}</a>
                                        </div>
                                    )}
                                    {formData.facebook && (
                                        <div className="social-link">
                                            👥 Facebook: <a href={formData.facebook} target="_blank" rel="noopener noreferrer">{formData.facebook}</a>
                                        </div>
                                    )}
                                    {formData.strava && (
                                        <div className="social-link">
                                            🚴 Strava: <a href={formData.strava} target="_blank" rel="noopener noreferrer">{formData.strava}</a>
                                        </div>
                                    )}
                                </div>
                            )}

                            <button className="btn-edit" onClick={() => setIsEditing(true)}>
                                ✏️ Modifica Profilo
                            </button>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="profile-form">
                            <div className="form-section">
                                <h4>Informazioni Personali</h4>
                                
                                <div className="form-row">
                                    <div className="form-group">
                                        <label>Nome</label>
                                        <input
                                            type="text"
                                            value={formData.firstName}
                                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label>Cognome</label>
                                        <input
                                            type="text"
                                            value={formData.lastName}
                                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label>Data di nascita</label>
                                    <input
                                        type="date"
                                        value={formData.birthDate}
                                        onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="form-group">
                                    <label>📍 Località</label>
                                    <input
                                        type="text"
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        placeholder="Es: Milano, Italia"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>📱 Telefono</label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        placeholder="+39 123 456 7890"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>🌐 Sito web</label>
                                    <input
                                        type="url"
                                        value={formData.website}
                                        onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                                        placeholder="https://..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>Bio</label>
                                    <textarea
                                        value={formData.bio}
                                        onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                                        placeholder="Racconta qualcosa di te..."
                                        rows={4}
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h4>Social</h4>
                                
                                <div className="form-group">
                                    <label>📸 Instagram</label>
                                    <input
                                        type="text"
                                        value={formData.instagram}
                                        onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                                        placeholder="username (senza @)"
                                    />
                                </div>

                                <div className="form-group">
                                    <label>👥 Facebook</label>
                                    <input
                                        type="url"
                                        value={formData.facebook}
                                        onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                                        placeholder="https://facebook.com/..."
                                    />
                                </div>

                                <div className="form-group">
                                    <label>🚴 Strava</label>
                                    <input
                                        type="url"
                                        value={formData.strava}
                                        onChange={(e) => setFormData({ ...formData, strava: e.target.value })}
                                        placeholder="https://strava.com/athletes/..."
                                    />
                                </div>
                            </div>

                            <div className="form-actions">
                                <button 
                                    type="button" 
                                    className="btn-cancel" 
                                    onClick={() => setIsEditing(false)}
                                    disabled={isSaving}
                                >
                                    Annulla
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn-submit"
                                    disabled={isSaving}
                                >
                                    {isSaving ? '💾 Salvataggio...' : '💾 Salva Modifiche'}
                                </button>
                            </div>
                        </form>
                    )}
                </div>
            )}

            {activeTab === 'security' && (
                <div className="security-content">
                    <h4>🔒 Modifica Password</h4>
                    
                    <form onSubmit={handlePasswordChange} className="password-form">
                        <div className="form-group">
                            <label>Password attuale</label>
                            <input
                                type="password"
                                value={passwordData.currentPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Nuova password</label>
                            <input
                                type="password"
                                value={passwordData.newPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                                required
                                minLength={6}
                            />
                            <small>Minimo 6 caratteri</small>
                        </div>

                        <div className="form-group">
                            <label>Conferma nuova password</label>
                            <input
                                type="password"
                                value={passwordData.confirmPassword}
                                onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                                required
                            />
                        </div>

                        <button type="submit" className="btn-submit">
                            🔐 Cambia Password
                        </button>
                    </form>
                </div>
            )}
        </div>
    );
}
