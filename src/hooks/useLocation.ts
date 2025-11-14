import { useState, useEffect } from 'react';
import type { UserLocation } from '../types';

export const useLocation = () => {
    const [location, setLocation] = useState<UserLocation | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleSuccess = (position: GeolocationPosition) => {
            const { latitude, longitude, accuracy } = position.coords;
            setLocation({ latitude, longitude, accuracy });
        };

        const handleError = (error: GeolocationPositionError) => {
            setError(error.message);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(handleSuccess, handleError);
        } else {
            setError('Geolocation is not supported by this browser.');
        }
    }, []);

    const latitude = location?.latitude ?? null;
    const longitude = location?.longitude ?? null;

    return { location, latitude, longitude, error };
};

export default useLocation;