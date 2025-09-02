import { reindexLap } from "./lapUtils.js";
import { calculateSectorTimes, splitIntoSectors } from "./sectorUtils.js";
import { Session, Track, LapData } from "./types";

export class Studio {
    public track: Track;
    public readonly sessions: Map<string, Session> = new Map();
    public referenceLap: LapData | null = null;

    addSession(session: Session) {
        this.sessions.set(session.id, session);

        // Is this is the first session added, initialize Track
        if (this.sessions.size == 1) {
            this.track = {
                sectorSplits: splitIntoSectors(session.laps[session.bestLapIndex].datapoints)
            };
        }

        // Add sector times to complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            
            lap.sectorTimes = calculateSectorTimes(lap.datapoints, this.track.sectorSplits, lap.lapTime);

            lap.sectorStartTimes = [];
            let sectorStartTime = lap.lapStartTime;
            for (let sectorTime of lap.sectorTimes) {
                sectorStartTime += sectorTime;
                lap.sectorStartTimes.push(sectorStartTime);
            }
        }

        // Reindex complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            reindexLap(lap, session.laps[session.bestLapIndex]);
        }
    }

    removeSession(sessionId: string) {
        this.sessions.delete(sessionId);
        if (this.referenceLap && this.referenceLap.sessionId === sessionId) {
            this.referenceLap = null;
        }
    }

    setReferenceLap(lap: LapData | null) {
        this.referenceLap = lap;
    }

    getReferenceLap(): LapData | null {
        return this.referenceLap;
    }
}
