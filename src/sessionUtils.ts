import { getDatapointForLap, getReferenceDatapointForLap } from "./lapUtils.js";
import { Datapoint, LapData, Session } from "./types";

export function getLapAtTimeForSession(session: Session, time: number): LapData {
    if (time < 0 || time >= session.duration) return null;

    const nextLapIndex = session.laps.findIndex(l => time < l.lapStartTime);

    if (nextLapIndex == -1) return session.laps[session.laps.length - 1];
    else return session.laps[nextLapIndex - 1];
}

export function getDatapointForSession(session: Session, time: number): Datapoint {
    const lap = getLapAtTimeForSession(session, time);
    return getDatapointForLap(lap, time);
}


// For a given session at a given point in time, gives a datapoint from the reference lap
// that is distance-matched to the base lap's datapoint
export function getReferenceDatapointForSession(session: Session, time: number, referenceLap: LapData): Datapoint {
    const lap = getLapAtTimeForSession(session, time);
    if (lap == referenceLap) return getDatapointForSession(session, time); // Same lap
    else return getReferenceDatapointForLap(lap, time, referenceLap);
}