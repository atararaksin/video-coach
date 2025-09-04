import { findClosestDatapoint } from "./gpsUtils.js";
import { Datapoint, LapData, TimeToDistanceIndex } from "./types";

export function reindexLap(lap: LapData, referenceLap: LapData) {
    // Rebuild datapoints sequence to be distance-matched with the reference map
    lap.datapoints = rebuildDatapointsToMatchReferenceLapDatapointsOnDistance(lap.datapoints, referenceLap.datapoints);
    
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

export function calculateBestTheoreticalLap(laps: LapData[], referenceLap: LapData): LapData {
    if (laps.length == 0) return null;

    const sectorCount = laps[0].sectorTimes.length;
    const bestTheoreticalDatapoints: Datapoint[] = [];
    const bestTheoreticalTimeToDistanceIndex: TimeToDistanceIndex[] = [];
    const bestTheoreticalSectorTimes: number[] = [];
    const bestTheoreticalSectorStartTimes: number[] = [];

    for (let sectorI = 0; sectorI < sectorCount; sectorI++) {
        const bestSectorTime = laps.map(l => l.sectorTimes[sectorI]).reduce((a, b) => Math.min(a, b));
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
        lapStartTime: bestTheoreticalSectorStartTimes[0],
        datapoints: bestTheoreticalDatapoints,
        timeToDistanceIndex: bestTheoreticalTimeToDistanceIndex,
        sectorTimes: bestTheoreticalSectorTimes,
        sectorStartTimes: bestTheoreticalSectorStartTimes
    };

    reindexLap(bestTheoreticalLap, referenceLap);

    return bestTheoreticalLap;
}