import { Session, LapData, TelemetryHeader, Datapoint } from './types.js';

export class TelemetryCSVParser {
    parseCSV(csvText: string): Session {
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
        
        // Parse header information
        const headerInfo = this.parseHeaderInfo(lines);
        
        // Find the data section (starts after the header with column names)
        const dataStartIndex = this.findDataStartIndex(lines);
        const dataLines = lines.slice(dataStartIndex);

        // Parse channel names
        const channels = this.parseChannelNames(lines);
        
        // Parse telemetry data
        const datapoints = this.parseDatapoints(dataLines, channels);
        
        // Split into laps using beacon markers
        const laps = this.splitIntoLaps(datapoints, headerInfo.beaconMarkers);

        const bestLapIndex = laps.findIndex(lap => lap.lapTime === Math.min(...laps.map(lap => lap.lapTime)));

        const session: Session = {
            laps: laps,
            bestLapIndex: bestLapIndex,
            duration: headerInfo.duration ? [parseFloat(headerInfo.duration)] : [],
            date: headerInfo.date,
            time: headerInfo.time,
            channels: channels
        };

        return session;
    }

    parseHeaderInfo(lines: string[]): TelemetryHeader {
        const info: TelemetryHeader = {};
        
        for (const line of lines) {
            if (line.startsWith('"Beacon Markers"') || line.startsWith('"Beacons"')) {
                // Parse beacon markers: "Beacon Markers","13.597","90.824","150.072"... (already in seconds)
                const parts = line.split(',').map(part => part.replace(/"/g, ''));
                const beaconMarkers = parts.slice(1).map(timeStr => parseFloat(timeStr));
                info.beaconMarkers = beaconMarkers;
            } else if (line.startsWith('"Duration"')) {
                const parts = line.split(',');
                if (parts.length > 1) {
                    info.duration = parts[1].replace(/"/g, '');
                }
            } else if (line.startsWith('"Date"')) {
                const parts = line.split(',');
                if (parts.length > 1) {
                    // Join all parts after the first one in case the date contains commas
                    info.date = parts.slice(1).join(',').replace(/"/g, '');
                }
            } else if (line.startsWith('"Time"') && !line.includes('"GPS Speed"')) {
                // Make sure this is the Time header, not the column headers
                const parts = line.split(',');
                if (parts.length > 1) {
                    info.time = parts[1].replace(/"/g, '');
                }
            }
        }
        
        return info;
    }

    parseChannelNames(lines: string[]): string[] {
        // Look for the line that starts with "Time" and contains "GPS Speed" (column headers)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('"Time"') && lines[i].includes('"GPS Speed"')) {
                return lines[i].split(',').map(val => val.replace(/"/g, ''));
            }
        }
        return [];
    }


    findDataStartIndex(lines: string[]): number {
        // Look for the line that starts with "Time" and contains "GPS Speed" (column headers)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('"Time"') && lines[i].includes('"GPS Speed"')) {
                return i + 2; // Skip headers and units line
            }
        }
        return 0;
    }

    parseDatapoints(dataLines: string[], channels: string[]): Datapoint[] {
        const datapoints: Datapoint[] = [];
        
        for (const line of dataLines) {
            if (!line) continue;
            
            const values = line.split(',').map(val => val.replace(/"/g, ''));
            
            if (values.length >= 2) {
                const data: Map<string, number> = new Map();
                for (let i = 0; i < values.length; i++) {
                    const val = parseFloat(values[i]) || 0;
                    data.set(channels[i], val);
                }
                
                datapoints.push({
                    time: data.get("Time"),
                    lat: data.get("GPS Latitude"),
                    lon: data.get("GPS Longitude"),
                    speed: data.get("GPS Speed"),
                    data: data
                });
            }
        }
        
        return datapoints;
    }

    splitIntoLaps(datapoints: Datapoint[], beaconMarkers?: number[]): LapData[] {
        console.log('Splitting into laps:', { 
            totalDataPoints: datapoints.length, 
            beaconMarkers: beaconMarkers,
            firstDataPoint: datapoints[0],
            lastDataPoint: datapoints[datapoints.length - 1]
        });

        if (!beaconMarkers || beaconMarkers.length === 0) {
            // If no beacon markers, return all data as one lap
            const lapData: LapData = {
                lapIndex: 0,
                lapTime: datapoints.length > 0 ? datapoints[datapoints.length - 1].time : 0,
                datapoints: datapoints,
                dataIndex: datapoints.map((dp, i) => {return {time: dp.time, datapointIndex: i}}),
                sectorTimes: []
            };
            console.log('No beacon markers, single lap with', lapData.datapoints.length, 'data points');
            return [lapData];
        }

        const laps: LapData[] = [];
        let previousTime = 0;
        
        for (let i = 0; i < beaconMarkers.length; i++) {
            const beaconTime = beaconMarkers[i]; // Absolute time from session start
            const startTime = previousTime;
            const endTime = beaconTime;
            const lapTime = endTime - startTime;
            
            // Filter telemetry data for this lap
            const lapDatapoints = datapoints.filter(point => 
                point.time >= startTime && point.time < endTime
            );
            
            console.log(`Lap ${i}: ${startTime}s to ${endTime}s, ${lapDatapoints.length} data points`);
            
            const lapData: LapData = {
                lapIndex: i,
                lapTime: lapTime,
                datapoints: lapDatapoints,
                dataIndex: lapDatapoints.map((dp, i) => {return {time: dp.time, datapointIndex: i}}),
                sectorTimes: []
            };
            
            laps.push(lapData);
            previousTime = beaconTime;
        }
        
        // Handle any remaining data after the last beacon marker
        const remainingData = datapoints.filter(point => point.time >= previousTime);
        if (remainingData.length > 0) {
            const finalLapTime = remainingData[remainingData.length - 1].time - previousTime;
            const finalLap: LapData = {
                lapIndex: laps.length,
                lapTime: finalLapTime,
                datapoints: remainingData,
                dataIndex: remainingData.map((dp, i) => {return {time: dp.time, datapointIndex: i}}),
                sectorTimes: []
            };
            console.log(`Final lap: ${previousTime}s to end, ${remainingData.length} data points`);
            laps.push(finalLap);
        }
        
        return laps;
    }
}
