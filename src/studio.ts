import { calculateBestTheoreticalLap, reindexLap } from "./lapUtils.js";
import { calculateSectorTimes, splitIntoSectors } from "./sectorUtils.js";
import { Session, Track, LapData } from "./types";

export class Studio {
    public track: Track;
    public readonly sessions: Map<string, Session> = new Map();
    public referenceLap: LapData | null = null;
    public videoSyncOffsets: Map<string, number> = new Map(); // sessionId -> video time offset
    public currentTimes: Map<string, number> = new Map(); // sessionId -> current playback time

    addSession(session: Session) {
        this.sessions.set(session.id, session);

        // Is this is the first session added, initialize Track
        if (this.sessions.size == 1) {
            this.track = {
                referenceLap: session.laps[session.bestLapIndex],
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
            reindexLap(lap, this.track.referenceLap);
        }

        // Calculate best theoretical lap
        session.bestTheoreticalLap = calculateBestTheoreticalLap(session.laps.slice(1, -1), this.track.referenceLap);
        console.log("Best theoretical lap", session.bestTheoreticalLap);
    }

    removeSession(sessionId: string) {
        this.sessions.delete(sessionId);
        if (this.referenceLap && this.referenceLap.sessionId === sessionId) {
            this.referenceLap = null;
        }
        // Clean up session-specific video sync data
        this.videoSyncOffsets.delete(sessionId);
        this.currentTimes.delete(sessionId);
    }

    setReferenceLap(lap: LapData | null) {
        this.referenceLap = lap;
    }

    getReferenceLap(): LapData | null {
        return this.referenceLap;
    }
}
