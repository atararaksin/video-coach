import { Session, LapData, TelemetryDataPoint, TelemetryHeader } from './types.js';

export class TelemetryCSVParser {
    parseCSV(csvText: string): Session {
        const lines = csvText.split('\n').map(line => line.trim()).filter(line => line);
        
        // Parse header information
        const headerInfo = this.parseHeaderInfo(lines);
        
        // Find the data section (starts after the header with column names)
        const dataStartIndex = this.findDataStartIndex(lines);
        const dataLines = lines.slice(dataStartIndex);
        
        // Parse telemetry data
        const telemetryData = this.parseTelemetryData(dataLines);
        
        // Split into laps using beacon markers
        const laps = this.splitIntoLaps(telemetryData, headerInfo.beaconMarkers);
        
        const session: Session = {
            laps: laps,
            duration: headerInfo.duration ? [parseFloat(headerInfo.duration)] : [],
            date: headerInfo.date,
            time: headerInfo.time
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


    findDataStartIndex(lines: string[]): number {
        // Look for the line that starts with "Time" and contains "GPS Speed" (column headers)
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].startsWith('"Time"') && lines[i].includes('"GPS Speed"')) {
                return i + 2; // Skip headers and units line
            }
        }
        return 0;
    }

    parseTelemetryData(dataLines: string[]): TelemetryDataPoint[] {
        const telemetryData: TelemetryDataPoint[] = [];
        
        for (const line of dataLines) {
            if (!line) continue;
            
            const values = line.split(',').map(val => val.replace(/"/g, ''));
            
            if (values.length >= 15) {
                const dataPoint: TelemetryDataPoint = {
                    time: parseFloat(values[0]) || 0,
                    speed: parseFloat(values[1]) || 0,
                    latAcc: parseFloat(values[3]) || 0,
                    lonAcc: parseFloat(values[4]) || 0,
                    altitude: parseFloat(values[8]) || 0,
                    lat: parseFloat(values[12]) || 0,
                    lon: parseFloat(values[13]) || 0,
                    heading: parseFloat(values[6]) || 0
                };
                
                telemetryData.push(dataPoint);
            }
        }
        
        return telemetryData;
    }

    splitIntoLaps(telemetryData: TelemetryDataPoint[], beaconMarkers?: number[]): LapData[] {
        console.log('Splitting into laps:', { 
            totalDataPoints: telemetryData.length, 
            beaconMarkers: beaconMarkers,
            firstDataPoint: telemetryData[0],
            lastDataPoint: telemetryData[telemetryData.length - 1]
        });

        if (!beaconMarkers || beaconMarkers.length === 0) {
            // If no beacon markers, return all data as one lap
            const lapData: LapData = {
                lapIndex: 1,
                lapTime: telemetryData.length > 0 ? telemetryData[telemetryData.length - 1].time : 0,
                telemetryData: telemetryData
            };
            console.log('No beacon markers, single lap with', lapData.telemetryData.length, 'data points');
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
            const lapTelemetryData = telemetryData.filter(point => 
                point.time >= startTime && point.time < endTime
            );
            
            console.log(`Lap ${i + 1}: ${startTime}s to ${endTime}s, ${lapTelemetryData.length} data points`);
            
            const lapData: LapData = {
                lapIndex: i + 1,
                lapTime: lapTime,
                telemetryData: lapTelemetryData
            };
            
            laps.push(lapData);
            previousTime = beaconTime;
        }
        
        // Handle any remaining data after the last beacon marker
        const remainingData = telemetryData.filter(point => point.time >= previousTime);
        if (remainingData.length > 0) {
            const finalLapTime = remainingData[remainingData.length - 1].time - previousTime;
            const finalLap: LapData = {
                lapIndex: laps.length + 1,
                lapTime: finalLapTime,
                telemetryData: remainingData
            };
            console.log(`Final lap: ${previousTime}s to end, ${remainingData.length} data points`);
            laps.push(finalLap);
        }
        
        return laps;
    }
}
