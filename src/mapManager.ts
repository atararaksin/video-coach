import { getDatapointForLap } from './lapUtils.js';
import { getLapAtTimeForSession } from './sessionUtils.js';
import { Studio } from './studio.js';
import { LapData } from './types.js';

declare global {
    interface Window {
        require: any;
    }
}

export class MapManager {
    private studio: Studio;
    private maps: Map<string, any> = new Map(); // sessionId -> map instance
    private lapGraphics: Map<string, any> = new Map(); // sessionId -> graphics layer for lap paths
    private currentPositionGraphics: Map<string, any> = new Map(); // sessionId -> current position graphic
    private sectorBorderGraphics: Map<string, any> = new Map(); // sessionId -> graphics layer for sector borders
    private currentLaps: Map<string, LapData> = new Map(); // sessionId -> current lap

    constructor(studio: Studio) {
        this.studio = studio;
    }

    async initializeMap(sessionId: string): Promise<void> {
        return new Promise((resolve, reject) => {
            window.require([
                "esri/Map",
                "esri/views/MapView",
                "esri/Graphic",
                "esri/layers/GraphicsLayer",
                "esri/geometry/Extent"
            ], (Map: any, MapView: any, Graphic: any, GraphicsLayer: any, Extent: any) => {
                try {
                    const mapContainer = document.getElementById(`map-container-${sessionId}`);
                    if (!mapContainer) {
                        reject(new Error(`Map container not found for session ${sessionId}`));
                        return;
                    }

                    // Create map with ArcGIS Online satellite basemap
                    const map = new Map({
                        basemap: "satellite"
                    });

                    // Create map view with initial extent if available
                    const viewConfig: any = {
                        container: mapContainer,
                        map: map
                    };

                    const view = new MapView(viewConfig);

                    // Create graphics layers
                    const lapLayer = new GraphicsLayer({
                        title: "Lap Paths"
                    });
                    const currentPositionLayer = new GraphicsLayer({
                        title: "Current Position"
                    });
                    const sectorBorderLayer = new GraphicsLayer({
                        title: "Sector Borders"
                    });

                    map.addMany([lapLayer, currentPositionLayer, sectorBorderLayer]);

                    // Store references
                    this.maps.set(sessionId, view);
                    this.lapGraphics.set(sessionId, lapLayer);
                    this.currentPositionGraphics.set(sessionId, currentPositionLayer);
                    this.sectorBorderGraphics.set(sessionId, sectorBorderLayer);

                    view.when(() => {
                        resolve();
                    }).catch(reject);

                    const session = this.studio.sessions.get(sessionId);
                    const lap = getLapAtTimeForSession(session, this.studio.currentTimes.get(sessionId)); 
                    this.updateCurrentLap(sessionId, lap);

                } catch (error) {
                    reject(error);
                }
            });

            // Make 3 attempts with 1-second delays to zoom to track bounds (delays are to make sure map is initialized)
            for (let i = 0; i < 3; i++) {
                setTimeout(() => {
                    const view = this.maps.get(sessionId);
                    const lapLayer = this.lapGraphics.get(sessionId);
                    const existingGraphics = lapLayer.graphics.filter((graphic: any) => 
                        graphic.attributes && 
                        graphic.attributes.type === "current-lap-path"
                    );
                    if (existingGraphics.length > 0) {
                        view.goTo(existingGraphics.toArray()[0].geometry.extent.expand(1.1));
                    }
                }, (i + 1) * 1000);
            }
        });
    }

    updateLapPath(sessionId: string, lap: LapData, color: number[], isReference: boolean = false): void {
        const view = this.maps.get(sessionId);
        const lapLayer = this.lapGraphics.get(sessionId);
        
        if (!view || !lapLayer || !lap.rawDatapoints || lap.rawDatapoints.length === 0) {
            return;
        }

        window.require([
            "esri/Graphic",
            "esri/geometry/Polyline",
            "esri/symbols/SimpleLineSymbol"
        ], (Graphic: any, Polyline: any, SimpleLineSymbol: any) => {
            // Remove existing graphics for this lap type
            const existingGraphics = lapLayer.graphics.filter((graphic: any) => 
                graphic.attributes && 
                graphic.attributes.type === (isReference ? "reference-lap-path" : "current-lap-path")
            );
            lapLayer.removeMany(existingGraphics.toArray());

            // Create path from datapoints
            const paths = lap.rawDatapoints.map(point => [point.lon, point.lat]);
            
            if (paths.length < 2) return;

            const polyline = new Polyline({
                paths: [paths],
                spatialReference: { wkid: 4326 }
            });

            const lineSymbol = new SimpleLineSymbol({
                color: color,
                width: 2,
                style: "solid"
            });

            const polylineGraphic = new Graphic({
                geometry: polyline,
                symbol: lineSymbol,
                attributes: {
                    sessionId: sessionId,
                    lapIndex: lap.lapIndex,
                    type: isReference ? "reference-lap-path" : "current-lap-path"
                }
            });

            lapLayer.add(polylineGraphic);

            // Zoom to the lap path if it's the current lap
            if (!isReference) {
                view.goTo(polyline.extent.expand(1.1));
            }
        });
    }

