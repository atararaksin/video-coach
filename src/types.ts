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
    sectorTimes: number[];
    sectorStartTimes: number[];
    timeToDistanceIndex: TimeToDistanceIndex[];
    datapoints: Datapoint[];
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
    duration: number[];
    date?: string;
    time?: string;
    channels: string[];
}

export interface Point {
    lat: number;
    lon: number;
}

export interface Track {
    referenceLap: LapData; // Datapoints used to index all other laps from all sessions
    sectorSplits: Point[];
}
