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

export function getDatapointIndexForLap(lap: LapData, time: number): number {
    const timeToDistanceIndexLength = lap.timeToDistanceIndex.length;
    const timeToDistanceIndexStartTime = lap.timeToDistanceIndex[0].time;
    const timeToDistanceIndexEndTime = lap.timeToDistanceIndex[timeToDistanceIndexLength - 1].time;
    
    const timeToDistanceIndexResolution = (timeToDistanceIndexEndTime - timeToDistanceIndexStartTime) / (timeToDistanceIndexLength - 1);
    
    let index = Math.round((time - timeToDistanceIndexStartTime) / timeToDistanceIndexResolution);
    if (index < 0) index = 0;
    else if (index >=  timeToDistanceIndexLength) index = timeToDistanceIndexLength - 1;

    // let index = lap.timeToDistanceIndex.find(dp => dp.time >= time).distanceBasedIndex;
    // if (index == null) index = lap.datapoints[lap.timeToDistanceIndex.length - 1].tine;

    return lap.timeToDistanceIndex[index].distanceBasedIndex;
}

export function getDatapointForLap(lap: LapData, time: number): Datapoint {
    const index = getDatapointIndexForLap(lap, time);
    return lap.datapoints[lap.timeToDistanceIndex[index].distanceBasedIndex];
}

// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForLap(lap: LapData, time: number, referenceLap: LapData): Datapoint {
    const index = getDatapointIndexForLap(lap, time);
    return referenceLap.datapoints[lap.timeToDistanceIndex[index].distanceBasedIndex];
}

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