    updateCurrentPosition(sessionId: string, currentTime: number): void {
        const view = this.maps.get(sessionId);
        const currentPositionLayer = this.currentPositionGraphics.get(sessionId);
        
        if (!view || !currentPositionLayer) {
            return;
        }

        const session = this.studio.sessions.get(sessionId);
        if (!session) return;

        const lap = getLapAtTimeForSession(session, currentTime);
        if (this.currentLaps.get(sessionId) != lap) {
            this.updateCurrentLap(sessionId, lap);
        }

        const currentDatapoint = getDatapointForLap(lap, currentTime);

        window.require([
            "esri/Graphic",
            "esri/geometry/Point",
            "esri/symbols/SimpleMarkerSymbol"
        ], (Graphic: any, Point: any, SimpleMarkerSymbol: any) => {
            // Clear existing position graphics
            currentPositionLayer.removeAll();

            if (!currentDatapoint) {
                return;
            }

            const mapPoint = new Point({
                longitude: currentDatapoint.lon,
                latitude: currentDatapoint.lat,
                spatialReference: { wkid: 4326 }
            });

            const markerSymbol = new SimpleMarkerSymbol({
                color: [244, 67, 54], // Red color
                size: 8,
                style: "circle",
                outline: {
                    color: [255, 255, 255],
                    width: 2
                }
            });

            const positionGraphic = new Graphic({
                geometry: mapPoint,
                symbol: markerSymbol,
                attributes: {
                    sessionId: sessionId,
                    type: "current-position",
                    time: currentTime
                }
            });

            currentPositionLayer.add(positionGraphic);
        });
    }

    updateCurrentLap(sessionId: string, lap: LapData): void {
        this.updateLapPath(sessionId, lap, [33, 150, 243], false); // Blue for current lap
        this.updateSectorBorders(sessionId);
        this.currentLaps.set(sessionId, lap);
    }

    updateSectorBorders(sessionId: string): void {
        const sectorBorderLayer = this.sectorBorderGraphics.get(sessionId);
        
        if (!sectorBorderLayer) {
            return;
        }

        // Get track data from studio
        const track = this.studio.track;
        if (!track || !track.sectorSplits || track.sectorSplits.length === 0) {
            // Clear existing sector borders if no track data
            sectorBorderLayer.removeAll();
            return;
        }

        window.require([
            "esri/Graphic",
            "esri/geometry/Polyline",
            "esri/symbols/SimpleLineSymbol"
        ], (Graphic: any, Polyline: any, SimpleLineSymbol: any) => {
            // Clear existing sector border graphics
            sectorBorderLayer.removeAll();

            // Create graphics for each sector split border and start/finish line
            const sectorSplitBorders = track.sectorSplits.map(s => s.border);
            [track.startFinishBorder, ...sectorSplitBorders].forEach((border, index) => {
                // Create polyline from border line segment
                const polyline = new Polyline({
                    paths: [[
                        [border.startLon, border.startLat],
                        [border.endLon, border.endLat]
                    ]],
                    spatialReference: { wkid: 4326 }
                });

                // Create line symbol for sector border
                const lineSymbol = new SimpleLineSymbol({
                    color: index == 0 ? [255, 0, 0, 0.8] : [255, 255, 0, 0.8], // Red for start/finish, yellow for splits
                    width: 2,
                    style: "solid"
                });

                const borderGraphic = new Graphic({
                    geometry: polyline,
                    symbol: lineSymbol,
                    attributes: {
                        sessionId: sessionId,
                        type: "sector-border",
                        sectorIndex: index - 1 // start/finish line is -1
                    }
                });

                sectorBorderLayer.add(borderGraphic);
            });
        });
    }

    updateReferenceLap(sessionId: string): void {
        const referenceLap = this.studio.getReferenceLap(sessionId);
        if (referenceLap) {
            this.updateLapPath(sessionId, referenceLap, [255, 152, 0], true); // Orange for reference lap
        } else {
            // Remove reference lap path if no reference lap is set
            const lapLayer = this.lapGraphics.get(sessionId);
            if (lapLayer) {
                const existingGraphics = lapLayer.graphics.filter((graphic: any) => 
                    graphic.attributes && graphic.attributes.type === "reference-lap-path"
                );
                lapLayer.removeMany(existingGraphics.toArray());
            }
        }
    }

    removeMap(sessionId: string): void {
        const view = this.maps.get(sessionId);
        if (view) {
            view.destroy();
        }
        
        this.maps.delete(sessionId);
        this.lapGraphics.delete(sessionId);
        this.currentPositionGraphics.delete(sessionId);
        this.sectorBorderGraphics.delete(sessionId);
    }

    updateAllMapsForReferenceChange(): void {
        // Update reference lap on all maps
        for (const sessionId of this.maps.keys()) {
            this.updateReferenceLap(sessionId);
        }
    }

    updateAllMapsForSectorChange(): void {
        // Update sector borders on all maps
        for (const sessionId of this.maps.keys()) {
            this.updateSectorBorders(sessionId);
        }
    }
}
