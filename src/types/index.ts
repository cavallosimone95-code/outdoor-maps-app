export const REACT_APP_MAP_PROVIDER = 'BIKE';
export const REACT_APP_THUNDERFOREST_KEY = 'bd2cbf821b694c9996bbccfe444dfef1';
export interface MapProps {
    center: {
        lat: number;
        lng: number;
    };
    zoom: number;
}

export interface POI {
    id: string;
    name: string;
    description: string;
    location: {
        lat: number;
        lng: number;
    };
    // optional type used by components to choose icon/color (e.g. 'viewpoint', 'parking', 'trailhead')
    type?: string;
    // optional computed distance from user in meters
    distance?: number;
}

export interface UserLocation {
    latitude: number;
    longitude: number;
    accuracy: number;
}