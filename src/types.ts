export interface TimeToDistanceIndex {
    time: number;
    distanceBasedIndex: number;
}

export interface Datapoint {
    time: number;
    timeAdjusted: number;
    lat: number;
    lon: number;
    speed: number;
    data: Map<string, number>;
}

export interface LapData {
    lapIndex: number;
    lapTime: number;
    lapStartTime: number;
    sectorTimes: number[];
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
    sectorSplits: Point[];
}