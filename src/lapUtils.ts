import { findDatapointInLapWithInterpolation } from "./gpsUtils.js";
import { Datapoint, LapData, Point, TimeToDistanceIndex } from "./types";

export function reindexLap(lap: LapData, referenceLap: LapData) {
    console.log("Reindexing lap ", lap.lapIndex);
    const interpolatedDatapoints: Datapoint[] = [];
    ``
    for (let refDpI = 0; refDpI < referenceLap.datapoints.length; refDpI++) {
        const refDp = referenceLap.datapoints[refDpI];
        let interpolatedDp = findDatapointInLapWithInterpolation(referenceLap.datapoints, refDp, lap.datapoints);
        
        /*if (interpolatedDp == null && refDpI == 0) {
            interpolatedDp = findDatapointInLapWithInterpolation(referenceLap.datapoints, referenceLap.datapoints[1], lap.datapoints);
        } else if (interpolatedDp == null && refDpI == referenceLap.datapoints.length - 1) {
            interpolatedDp = findDatapointInLapWithInterpolation(referenceLap.datapoints, referenceLap.datapoints[referenceLap.datapoints.length - 2], lap.datapoints);
        }*/

       /* if (interpolatedDp == null) {
            console.log("!!!", refDpI, refDp.time-referenceLap.lapStartTime);
            lap.isComplete = false;
            return;
        }*/

        interpolatedDatapoints.push(interpolatedDp);
    }

    lap.datapoints = interpolatedDatapoints;
    
    // Rebuild timeToDistanceIndex to use the same times but point to indexes of the new datapoints sequence
    const datapontsByTime: Map<number, number> = new Map();
    for (let i = 0; i < lap.datapoints.length; i++) {
        datapontsByTime.set(lap.datapoints[i].time, i);
    }

    const sortedTimes = lap.datapoints.map(dp => dp.time).sort();

    let sortedTimesIndex = 0;
    for (let timeToDistance of lap.timeToDistanceIndex) {
        while (sortedTimesIndex < sortedTimes.length - 1 && sortedTimes[sortedTimesIndex] < timeToDistance.time) {
            sortedTimesIndex++;
        }
        timeToDistance.distanceBasedIndex = datapontsByTime.get(sortedTimes[sortedTimesIndex]);
    }
}

/*
function rebuildDatapointsToMatchReferenceLapDatapointsOnDistance(datapoints: Datapoint[], refDatapoints: Datapoint[]): Datapoint[] {
    const timeStep = 0.005;
    const interpolatedDatapoints: Datapoint[] = [];
    const channels = datapoints[0].data.keys();
    for (let i = 0; i < datapoints.length - 1; i++) {
        const dp1 = datapoints[i];
        const dp2 = datapoints[i + 1];

        interpolatedDatapoints.push(dp1);

        for (let time = dp1.time + timeStep; time < dp2.time; time += timeStep) {
            const intermediateDp = Object.assign({}, dp1);
            
            intermediateDp.lat = dp1.lat + (dp2.lat - dp1.lat) * (time - dp1.time) / (dp2.time - dp1.time);
            intermediateDp.lon = dp1.lon + (dp2.lon - dp1.lon) * (time - dp1.time) / (dp2.time - dp1.time);
            intermediateDp.speed = dp1.speed + (dp2.speed - dp1.speed) * (time - dp1.time) / (dp2.time - dp1.time);

            for (let channel of channels) {
                const dp1Val = dp1.data.get(channel);
                const dp2Val = dp2.data.get(channel);
                intermediateDp.data.set(channel, dp1Val + (dp2Val - dp1Val) * (time - dp1.time) / (dp2.time - dp1.time));
            }

            interpolatedDatapoints.push(intermediateDp);
        }
    }

    interpolatedDatapoints.push(datapoints[datapoints.length - 1]);
    
    return refDatapoints.map(refDp => findClosestDatapoint(interpolatedDatapoints, refDp));
}

function rebuildDatapointsToMatchReferenceLapDatapointsOnDistance2(datapoints: Datapoint[], refDatapoints: Datapoint[]): Datapoint[] {
    const interpolatedDatapoints: Datapoint[] = [];

    for (let refDp of refDatapoints) {
        interpolatedDatapoints.push(findDatapointInLapWithInterpolation(refDatapoints, refDp, datapoints));
    }
    return interpolatedDatapoints;
}*/

