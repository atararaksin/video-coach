import { LineSegment, Point, Track } from "./types";

export interface TrackConfig {
    lapCenter: Point,
    sectorSplitBorders: LineSegment[]
}

const tolerance = 0.001; // ~100 m

export function getTrackConfig(lapCenter: Point): TrackConfig {
    const trackConfigs = getAllTrackConfigs();
    
    for (let trackConfig of trackConfigs) {
        if (Math.abs(trackConfig.lapCenter.lat - lapCenter.lat) > tolerance) continue;
        if (Math.abs(trackConfig.lapCenter.lon - lapCenter.lon) > tolerance) continue;
        
        console.log("Found track config", trackConfig);
        return trackConfig;
    }

    console.log("No track config found for lap center", lapCenter);
    return null;
}

export function saveTrackConfig(trackConfig: TrackConfig) {
    const lapCenter = trackConfig.lapCenter;
    
    let trackConfigs = getAllTrackConfigs();

    trackConfigs = trackConfigs.filter(tc => {
        return Math.abs(tc.lapCenter.lat - lapCenter.lat) > tolerance || Math.abs(tc.lapCenter.lon - lapCenter.lon) > tolerance;
    });

    trackConfigs.unshift(trackConfig);

    localStorage.setItem("track_configurations", JSON.stringify(trackConfigs));

    console.log("Saved track config", trackConfig);
}

function clearTrackConfigs() {
    localStorage.setItem("track_configurations", JSON.stringify([]));
}

function getAllTrackConfigs(): TrackConfig[] {
    try {
        const trackConfigurations = localStorage.getItem("track_configurations");
        const trackConfigs = JSON.parse(trackConfigurations) as TrackConfig[];

        if (!trackConfigs) {
            return [];
        }

        return trackConfigs;
    } catch (error) {
        console.error("Error reading track configurations. Will clean track config storage.", error);
        clearTrackConfigs();
        return [];
    }
}