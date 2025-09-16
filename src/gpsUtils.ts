import { Datapoint, LineSegment } from "./types";

interface Vector {
    lat: number;
    lon: number;
}

export function findClosestDatapoint(datapoints: Datapoint[], referenceDatapoint: Datapoint): Datapoint {
    const index = findClosestDatapointIndex(datapoints, referenceDatapoint.lat, referenceDatapoint.lon);
    if (index == -1) return null;
    else return datapoints[index];
}

export function findClosestDatapointIndex(datapoints: Datapoint[], lat: number, lon: number): number {
    if (datapoints.length === 0) {
        return -1;
    }

    // Do a rough search first, spot checking short ranges of datapoints
    const range = 20;
    let closestIndex = 0;
    let minDistance = calculateDistance(lat, lon, datapoints[0].lat, datapoints[0].lon);
    for (let i = range; i < datapoints.length; i+= range) {
        const distance = calculateDistance(lat, lon, datapoints[i].lat, datapoints[i].lon);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    const indexFromRange = closestIndex;

    // Now search thoroughly [-range; +range] interval
    for (let i = Math.max(0, indexFromRange - range); i < Math.min(indexFromRange + range, datapoints.length); i++) {
        const distance = calculateDistance(lat, lon, datapoints[i].lat, datapoints[i].lon);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    // Additionally search start and end of lap
    // TODO this is only needed when indexFromRange is close to the start or end of lap
    // TODO also dedupe this code
    for (let i = 0; i < Math.min(range, datapoints.length); i++) {
        const distance = calculateDistance(lat, lon, datapoints[i].lat, datapoints[i].lon);
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    for (let i = Math.max(0, datapoints.length - range - 1); i < datapoints.length; i++) {
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

export function findDatapointInLapWithInterpolation(currentLap: Datapoint[], currentPointIndex: number, refLap: Datapoint[], refLapMinTime?: number, refLapMaxTime?: number) {
        // Use the same method as sector border crossing to find the intersection
        const perpendicularLine = createPerpendicularLine(currentPointIndex, currentLap);
        
        // Find where the best lap trajectory crosses this perpendicular line
        const refPoint = findDatapointAtBorderCrossingWithInterpolation(refLap, perpendicularLine, refLapMinTime, refLapMaxTime);
        
        return refPoint;
    }

export function createPerpendicularLine(dpIndex: number, datapoints: Datapoint[]): LineSegment {
        // Calculate trajectory direction using nearby points
        const lookAhead = Math.min(5, datapoints.length - dpIndex - 1);
        const lookBehind = Math.min(5, dpIndex);
        
        let trajectoryVector = { lat: 0, lon: 0 };
        
        if (lookAhead > 0 && lookBehind > 0) {
            const beforePoint = datapoints[dpIndex - lookBehind];
            const afterPoint = datapoints[dpIndex + lookAhead];
            
            // Calculate the trajectory direction vector
            trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
            trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
        } else {
            // Fallback: use a smaller window
            if (dpIndex > 0 && dpIndex < datapoints.length - 1) {
                const beforePoint = datapoints[dpIndex - 1];
                const afterPoint = datapoints[dpIndex + 1];
                trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
                trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
            } else {
                // Use GPS heading as last resort
                const headingRad = (datapoints[dpIndex].data.get("GPS Heading") || 0) * Math.PI / 180;
                trajectoryVector.lat = Math.cos(headingRad);
                trajectoryVector.lon = Math.sin(headingRad);
            }
        }
        
        // Apply cosine latitude correction to longitude component
        // This accounts for longitude convergence without complex projections
        const latRad = datapoints[dpIndex].lat * Math.PI / 180;
        const cosLat = Math.cos(latRad);
        
        // Adjust longitude component by cosine of latitude
        const correctedTrajectoryVector = {
            lat: trajectoryVector.lat,
            lon: trajectoryVector.lon * cosLat
        };
        
        // Normalize the corrected trajectory vector
        const trajectoryLength = Math.sqrt(
            correctedTrajectoryVector.lat * correctedTrajectoryVector.lat + 
            correctedTrajectoryVector.lon * correctedTrajectoryVector.lon
        );
        
        if (trajectoryLength > 0) {
            correctedTrajectoryVector.lat /= trajectoryLength;
            correctedTrajectoryVector.lon /= trajectoryLength;
        }
        
        // Create perpendicular vector by rotating 90 degrees
        // For a vector (x, y), the perpendicular vector is (-y, x)
        const perpVector = {
            lat: -correctedTrajectoryVector.lon,  // Perpendicular lat component
            lon: correctedTrajectoryVector.lat    // Perpendicular lon component
        };
        
        // Scale the perpendicular vector to desired length (small finite line)
        const lineLength = 0.00007; // Approximately 7m in degrees
        const perpLat = perpVector.lat * lineLength;
        const perpLon = perpVector.lon * lineLength / cosLat; // Undo cosine correction for final coordinates
        
        return {
            startLat: datapoints[dpIndex].lat - perpLat,
            startLon: datapoints[dpIndex].lon - perpLon,
            endLat: datapoints[dpIndex].lat + perpLat,
            endLon: datapoints[dpIndex].lon + perpLon
        };
    }

    export function findDatapointAtBorderCrossingWithInterpolation(datapoints: Datapoint[], border: LineSegment, minTime?: number, maxTime?: number): Datapoint {
        // Find where the trajectory actually intersects the sector border line
        // This provides much higher precision than just finding the closest point

        // Look for actual intersection between consecutive trajectory segments and the border line
        for (let i = 0; i < datapoints.length - 1; i++) {
            const point1 = datapoints[i];
            if (minTime && point1.time < minTime) continue;

            const point2 = datapoints[i + 1];
            if (maxTime && point2.time > maxTime) continue;
            
            // Check if trajectory segment intersects with border line segment
            const intersection = lineSegmentIntersection(
                point1.lon, point1.lat,
                point2.lon, point2.lat,
                border.startLon, border.startLat,
                border.endLon, border.endLat
            );
            
            if (intersection && intersection.t !== undefined) {
                // Use the interpolation factor directly from the intersection calculation
                // intersection.t is already the correct interpolation factor (0 = point1, 1 = point2)
                const t = Math.max(0, Math.min(1, intersection.t)); // Clamp to [0,1] for safety
                
                // Interpolate
                const interpolatedPoint = Object.assign({}, point1);
                interpolatedPoint.time = point1.time + t * (point2.time - point1.time);
                interpolatedPoint.speed = point1.speed + t * (point2.speed - point1.speed);
                interpolatedPoint.lat = point1.lat + t * (point2.lat - point1.lat);
                interpolatedPoint.lon = point1.lon + t * (point2.lon - point1.lon);
                interpolatedPoint.data = new Map();
                for (let channel of point1.data.keys()) {
                    interpolatedPoint.data.set(channel, point1.data.get(channel) + t * (point2.data.get(channel) - point1.data.get(channel)));
                }

                
                // Validate the result
                if (interpolatedPoint.time >= point1.time && interpolatedPoint.time <= point2.time) {
                    //console.log(`Found precise border crossing at ${interpolatedPoint.time} (t=${t.toFixed(3)}, between ${point1.time} and ${point2.time})`);
                    return interpolatedPoint;
                } else {
                    console.warn(`Invalid interpolated time ${interpolatedPoint.time}, falling back to closest point`);
                }
            }
        }
        
        // Fallback: if no intersection found, use the closest point method
        /*console.log('No intersection found, using closest point method');
        let closestPoint = datapoints[0];
        let minDistance = distanceToLineSegment(closestPoint, border);;
        for (let i = 0; i < datapoints.length; i++) {
            const point = datapoints[i];
            const distance = distanceToLineSegment(point, border);
            
            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = point;
            }
        }
        
        return closestPoint;*/
        return null;
    }

    // Calculate distance from point to finite line segment (not infinite line)
    function distanceToLineSegment(point, border: LineSegment): number {
        const x = point.lon;
        const y = point.lat;
        const x1 = border.startLon;
        const y1 = border.startLat;
        const x2 = border.endLon;
        const y2 = border.endLat;
        
        // Calculate the squared length of the line segment
        const segmentLengthSquared = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        
        // If the segment has zero length, return distance to the point
        if (segmentLengthSquared === 0) {
            return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        }
        
        // Calculate the parameter t that represents the projection of the point onto the line segment
        const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / segmentLengthSquared));
        
        // Calculate the closest point on the line segment
        const closestX = x1 + t * (x2 - x1);
        const closestY = y1 + t * (y2 - y1);
        
        // Return the distance from the point to the closest point on the segment
        return Math.sqrt((x - closestX) * (x - closestX) + (y - closestY) * (y - closestY));
    }

    // Helper method to find intersection between two line segments
    function lineSegmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4): any {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 1e-10) {
            return null; // Lines are parallel
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection point lies within both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                lon: x1 + t * (x2 - x1),  // x1 is longitude
                lat: y1 + t * (y2 - y1),  // y1 is latitude
                t: t  // Return the interpolation factor for the first segment
            };
        }
        
        return null; // No intersection within segments
    }