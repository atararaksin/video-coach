import { calculateBestTheoreticalLap, correctLatLonOffset, reindexLap } from "./lapUtils.js";
import { calculateSectorTimes, splitIntoSectors } from "./sectorUtils.js";
import { Session, Track, LapData } from "./types";

export class Studio {
    public track: Track;
    public readonly sessions: Map<string, Session> = new Map();
    public referenceLaps: Map<string, LapData | null> = new Map(); // sessionId -> reference lap
    public videoSyncOffsets: Map<string, number> = new Map(); // sessionId -> video time offset
    public currentTimes: Map<string, number> = new Map(); // sessionId -> current playback time

    addSession(session: Session) {
        this.sessions.set(session.id, session);

        const referenceLap = session.laps[session.bestLapIndex];

        //correctLatLonOffset(session.laps, referenceLap);

        // Is this is the first session added, initialize Track
        if (this.sessions.size == 1) {
            this.track = {
                referenceLap: referenceLap,
                sectorSplits: splitIntoSectors(referenceLap.rawDatapoints)
            };
        }

        // Reindex complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            reindexLap(session, lap, this.track.referenceLap);
        }

        // Add sector times to complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            
            lap.sectorTimes = calculateSectorTimes(lap.rawDatapoints, this.track.sectorSplits, lap.lapTime);

            lap.sectorStartTimes = [];
            let sectorStartTime = lap.lapStartTime;
            for (let sectorTime of lap.sectorTimes) {
                sectorStartTime += sectorTime;
                lap.sectorStartTimes.push(sectorStartTime);
            }
        }
        console.log("SESSION");
console.log(session);
        // Calculate best theoretical lap
        //session.bestTheoreticalLap = calculateBestTheoreticalLap(session, this.track.referenceLap);
        //console.log("Best theoretical lap", session.bestTheoreticalLap);
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
