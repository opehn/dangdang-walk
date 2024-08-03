import { DEFAULT_LAT, DEFAULT_LNG } from '@/constants';
import { Coords, Position } from '@/models/location';
import { useStore } from '@/store';
import { calculateDistance, rdpAlgorithm } from '@/utils/geo';
import { useEffect, useState } from 'react';

const useGeolocation = () => {
    const addRoutes = useStore((state) => state.addRoutes);
    const setRoutes = useStore((state) => state.setRoutes);
    const routes = useStore((state) => state.routes);
    const distance = useStore((state) => state.distance);
    const addDistance = useStore((state) => state.addDistance);

    const [startPosition, setStartPosition] = useState<Position | null>(null);
    const [currentPosition, setCurrentPosition] = useState<Position | null>(null);
    const [isStartGeo, setIsStartGeo] = useState<boolean>(false);
    const [prevPosition, setPrevPosition] = useState<Position | null>(null);
    const [isLocationDisabled, setIsLocationDisabled] = useState<boolean>(false);

    useEffect(() => {
        const onSuccess = (position: GeolocationPosition) => {
            const { latitude: lat, longitude: lng } = position.coords;
            setStartPosition({ lat, lng });
        };
        const onError = (error: GeolocationPositionError) => {
            setStartPosition({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
            setIsLocationDisabled(true);
        };

        if (navigator?.geolocation) {
            navigator.geolocation.getCurrentPosition(onSuccess, onError);
        } else {
            setStartPosition({ lat: DEFAULT_LAT, lng: DEFAULT_LNG });
            setIsLocationDisabled(true);
        }
    }, []);

    useEffect(() => {
        if (!startPosition || !isStartGeo || !navigator.geolocation) return;
        const onSuccess = (position: GeolocationPosition) => {
            if (!isStartGeo) return;
            const { latitude: lat, longitude: lng, accuracy } = position.coords;
            if (accuracy > 30) return;
            setCurrentPosition({ lat, lng });
        };

        const onError = (error: GeolocationPositionError) => {};

        const watchId = navigator.geolocation.watchPosition(onSuccess, onError, {
            enableHighAccuracy: true,
            maximumAge: 2000,
        });

        return () => {
            navigator.geolocation.clearWatch(watchId);
        };
    }, [startPosition, isStartGeo]);

    const startGeo = () => {
        if (routes?.length) {
            const [lat, lng]: Coords = routes[routes.length - 1] as Coords;

            setPrevPosition({ lat, lng });
        }
        setIsStartGeo(true);
    };

    const applyRDP = (routePoints: Coords[]): Coords[] => {
        if (!routePoints || routePoints.length === 0) {
            return [];
        }
        const epsilon = 0.00005;
        const acceptedPointsIndices = rdpAlgorithm(routePoints, 0, routePoints.length - 1, epsilon);
        return routePoints.filter((_, index) => acceptedPointsIndices[index]);
    };

    const stopGeo = () => {
        return new Promise<Coords[]>((resolve) => {
            setIsStartGeo(false);

            setRoutes((prevRoutes) => {
                const simplifiedRoutes = applyRDP(prevRoutes);
                resolve(simplifiedRoutes);

                return simplifiedRoutes;
            });
        });
    };

    useEffect(() => {
        if (!currentPosition) return;
        const { lat, lng } = currentPosition;

        if (prevPosition) {
            const newDistance = calculateDistance(prevPosition.lat, prevPosition.lng, lat, lng);
            if (newDistance < 10) return;

            addDistance(Math.floor(newDistance));
        }
        addRoutes([lat, lng]);
        setPrevPosition({ lat, lng });
    }, [currentPosition]);

    return {
        position: startPosition,
        distance,
        routes,
        currentPosition,
        stopGeo,
        startGeo,
        isLocationDisabled,
        isStartGeo,
        setCurrentPosition,
    };
};

export default useGeolocation;
