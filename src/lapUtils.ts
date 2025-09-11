import { findDatapointInLapWithInterpolation } from "./gpsUtils.js";
import { Datapoint, LapData, Point, Session, TimeToDistanceIndex } from "./types";

export function reindexLap(session: Session, lap: LapData, referenceLap: LapData) {
    console.log("Reindexing lap ", lap.lapIndex);

    let rawDatapoints = lap.rawDatapoints;
    // Add a few datapoints from previous and next lap for "context"
    if (lap.lapIndex > 0) {
        const prevLap = session.laps[lap.lapIndex - 1];
        rawDatapoints = prevLap.rawDatapoints.slice(-5).concat(rawDatapoints);
    }
    if (lap.lapIndex != -1 && lap.lapIndex < session.laps.length - 1) {
        const nextLap = session.laps[lap.lapIndex + 1];
        rawDatapoints = rawDatapoints.concat(nextLap.rawDatapoints.slice(0, 5));
    }


    const interpolatedDatapoints: Datapoint[] = [];
    for (let refDpI = 0; refDpI < referenceLap.rawDatapoints.length; refDpI++) {
        let interpolatedDp = findDatapointInLapWithInterpolation(referenceLap.rawDatapoints, refDpI, rawDatapoints);

        if (interpolatedDp == null) {
            lap.isComplete = false;
            console.log("Null dp in lap", lap.lapIndex, "at time", referenceLap.rawDatapoints[refDpI].time - referenceLap.lapStartTime);
        }

        interpolatedDatapoints.push(interpolatedDp);
    }


    lap.datapoints = interpolatedDatapoints;
    
    // Rebuild timeToDistanceIndex to use the same times but point to indexes of the new datapoints sequence
    if (lap.rawTimeToDistanceIndex.length < 2 || lap.datapoints.length < 0) return;

    const timeStep = lap.rawTimeToDistanceIndex[1].time - lap.rawTimeToDistanceIndex[0].time;

    for (let time of  lap.rawTimeToDistanceIndex.map(t => t.time)) {
        const timeToDistance = {
            time: time,
            distanceBasedIndex: -1
        };

        let bestDpIdx = 0;
        let bestDpTimeDiff = Number.MAX_VALUE;
        for (let dpIdx = 0; dpIdx < lap.datapoints.length; dpIdx++) {
            const dp = lap.datapoints[dpIdx];
            if (dp == null) continue;
            if (Math.abs(dp.time - time) < bestDpTimeDiff) {
                bestDpIdx = dpIdx;
                bestDpTimeDiff = Math.abs(dp.time - time);
            }
        }
        if (bestDpTimeDiff < 3 * timeStep) { // Allow up to 3 timeSteps of time mismatch
            timeToDistance.distanceBasedIndex = bestDpIdx;
        }

        lap.timeToDistanceIndex.push(timeToDistance);
    }
}

export function getTimeToDistanceIndexIdxForLap(lap: LapData, time: number): number {
    const timeToDistanceIndexLength = lap.timeToDistanceIndex.length;
    const timeToDistanceIndexStartTime = lap.timeToDistanceIndex[0].time;
    const timeToDistanceIndexEndTime = lap.timeToDistanceIndex[timeToDistanceIndexLength - 1].time;
    
    const timeToDistanceIndexResolution = (timeToDistanceIndexEndTime - timeToDistanceIndexStartTime) / (timeToDistanceIndexLength - 1);
    
    let index = Math.round((time - timeToDistanceIndexStartTime) / timeToDistanceIndexResolution);
    if (index < 0) index = 0;
    else if (index >=  timeToDistanceIndexLength) index = timeToDistanceIndexLength - 1;

    // let index = lap.timeToDistanceIndex.find(dp => dp.time >= time).distanceBasedIndex;
    // if (index == null) index = lap.datapoints[lap.timeToDistanceIndex.length - 1].tine;

    return index;
}

export function getDatapointForLap(lap: LapData, time: number): Datapoint {
    const index = getTimeToDistanceIndexIdxForLap(lap, time);
    const dpIdx = lap.timeToDistanceIndex[index].distanceBasedIndex;
    if (dpIdx == -1) return lap.rawDatapoints[lap.rawTimeToDistanceIndex[index].distanceBasedIndex];
    else return lap.datapoints[dpIdx];
}

// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForLap(lap: LapData, time: number, referenceLap: LapData): Datapoint {
    const index = getTimeToDistanceIndexIdxForLap(lap, time);
    const dpIdx = lap.timeToDistanceIndex[index].distanceBasedIndex;
    if (dpIdx == -1) return null;
    else return referenceLap.datapoints[dpIdx];
}

export function calculateBestTheoreticalLap(session: Session, referenceLap: LapData): LapData {
   /* const laps = session.laps.filter(l => l.isComplete);

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
        rawDatapoints: bestTheoreticalDatapoints,
        datapoints: [],
        timeToDistanceIndex: [],
        rawTimeToDistanceIndex: bestTheoreticalTimeToDistanceIndex,
        sectorTimes: bestTheoreticalSectorTimes,
        sectorStartTimes: bestTheoreticalSectorStartTimes,
        isComplete: true
    };

    reindexLap(session, bestTheoreticalLap, referenceLap);

    return bestTheoreticalLap;*/ return null;
}

export function correctLatLonOffset(laps: LapData[], referenceLap: LapData) {
    const refCenter = calculateLapCenter(referenceLap);

    for (let lap of laps) {
        const center = calculateLapCenter(lap);

        const latOffset = center.lat - refCenter.lat;
        const lonOffset = center.lon - refCenter.lon;

        console.log("Calculated GPS offset for lap ", lap.lapIndex, "lat", latOffset, "lon", lonOffset);

        if (Math.abs(latOffset) < 0.00002 || Math.abs(lonOffset) < 0.00002) {// ~ 2m
            console.log("Correcting GPS offset for lap ", lap.lapIndex);
            for (let dp of lap.rawDatapoints) {
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

    for (let dp of lap.rawDatapoints) {
        latSum += dp.lat;
        lonSum += dp.lon;
    }

    return {
        lat: latSum / lap.rawDatapoints.length,
        lon: lonSum / lap.rawDatapoints.length
    }
}