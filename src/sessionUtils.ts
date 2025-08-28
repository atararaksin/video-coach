import { getDatapointForLap, getReferenceDatapointForLap } from "./lapUtils.js";
import { Datapoint, LapData, Session } from "./types";

export function getDatapointForSession(session: Session, time: number): Datapoint {
    const lap = session.laps.find(l => time >= l.lapStartTime);
    return getDatapointForLap(lap, time);
}


// For a given session at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForSession(session: Session, time: number, referenceLap: LapData): Datapoint {
    const lap = session.laps.find(l => time >= l.lapStartTime);
    return getReferenceDatapointForLap(lap, time, referenceLap);
}