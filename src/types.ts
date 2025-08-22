// Type definitions for telemetry data
export interface TelemetryDataPoint {
    time: number;
    speed: number;
    latAcc: number;
    lonAcc: number;
    altitude: number;
    lat: number;
    lon: number;
    heading: number;
}

export interface LapData {
    lapIndex: number;
    lapTime: number;
    telemetryData: TelemetryDataPoint[];
}

export interface TelemetryHeader {
    beaconMarkers?: number[];
    duration?: string;
    date?: string;
    time?: string;
}

export interface Session {
    laps: LapData[];
    duration: number[];
    date?: string;
    time?: string;
}
