import { findClosestDatapoint } from "./gpsUtils.js";
import { Datapoint, LapData } from "./types";

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
    for (let i = 0; i < datapoints.length - 1; i++) {
        const dp1 = datapoints[i];
        const dp2 = datapoints[i + 1];

        interpolatedDatapoints.push(dp1);

        for (let time = dp1.time + timeStep; time < dp2.time; time += timeStep) {
            const intermediateDp = Object.assign({}, dp1);
            
            intermediateDp.timeAdjusted = time;
            intermediateDp.lat = dp1.lat + (dp2.lat - dp1.lat) * (time - dp1.time) / (dp2.time - dp1.time);
            intermediateDp.lon = dp1.lon + (dp2.lon - dp1.lon) * (time - dp1.time) / (dp2.time - dp1.time);
            intermediateDp.speed = dp1.speed + (dp2.speed - dp1.speed) * (time - dp1.time) / (dp2.time - dp1.time);

            interpolatedDatapoints.push(intermediateDp);
        }
    }

    interpolatedDatapoints.push(datapoints[datapoints.length - 1]);


    
    return refDatapoints.map(refDp => findClosestDatapoint(interpolatedDatapoints, refDp));
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
