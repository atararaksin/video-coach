import { Datapoint } from "./types";

export function findClosestDatapoint(datapoints: Datapoint[], referenceDatapoint: Datapoint): Datapoint {
    const index = findClosestDatapointIndex(datapoints, referenceDatapoint.lat, referenceDatapoint.lon);
    if (index == -1) return null;
    else return datapoints[index];
}

export function findClosestDatapointIndex(datapoints: Datapoint[], lat: number, lon: number): number {
    if (datapoints.length === 0) {
        return -1;
    }

    let closestIndex = 0;
    let minDistance = calculateDistance(lat, lon, datapoints[0].lat, datapoints[0].lon);

    for (let i = 1; i < datapoints.length; i++) {
        const distance = calculateDistance(lat, lon, datapoints[i].lat, datapoints[i].lon);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    return closestIndex;
}

/**
 * Calculate the distance between two GPS coordinates using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in meters
 */
export function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371000; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180; // φ, λ in radians
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
}