export function getDatapointForLap(lap: LapData, time: number): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const index = Math.min(lap.timeToDistanceIndex.length - 1, Math.round((time - lap.lapStartTime) / timeBetweenDatapoints));
    return lap.datapoints[lap.timeToDistanceIndex[index].distanceBasedIndex];
}

// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForLap(lap: LapData, time: number, referenceLap: LapData): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const index = Math.min(lap.timeToDistanceIndex.length - 1, Math.round((time - lap.lapStartTime) / timeBetweenDatapoints));
    return referenceLap.datapoints[lap.timeToDistanceIndex[index].distanceBasedIndex];
}

/*// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForLapWithInterpolation(lap: LapData, time: number, referenceLap: LapData): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const index = (time - lap.lapStartTime) / timeBetweenDatapoints;
    const indexFloor = Math.floor(index);
    if (indexFloor == lap.timeToDistanceIndex.length - 1) {
        // No next datapoint to interpolate with
        return referenceLap.datapoints[lap.timeToDistanceIndex[indexFloor].distanceBasedIndex];
    } else if (indexFloor == index) {
        return referenceLap.datapoints[lap.timeToDistanceIndex[indexFloor].distanceBasedIndex];
    } else {
        const ratio = (indexFloor + 1 - index) / (index - indexFloor); // close to 0 when close to dp1
        const dp1 = referenceLap.datapoints[lap.timeToDistanceIndex[indexFloor].distanceBasedIndex];
        const dp2 = referenceLap.datapoints[lap.timeToDistanceIndex[indexFloor + 1].distanceBasedIndex];

        const interpolatedDp = Object.assign({}, dp1);
 
        interpolatedDp.time = (dp1.time + ratio * dp2.time) / (1 + ratio);
        interpolatedDp.speed = (dp1.speed + ratio * dp2.speed) / (1 + ratio);
        interpolatedDp.lat = (dp1.lat + ratio * dp2.lat) / (1 + ratio);
        interpolatedDp.lon = (dp1.lon + ratio * dp2.lon) / (1 + ratio);
        interpolatedDp.data = new Map();
        for (let channel of dp1.data.keys()) {
            interpolatedDp.data.set(channel, (dp1.data.get(channel) + ratio * dp2.data.get(channel)) / (1 + ratio));
        }
        console.log("Interpolated", dp1, dp2, interpolatedDp);
        return interpolatedDp; 
    }
}

// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint, with interpolation
export function getInterpolatedReferenceDatapointForLap(lap: LapData, datapoint: Datapoint, referenceLap: LapData): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const index = Math.min(lap.timeToDistanceIndex.length - 1, Math.round((datapoint.time - lap.lapStartTime) / timeBetweenDatapoints));
    const referenceLapIndex = lap.timeToDistanceIndex[index].distanceBasedIndex;

    if (referenceLapIndex == 0 || referenceLapIndex == referenceLap.datapoints.length - 1) {   
        return referenceLap.datapoints[referenceLapIndex];
    }

    // Interpolation
    const candidateDatapoints: Datapoint[] = [];
    for (let i = referenceLapIndex - 1; i < referenceLapIndex + 1; i++) {
        candidateDatapoints.push(referenceLap.datapoints[i]);
    }
    candidateDatapoints.sort((a, b) => Math.abs(calculateDistance(a.lat, a.lon, datapoint.lat, datapoint.lon)) -  Math.abs(calculateDistance(b.lat, b.lon, datapoint.lat, datapoint.lon)));
    const dp1 = candidateDatapoints[0];
    const dp2 = candidateDatapoints[1];

    const interpolatedDp = Object.assign({}, dp1);
    const distanceRatio = Math.abs(calculateDistance(dp2.lat, dp2.lon, datapoint.lat, datapoint.lon)) / Math.abs(calculateDistance(dp1.lat, dp1.lon, datapoint.lat, datapoint.lon));
    
    interpolatedDp.time = (dp2.time + distanceRatio * dp1.time) / (1 + distanceRatio);
    interpolatedDp.speed = (dp2.speed + distanceRatio * dp1.speed) / (1 + distanceRatio);
    interpolatedDp.lat = (dp2.lat + distanceRatio * dp1.lat) / (1 + distanceRatio);
    interpolatedDp.lon = (dp2.lon + distanceRatio * dp1.lon) / (1 + distanceRatio);
    interpolatedDp.data = new Map();
    for (let channel of dp1.data.keys()) {
        interpolatedDp.data.set(channel, (dp2.data.get(channel) + distanceRatio * dp1.data.get(channel)) / (1 + distanceRatio));
    } 
    return interpolatedDp;  
}*/

