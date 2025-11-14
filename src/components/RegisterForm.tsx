import React, { useState } from 'react';
import { register } from '../services/authService';

interface RegisterFormProps {
    onSuccess: () => void;
    onSwitchToLogin: () => void;
}

export default function RegisterForm({ onSuccess, onSwitchToLogin }: RegisterFormProps) {
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        // Validation
        if (!email || !username || !firstName || !lastName || !birthDate || !password) {
            setError('Tutti i campi sono obbligatori');
            return;
        }

        if (password.length < 6) {
            setError('La password deve contenere almeno 6 caratteri');
            return;
        }

        if (password !== confirmPassword) {
            setError('Le password non corrispondono');
            return;
        }

        // Check age (must be at least 13 years old)
        const birth = new Date(birthDate);
        const today = new Date();
        const age = today.getFullYear() - birth.getFullYear();
        if (age < 13) {
            setError('Devi avere almeno 13 anni per registrarti');
            return;
        }

        try {
            // Register
            const result = await register({
                email,
                username,
                firstName,
                lastName,
                birthDate,
                password
            });

            if (result.success) {
                // Redirect to login page with success message
                onSuccess();
            } else {
                setError(result.message);
            }
        } catch (err) {
            setError('Errore durante la registrazione. Riprova più tardi.');
            console.error('Registration error:', err);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <div className="auth-header">
                    <h1>Singletrack</h1>
                    <h2>Registrazione</h2>
                </div>

                <p className="auth-subtitle">Crea il tuo account per iniziare</p>

                <form onSubmit={handleSubmit} className="auth-form">
                    {error && (
                        <div className="auth-error">
                            ⚠️ {error}
                        </div>
                    )}

                    <div className="form-group">
                        <label>Email *</label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="tua.email@esempio.com"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Nome utente *</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="nomeutente"
                            required
                            minLength={3}
                        />
                    </div>

                    <div className="form-row">
                        <div className="form-group">
                            <label>Nome *</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={(e) => setFirstName(e.target.value)}
                                placeholder="Mario"
                                required
                            />
                        </div>

                        <div className="form-group">
                            <label>Cognome *</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={(e) => setLastName(e.target.value)}
                                placeholder="Rossi"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Data di nascita *</label>
                        <input
                            type="date"
                            value={birthDate}
                            onChange={(e) => setBirthDate(e.target.value)}
                            required
                            max={new Date().toISOString().split('T')[0]}
                        />
                    </div>

                    <div className="form-group">
                        <label>Password *</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Almeno 6 caratteri"
                            required
                            minLength={6}
                        />
                    </div>

                    <div className="form-group">
                        <label>Conferma password *</label>
                        <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Ripeti la password"
                            required
                            minLength={6}
                        />
                    </div>

                    <button type="submit" className="btn-submit" style={{ width: '100%', marginTop: '8px' }}>
                        🚀 Registrati
                    </button>
                </form>

                <div className="auth-footer">
                    <p>
                        Hai già un account?{' '}
                        <button onClick={onSwitchToLogin} className="link-button">
                            Accedi
                        </button>
                    </p>
                </div>
            </div>
        </div>
    );
}
