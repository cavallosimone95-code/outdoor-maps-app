import React, { useState } from 'react';
import LoginForm from './LoginForm';
import RegisterForm from './RegisterForm';

interface AuthPageProps {
    onAuthenticated: () => void;
}

export default function AuthPage({ onAuthenticated }: AuthPageProps) {
    const [showLogin, setShowLogin] = useState(true);
    const [showRegistrationSuccess, setShowRegistrationSuccess] = useState(false);

    const handleRegistrationSuccess = () => {
        // After registration, go back to login page (not auto-login)
        setShowRegistrationSuccess(true);
        setShowLogin(true);
    };

    const handleSwitchToLogin = () => {
        setShowRegistrationSuccess(false);
        setShowLogin(true);
    };

    const handleSwitchToRegister = () => {
        setShowRegistrationSuccess(false);
        setShowLogin(false);
    };

    return (
        <>
            {showLogin ? (
                <LoginForm
                    onSuccess={onAuthenticated}
                    onSwitchToRegister={handleSwitchToRegister}
                    showRegistrationSuccess={showRegistrationSuccess}
                />
            ) : (
                <RegisterForm
                    onSuccess={handleRegistrationSuccess}
                    onSwitchToLogin={handleSwitchToLogin}
                />
            )}
        </>
    );
}
