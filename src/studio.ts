import { calculateBestTheoreticalLap, correctLatLonOffset, reindexLap } from "./lapUtils.js";
import { calculateSectorTimes, calculateSectorSplitTimes, generateSectorSplits } from "./sectorUtils.js";
import { Session, Track, LapData } from "./types";

export class Studio {
    public track: Track;
    public readonly sessions: Map<string, Session> = new Map();
    public referenceLaps: Map<string, LapData | null> = new Map(); // sessionId -> reference lap
    public videoSyncOffsets: Map<string, number> = new Map(); // sessionId -> video time offset
    public currentTimes: Map<string, number> = new Map(); // sessionId -> current playback time

    addSession(session: Session) {
        this.sessions.set(session.id, session);

        const referenceLap = this.track ? this.track.referenceLap : session.laps[session.bestLapIndex];

        //correctLatLonOffset(session.laps, referenceLap);

        // Reindex complete laps
        for (let lap of session.laps) {
            reindexLap(session, lap, referenceLap);
        }

        // Is this is the first session added, initialize Track
        if (!this.track) {
            this.track = {
                referenceLap: referenceLap,
                sectorSplits: generateSectorSplits(referenceLap.datapoints)
            };
        }

        // Add sector times to laps
        for (let lap of session.laps) {
            lap.sectorSplitTimes = calculateSectorSplitTimes(lap.datapoints, this.track);
            lap.sectorTimes = calculateSectorTimes(lap.sectorSplitTimes, lap.lapStartTime, lap.lapTime);
        }

        console.log("SESSION:", session);

        // Calculate best theoretical lap
        session.bestTheoreticalLap = calculateBestTheoreticalLap(session, this.track.referenceLap);
        console.log("Best theoretical lap", session.bestTheoreticalLap);
    }

    removeSession(sessionId: string) {
        this.sessions.delete(sessionId);

        this.referenceLaps.delete(sessionId);

        for (let otherSessionId of this.referenceLaps.keys()) {
            if (this.referenceLaps.get(otherSessionId).sessionId === sessionId) {
                this.referenceLaps.delete(otherSessionId);
            }
        }
        
        this.videoSyncOffsets.delete(sessionId);
        this.currentTimes.delete(sessionId);
    }

    setReferenceLap(lap: LapData, sessionId: string) {
        this.referenceLaps.set(sessionId, lap);
    }

    getReferenceLap(sessionId: string): LapData | null {
        return this.referenceLaps.get(sessionId);
    }
}
