export const CHECKIN_MAX_DISTANCE_M = 150;
export const CHECKIN_MAX_ACCURACY_M = 150;

const EARTH_RADIUS_M = 6371000;

function toRad(degrees) {
    return degrees * Math.PI / 180;
}

export function haversineMeters(lat1, lng1, lat2, lng2) {
    if (![lat1, lng1, lat2, lng2].every(Number.isFinite)) return null;
    const dLat = toRad(lat2 - lat1);
    const dLng = toRad(lng2 - lng1);
    const a = Math.sin(dLat / 2) ** 2
        + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
    return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export function formatDistance(meters) {
    if (!Number.isFinite(meters)) return "Distance unavailable";
    if (meters < 1000) return `${Math.round(meters)} m`;
    return `${(meters / 1000).toFixed(meters < 10000 ? 1 : 0)} km`;
}

export function evaluateCheckIn({ userLat, userLng, accuracyM, retailerLat, retailerLng }) {
    if (![userLat, userLng, retailerLat, retailerLng].every(Number.isFinite)) {
        return {
            ok: false,
            distanceM: null,
            accuracyM: Number.isFinite(accuracyM) ? accuracyM : null,
            reason: "This retailer has no published coordinates, or the device position was not available."
        };
    }
    const distanceM = haversineMeters(userLat, userLng, retailerLat, retailerLng);
    if (Number.isFinite(accuracyM) && accuracyM > CHECKIN_MAX_ACCURACY_M) {
        return {
            ok: false,
            distanceM,
            accuracyM,
            reason: "The device position is not precise enough for a location check-in."
        };
    }
    if (distanceM > CHECKIN_MAX_DISTANCE_M) {
        return {
            ok: false,
            distanceM,
            accuracyM: Number.isFinite(accuracyM) ? accuracyM : null,
            reason: "The device position is farther than 150 meters from this retailer's published coordinates."
        };
    }
    return {
        ok: true,
        distanceM,
        accuracyM: Number.isFinite(accuracyM) ? accuracyM : null
    };
}

export function requestDevicePosition(options = {}) {
    return new Promise((resolve, reject) => {
        if (!navigator.geolocation) {
            reject(new Error("This browser does not offer device location."));
            return;
        }
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                resolve({
                    lat: pos.coords.latitude,
                    lng: pos.coords.longitude,
                    accuracyM: pos.coords.accuracy
                });
            },
            (error) => {
                const messages = {
                    1: "Location permission was not granted.",
                    2: "The device could not determine a position.",
                    3: "The location request timed out."
                };
                reject(new Error(messages[error && error.code] || "The device position was not available."));
            },
            { enableHighAccuracy: true, timeout: 15000, maximumAge: 0, ...options }
        );
    });
}
