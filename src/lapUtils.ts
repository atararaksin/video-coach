import { findClosestDatapoint } from "./gpsUtils.js";
import { Datapoint, LapData } from "./types";

export function reindexLap(lap: LapData, referenceLap: LapData) {
    // Rebuild datapoints sequence to be distance-matched with the reference map
    lap.datapoints = referenceLap.datapoints.map(refDp => findClosestDatapoint(lap.datapoints, refDp));
    
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

export function getDatapointForLap(lap: LapData, time: number): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const datapointIndex = Math.round((time - lap.lapStartTime) / timeBetweenDatapoints);
    return lap.datapoints[datapointIndex];
}

// For a given base lap at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForLap(lap: LapData, time: number, referenceLap: LapData): Datapoint {
    const timeBetweenDatapoints = lap.lapTime / lap.timeToDistanceIndex.length;
    const datapointIndex = Math.round((time - lap.lapStartTime) / timeBetweenDatapoints);
    return referenceLap.datapoints[datapointIndex];
}