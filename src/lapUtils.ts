import { findDatapointInLapWithInterpolation } from "./gpsUtils.js";
import { Datapoint, LapData, Point, Sector, Session, TimeToDistanceIndex } from "./types";

export function reindexLap(session: Session, lap: LapData, referenceLap: LapData) {
    console.log("Reindexing lap ", lap.lapIndex);

    const refDpLen = referenceLap.rawDatapoints.length;

    let rawDatapoints = lap.rawDatapoints;
    // Add a few datapoints from previous/next lap for "context", to make sure we are crossing the ref datapoint
    if (lap.lapIndex > 0 && lap.lapIndex != -1) {
        const prevLap = session.laps[lap.lapIndex - 1];
        rawDatapoints = prevLap.rawDatapoints.slice(-10).concat(rawDatapoints);
    }
    if (lap.lapIndex < session.laps.length - 1 && lap.lapIndex != -1) {
        const nextLap = session.laps[lap.lapIndex + 1];
        rawDatapoints = rawDatapoints.concat(nextLap.rawDatapoints.slice(0, 10));
    }

    const interpolatedDatapoints: Datapoint[] = [];
    for (let refDpI = 0; refDpI < refDpLen; refDpI++) {
        // Make sure datapoints at the end of the lap don't get detected as start of teh lap datapoints,
        // and datapoints at the start of the lap don't get detected as end of lap datapoints.
        const minTime = refDpI > refDpLen * 0.95 ? lap.lapStartTime + lap.lapTime / 2 : undefined;
        const maxTime = refDpI < refDpLen * 0.05 ? lap.lapStartTime + lap.lapTime / 2 : undefined;

        let interpolatedDp = findDatapointInLapWithInterpolation(referenceLap.rawDatapoints, refDpI, rawDatapoints, minTime, maxTime);

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
    const laps = session.laps;

    if (laps.length == 0) return null;

    const sectorCount = laps[0].sectors.length;
    const bestTheoreticalRawDatapoints: Datapoint[] = [];
    const bestTheoreticalRawTimeToDistanceIndex: TimeToDistanceIndex[] = [];
    const bestTheoreticalSectors: Sector[] = [];
    const bestTheoreticalSectorSplitTimes: number[] = [];

    for (let sectorI = 0; sectorI < sectorCount; sectorI++) {
        const bestSectorLap = laps
            .filter(l => l.sectors[sectorI] != null)
            .sort((a, b) => a.sectors[sectorI].sectorTime - b.sectors[sectorI].sectorTime)[0];
        if (!bestSectorLap) console.log("bestSectorLap undefined for sectorI=", sectorI);
        const bestSectorTime = bestSectorLap.sectors[sectorI].sectorTime;
        const bestSectorStartTime = sectorI == 0 ? bestSectorLap.lapStartTime : bestSectorLap.sectorSplitTimes[sectorI - 1];

        for (let dp of bestSectorLap.rawDatapoints) {
            if (dp.time < bestSectorStartTime) continue; // Not yet reached the sector
            if (sectorI < sectorCount - 1 && dp.time >= bestSectorLap.sectorSplitTimes[sectorI]) break; // Passed the sector

            const newDp = Object.assign({}, dp);
            newDp.time = dp.time - bestSectorStartTime + bestTheoreticalSectors.reduce((a, b) => a + b.sectorTime, 0);
            newDp.data.set("Time", newDp.time);

            bestTheoreticalRawDatapoints.push(newDp);
        }

        bestTheoreticalSectors.push({
            sectorTime: bestSectorTime,
            sectorStartTime: bestSectorStartTime,
            sectorIndex: sectorI,
            ranking: "total-best"
        });
        if (sectorI > 0) {
            bestTheoreticalSectorSplitTimes.push(bestTheoreticalSectors.reduce((a, b) => a + b.sectorTime, 0));
        }
    }

    const bestTheoreticalLapDuration = bestTheoreticalSectors.reduce((a, b) => a + b.sectorTime, 0);

    bestTheoreticalRawDatapoints.sort((a, b) => a.time - b.time);

    const timeStep = laps[session.bestLapIndex].rawTimeToDistanceIndex[1].time - laps[session.bestLapIndex].rawTimeToDistanceIndex[0].time;
    for (let time = 0; time < bestTheoreticalLapDuration; time += timeStep) {
        let bestDpIdx = 0;
        let bestDpTimeDiff = Number.MAX_VALUE;
        for (let dpIdx = 0; dpIdx < bestTheoreticalRawDatapoints.length; dpIdx++) {
            const timeDiff = Math.abs(bestTheoreticalRawDatapoints[dpIdx].time - time);
            if (timeDiff < bestDpTimeDiff) {
                bestDpTimeDiff = timeDiff;
                bestDpIdx = dpIdx;
            }
        }
        bestTheoreticalRawTimeToDistanceIndex.push({
            time: time,
            distanceBasedIndex: bestDpIdx
        });
    }

    const bestTheoreticalLap: LapData = {
        lapIndex: -1,
        sessionId: laps[0].sessionId,
        lapTime: bestTheoreticalLapDuration,
        lapStartTime: 0,
        rawDatapoints: bestTheoreticalRawDatapoints,
        datapoints: [],
        timeToDistanceIndex: [],
        rawTimeToDistanceIndex: bestTheoreticalRawTimeToDistanceIndex,
        sectors: bestTheoreticalSectors,
        sectorSplitTimes: bestTheoreticalSectorSplitTimes,
        isComplete: true,
        ranking: "session-best"
    };

    reindexLap(session, bestTheoreticalLap, referenceLap);

    return bestTheoreticalLap;
}

export function populateLapRankings(sessions: Session[]) {
    let totalBest = Number.MAX_VALUE;
    for (let session of sessions) {
        const sortedCompleteLaps = session.laps
            .filter(l => l.isComplete)
            .sort((a, b) => a.lapTime - b.lapTime);
            
        if (sortedCompleteLaps.length > 0) {
            const sessionBest = sortedCompleteLaps[0].lapTime;

            for (let lap of session.laps) {
                if (!lap.isComplete) lap.ranking = "bad";
                if (lap.lapTime == sessionBest) lap.ranking = "session-best";
                else if (lap.lapTime > sessionBest * 1.01) lap.ranking = "bad";
                else lap.ranking = "normal";
            }
            
            if (sessionBest < totalBest) totalBest = sessionBest;
        }
    }

    for (let session of sessions) {
        for (let lap of session.laps) {
            if (lap.lapTime == totalBest) {
                lap.ranking = "total-best";
            }
        }
    }
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

export function calculateLapCenter(lap: LapData): Point {
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