export function calculateBestTheoreticalLap(laps: LapData[], referenceLap: LapData): LapData {
    laps = laps.filter(l => l.isComplete);

    if (laps.length == 0) return null;

    const sectorCount = laps[0].sectorTimes.length;
    const bestTheoreticalDatapoints: Datapoint[] = [];
    const bestTheoreticalTimeToDistanceIndex: TimeToDistanceIndex[] = [];
    const bestTheoreticalSectorTimes: number[] = [];
    const bestTheoreticalSectorStartTimes: number[] = [];

    for (let sectorI = 0; sectorI < sectorCount; sectorI++) {
        const bestSectorTime = laps
            .filter(l => l.sectorTimes[sectorI] > 0) // TODO
            .map(l => l.sectorTimes[sectorI])
            .reduce((a, b) => Math.min(a, b));
        const bestSectorLap = laps.find(l => l.sectorTimes[sectorI] == bestSectorTime);
        const bestSectorStartTime = sectorI == 0 ? bestSectorLap.lapStartTime : bestSectorLap.sectorStartTimes[sectorI - 1];

        for (let dp of bestSectorLap.datapoints) {
            if (dp.time < bestSectorStartTime) continue; // Not yet reached the sector
            if (sectorI < sectorCount - 1 && dp.time >= bestSectorLap.sectorStartTimes[sectorI]) break; // Passed the sector

            const newDp = Object.assign({}, dp);
            newDp.time = dp.time - bestSectorStartTime + bestTheoreticalSectorTimes.reduce((a, b) => a + b, 0);
            newDp.data.set("Time", newDp.time);

            bestTheoreticalDatapoints.push(newDp);
        }

        bestTheoreticalSectorTimes.push(bestSectorTime);
        bestTheoreticalSectorStartTimes.push(bestTheoreticalSectorTimes.reduce((a, b) => a + b, 0));
    }

    const bestTheoreticalLapDuration = bestTheoreticalSectorTimes.reduce((a, b) => a + b, 0);

    bestTheoreticalDatapoints.sort((a, b) => a.time - b.time);

    const timeStep = laps[0].datapoints[1].time - laps[0].datapoints[0].time;
    for (let time = 0; time < bestTheoreticalLapDuration; time += timeStep) {
        bestTheoreticalTimeToDistanceIndex.push({
            time: time,
            distanceBasedIndex: 0 // Will be filled later during lap reindexing
        });
    }

    const bestTheoreticalLap: LapData = {
        lapIndex: -1,
        sessionId: laps[0].sessionId,
        lapTime: bestTheoreticalLapDuration,
        lapStartTime: 0,
        datapoints: bestTheoreticalDatapoints,
        timeToDistanceIndex: bestTheoreticalTimeToDistanceIndex,
        sectorTimes: bestTheoreticalSectorTimes,
        sectorStartTimes: bestTheoreticalSectorStartTimes,
        isComplete: true
    };

    reindexLap(bestTheoreticalLap, referenceLap);

    return bestTheoreticalLap;
}

export function correctLatLonOffset(laps: LapData[], referenceLap: LapData) {
    const refCenter = calculateLapCenter(referenceLap);

    for (let lap of laps) {
        const center = calculateLapCenter(lap);

        const latOffset = center.lat - refCenter.lat;
        const lonOffset = center.lon - refCenter.lon;

        console.log("Calculated GPS offset for lap ", lap.lapIndex, "lat", latOffset, "lon", lonOffset);

        if (Math.abs(latOffset) < 0.00003 || Math.abs(lonOffset) < 0.00003) {// ~ 3m
            console.log("Correcting GPS offset for lap ", lap.lapIndex);
            for (let dp of lap.datapoints) {
                dp.lat = dp.lat - latOffset;
                dp.lon = dp.lon - lonOffset;

                if (dp.data.has("GPS Latitude")) {
                    dp.data.set("GPS Latitude", dp.data.get("GPS Latitude") - latOffset);
                }
                if (dp.data.has("GPS Longitude")) {
                    dp.data.set("GPS Longitude", dp.data.get("GPS Longitude") - lonOffset);
                }
            }
        }
    }
}

function calculateLapCenter(lap: LapData): Point {
    let latSum = 0;
    let lonSum = 0;

    for (let dp of lap.datapoints) {
        latSum += dp.lat;
        lonSum += dp.lon;
    }

    return {
        lat: latSum / lap.datapoints.length,
        lon: lonSum / lap.datapoints.length
    }
}