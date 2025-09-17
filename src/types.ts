export interface TimeToDistanceIndex {
    time: number;
    distanceBasedIndex: number;
}

export interface Datapoint {
    time: number;
    lat: number;
    lon: number;
    speed: number;
    data: Map<string, number>;
}

export interface LapData {
    sessionId: string;
    lapIndex: number;
    lapTime: number;
    lapStartTime: number;
    sectors: Sector[];
    sectorSplitTimes: number[];
    timeToDistanceIndex: TimeToDistanceIndex[];
    rawTimeToDistanceIndex: TimeToDistanceIndex[];
    rawDatapoints: Datapoint[];
    datapoints: Datapoint[];
    isComplete: boolean;
    ranking: string; // total-best, session-best, normal, bad
}

export interface Sector {
    sectorTime: number;
    sectorStartTime: number;
    sectorIndex: number;
    ranking: string; // total-best, session-best, normal, bad
}

export interface TelemetryHeader {
    beaconMarkers?: number[];
    duration?: string;
    date?: string;
    time?: string;
}

export interface Session {
    id: string;
    laps: LapData[];
    bestLapIndex: number;
    bestTheoreticalLap: LapData;
    duration: number;
    date?: string;
    time?: string;
    channels: string[];
}

export interface Point {
    lat: number;
    lon: number;
}

export interface LineSegment {
    startLat: number;
    startLon: number;
    endLat: number;
    endLon: number;
}

export interface Track {
    referenceLap: LapData; // Datapoints used to index all other laps from all sessions
    sectorSplits: SectorSplit[]; // Indexes of reference lap datapoints that correspond to splits. Includes start of lap point as the first element.
}

export interface SectorSplit {
    datapointIndex: number; // Normalized index in track's reference lap
    border: LineSegment;
}