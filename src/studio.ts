import { reindexLap } from "./lapUtils.js";
import { calculateSectorTimes, splitIntoSectors } from "./sectorUtils.js";
import { Session, Track } from "./types";

export class Studio {
    public track: Track;
    public readonly sessions: Session[] = [];

    addSession(session: Session) {
        this.sessions.push(session);

        // Is this is the first session added, initialize Track
        if (this.sessions.length == 1) {
            this.track = {
                sectorSplits: splitIntoSectors(session.laps[session.bestLapIndex].datapoints)
            };
        }

        // Add sector times to complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            lap.sectorTimes = calculateSectorTimes(lap.datapoints, this.track.sectorSplits, lap.lapTime);
        }

        // Reindex complete laps
        for (let i = 1; i < session.laps.length - 1; i++) {
            const lap = session.laps[i];
            reindexLap(lap, session.laps[session.bestLapIndex]);
        }
    }
}