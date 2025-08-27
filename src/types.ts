export interface DataIndex {
    time: number;
    datapointIndex: number;
}

export interface Datapoint {
    time: number;
    lat: number;
    lon: number;
    data: Map<string, number>;
}

export interface LapData {
    lapIndex: number;
    lapTime: number;
    dataIndex: DataIndex[];
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
