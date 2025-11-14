import React, { useState } from 'react';
import { loginViaBackendWithFallback } from '../services/backendAuth';

interface LoginFormProps {
    onSuccess: () => void;
    onSwitchToRegister: () => void;
    showRegistrationSuccess?: boolean;
}

export default function LoginForm({ onSuccess, onSwitchToRegister, showRegistrationSuccess }: LoginFormProps) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isFallback, setIsFallback] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);
        setIsFallback(false);

        if (!email || !password) {
            setError('Email e password sono obbligatorie');
            setIsLoading(false);
            return;
        }

        try {
            const result = await loginViaBackendWithFallback(email, password);

            if (result.success) {
                // Show warning if fallback was used
                if (result.message?.includes('local data')) {
                    setIsFallback(true);
                }
                
                // Save "remember me" preference
                if (rememberMe) {
                    localStorage.setItem('singletrack_remember_me', 'true');
                } else {
                    localStorage.removeItem('singletrack_remember_me');
                }
                // Store current user info
                if (result.user) {
                    localStorage.setItem('singletrack_user', JSON.stringify(result.user));
                }
                
                // Call success after a short delay to show the fallback message
                if (result.message?.includes('local data')) {
                    setTimeout(() => onSuccess(), 2000);
                } else {
                    onSuccess();
                }
            } else {
                setError(result.message || 'Credenziali non valide');
            }
        } catch (err) {
            setError('Errore durante il login. Riprova più tardi.');
            console.error('Login error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Singletrack</h1>
                    <h2>Accedi</h2>
                </div>

                <p className="auth-subtitle">Bentornato! Inserisci le tue credenziali</p>

                {showRegistrationSuccess && (
                    <div style={{
                        background: '#d4edda',
                        border: '1px solid #c3e6cb',
                        color: '#155724',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        ✅ Registrazione completata! Il tuo account è in attesa di approvazione da parte di un amministratore.
                    </div>
                )}

                {isFallback && (
                    <div style={{
                        background: '#fff3cd',
                        border: '1px solid #ffeaa7',
                        color: '#856404',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '16px',
                        fontSize: '14px',
                        textAlign: 'center'
                    }}>
                        ℹ️ Accesso con dati locali. Sincronizzazione con server in corso...
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tua.email@esempio.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="La tua password"
                            required
                        />
                    </div>

                    <div className="form-group" style={{ marginTop: '8px' }}>
                        <label style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            cursor: 'pointer',
                            fontSize: '14px',
                            fontWeight: 'normal'
                        }}>
                            <input
                                type="checkbox"
                                checked={rememberMe}
                                onChange={(e) => setRememberMe(e.target.checked)}
                                style={{ 
                                    marginRight: '8px',
                                    cursor: 'pointer',
                                    width: '16px',
                                    height: '16px'
                                }}
                            />
                            Rimani connesso
                        </label>
                    </div>

                    <button type="submit" className="btn-submit" style={{ width: '100%', marginTop: '16px' }} disabled={isLoading}>
                        {isLoading ? '⏳ Accesso in corso...' : '🔓 Accedi'}
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Non hai un account?{' '}
                        <button onClick={onSwitchToRegister} className="link-button">
                            Registrati
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
