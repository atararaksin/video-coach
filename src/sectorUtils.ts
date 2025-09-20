import { createPerpendicularLine, findDatapointIndexAtBorderCrossing } from "./gpsUtils.js";
import { getTimeToDistanceIndexIdxForLap } from "./lapUtils.js";
import { getLapAtTimeForSession } from "./sessionUtils.js";
import { Datapoint, LapData, LineSegment, Sector, SectorSplit, Session, Track } from "./types.js";

export function calculateSectorSplitTimes(datapoints: Datapoint[], track: Track): number[] {
    return track.sectorSplits.map(split => {
        const dp = datapoints[split.datapointIndex];
        if (dp == null) return null;
        else return dp.time;
    });
}

export function calculateSectors(sectorSplitTimes: number[], lap: LapData): Sector[] {
    const sectors: Sector[] = [];

    let sectorStartTime = null;
    if (lap.datapoints[0] != null) sectorStartTime = lap.lapStartTime;

    const lastSectorEndTime = lap.datapoints[lap.datapoints.length - 1] != null ? lap.lapStartTime + lap.lapTime : null;
    const sectorEndTimes = sectorSplitTimes.concat(lastSectorEndTime);
    for (let sectorEndTime of sectorEndTimes) {
        if (sectorStartTime != null && sectorEndTime != null) {
            sectors.push({
                sectorIndex: sectors.length,
                sectorStartTime: sectorStartTime,
                sectorTime: sectorEndTime - sectorStartTime,
                ranking: "normal"
            });
        } else {
            sectors.push(null);
        }
        sectorStartTime = sectorEndTime;
    }
    
    return sectors;
}

export function populateSectorRankings(sessions: Session[], track: Track) {
    const rollingWindow = 1;
    
    for (let sectorIndex = 0; sectorIndex < track.sectorSplits.length + 1; sectorIndex++) {
        let totalBest = Number.MAX_VALUE;
        for (let session of sessions) {
            const sortedSectors = session.laps
                .map(lap => lap.sectors[sectorIndex])
                .filter(s => s != null)
                .sort((a, b) => a.sectorTime - b.sectorTime);

            if (sortedSectors.length > 0) {
                const sessionBest = sortedSectors[0].sectorTime;

                for (let lapIdx = 0; lapIdx < session.laps.length; lapIdx++) {
                    const sector = session.laps[lapIdx].sectors[sectorIndex];
                    if (sector == null) continue;

                    let rollingBest = 1000000; // Don't use Number.MAX_VALUE - will overflow
                    if (lapIdx > 0) {
                        const rollingSectors = session.laps
                            .slice(Math.max(0, lapIdx - rollingWindow), lapIdx)
                            .map(lap => lap.sectors[sectorIndex])
                            .filter(s => s != null)
                            .sort((a, b) => a.sectorTime - b.sectorTime);
                        if (sortedSectors.length > 0) {
                            if (rollingSectors.length > 0) rollingBest = rollingSectors[0].sectorTime;
                        }
                    }

                    if (sector.sectorTime == sessionBest) sector.ranking = "session-best";
                    else if (sector.sectorTime > rollingBest * 1.015) sector.ranking = "bad";
                    else sector.ranking = "normal";
                }
                
                if (sessionBest < totalBest) totalBest = sessionBest;
            }
        }

        for (let session of sessions) {
            for (let lap of session.laps) {
                if (lap.sectors[sectorIndex] && lap.sectors[sectorIndex].sectorTime == totalBest) {
                    lap.sectors[sectorIndex].ranking = "total-best";
                }
            }
        }
    }
}

export function addSectorSplitAtTime(time: number, session: Session, track: Track): SectorSplit[] {
    const currentLap = getLapAtTimeForSession(session, time);

    const dpIndex = getTimeToDistanceIndexIdxForLap(currentLap, time);

    const sectorSplits = [...track.sectorSplits];

    if (dpIndex == -1) {
        alert("The current position in the current lap seems to be an outlier compared to the best lap. Cannot put a sector pslit here.");
        return sectorSplits;
    }


    if (track.sectorSplits.find(s => s.datapointIndex == dpIndex)) return sectorSplits; // Already exists

    const border = createPerpendicularLine(dpIndex, track.referenceLap.datapoints);

    // Find where this split should be inserted among other sector splits
    let splitIndex = 0;
    while (splitIndex < sectorSplits.length && sectorSplits[splitIndex].datapointIndex < dpIndex) {
        splitIndex++;
    }

    sectorSplits.splice(splitIndex, 0, {
        datapointIndex: dpIndex,
        border: border
    });

    return sectorSplits;
}

export function removeSectorSplitAtTime(time: number, session: Session, track: Track): SectorSplit[] {
    const tolerance = 0.5; // seconds

    const currentLap = getLapAtTimeForSession(session, time);

    const sectorSplits = [...track.sectorSplits];

    if (currentLap.sectorSplitTimes.length == 0) return sectorSplits;
    
    const closestSectorSplitTimes = currentLap.sectorSplitTimes
        .filter(t => t)
        .filter(t => Math.abs(t - time) <= tolerance)
        .sort(t => Math.abs(t - time));
    if (closestSectorSplitTimes.length == 0) return sectorSplits;
    const closestSectorSplitTime = closestSectorSplitTimes[0];

    const closestSplitIndex = currentLap.sectorSplitTimes.findIndex(t => t == closestSectorSplitTime);

    sectorSplits.splice(closestSplitIndex, 1);

    return sectorSplits;
}

export function generateStartFinishBorder(datapoints: Datapoint[]): LineSegment {
    return createPerpendicularLine(0, datapoints);
}

export function loadSectorSplitsFromSplitBorders(datapoints: Datapoint[], sectorSplitBorders: LineSegment[]): SectorSplit[] {
    return sectorSplitBorders
        .map(border => { return {
            datapointIndex: findDatapointIndexAtBorderCrossing(datapoints, border),
            border: border
        };})
        .filter(s => s.datapointIndex != null);
}

// First point in the array is start of the lap
export function generateSectorSplits(datapoints: Datapoint[]): SectorSplit[] {
    if (datapoints.length < 2) {
        return [];
    }

    // Step 1: Find deceleration periods
    const decelerationPeriods = findDecelerationPeriods(datapoints);

    console.log('Found decelleration periods:', decelerationPeriods);
    
    // Step 2: Find non-deceleration periods
    const nonDecelerationPeriods = findNonDecelerationPeriods(datapoints, decelerationPeriods);
    
    // Step 3: Create initial split points
    const splitPoints: number[] = [];
    
    for (const period of nonDecelerationPeriods) {
        const duration = datapoints[period.end].time - datapoints[period.start].time;
        if (duration >= 2.5) {
            // Find the next deceleration period to apply 0.3s margin
            const nextDecelerationStart = findNextDecelerationStart(datapoints, period.end, decelerationPeriods);
            let splitTime = datapoints[period.end].time;
            
            if (nextDecelerationStart !== -1) {
                const marginTime = datapoints[nextDecelerationStart].time - 0.3;
                splitTime = Math.min(splitTime, marginTime);
            }
            
            // Find the closest datapoint to the split time
            const splitIndex = findClosestDatapointIndex(datapoints, splitTime);
            if (splitIndex > 0 && splitIndex < datapoints.length - 1) {
                splitPoints.push(splitIndex);
            }
        }
    }
    
    // Remove duplicates and sort
    const uniqueSplitPoints = [...new Set(splitPoints)].sort((a, b) => a - b);
    
    // Step 4: Merge sectors shorter than 4 seconds
    const finalSplitPoints = mergeShortSectors(datapoints, uniqueSplitPoints);

    console.log("Sector split points:", finalSplitPoints);

    return finalSplitPoints.map(dpIdx => { return {
        datapointIndex: dpIdx,
        border: createPerpendicularLine(dpIdx, datapoints)
    };});
}

interface Period {
    start: number;
    end: number;
}

function findDecelerationPeriods(datapoints: Datapoint[]): Period[] {
    if (datapoints.length < 2) {
        return [];
    }

    // Step 1: Sample down the dataset to have at least 0.2 seconds between datapoints
    const sampledData: {
        datapoint: Datapoint;
        originalIndex: number;
        aggregatedIndexes: number[];
        averageSpeed: number;
    }[] = [];

    let currentSampleStart = 0;
    sampledData.push({
        datapoint: datapoints[0],
        originalIndex: 0,
        aggregatedIndexes: [0],
        averageSpeed: datapoints[0].speed
    });

    for (let i = 1; i < datapoints.length; i++) {
        const timeDiff = datapoints[i].time - sampledData[sampledData.length - 1].datapoint.time;
        
        if (timeDiff >= 0.2) {
            // Create new sample point
            const aggregatedIndexes: number[] = [];
            let totalSpeed = 0;
            
            // Aggregate all points from last sample to current point
            for (let j = currentSampleStart + 1; j <= i; j++) {
                aggregatedIndexes.push(j);
                totalSpeed += datapoints[j].speed;
            }
            
            const averageSpeed = aggregatedIndexes.length > 0 ? totalSpeed / aggregatedIndexes.length : datapoints[i].speed;
            
            sampledData.push({
                datapoint: datapoints[i],
                originalIndex: i,
                aggregatedIndexes: aggregatedIndexes,
                averageSpeed: averageSpeed
            });
            
            currentSampleStart = i;
        }
    }

    // Step 2: Find deceleration periods in sampled data
    const decelerationPeriods: Period[] = [];
    const minDecelerationThreshold = -4.0; // - threshold for significant deceleration

    for (let i = 1; i < sampledData.length; i++) {
        const currentSample = sampledData[i];
        const previousSample = sampledData[i - 1];
        
        const timeDiff = currentSample.datapoint.time - previousSample.datapoint.time;
        const speedDiff = currentSample.averageSpeed - previousSample.averageSpeed;
        
        // Calculate deceleration (negative acceleration)
        const acceleration = speedDiff / timeDiff;
        
        if (acceleration < minDecelerationThreshold) {
            // Found start of deceleration period
            let decelerationStart = i - 1;
            let decelerationEnd = i;
            
            // Extend the deceleration period while acceleration remains negative
            while (decelerationEnd + 1 < sampledData.length) {
                const nextSample = sampledData[decelerationEnd + 1];
                const nextTimeDiff = nextSample.datapoint.time - sampledData[decelerationEnd].datapoint.time;
                const nextSpeedDiff = nextSample.averageSpeed - sampledData[decelerationEnd].averageSpeed;
                const nextAcceleration = nextSpeedDiff / nextTimeDiff;
                
                if (nextAcceleration < 0) {
                    decelerationEnd++;
                } else {
                    break;
                }
            }
            
            // Check if the deceleration period is long enough
            const periodDuration = sampledData[decelerationEnd].datapoint.time - sampledData[decelerationStart].datapoint.time;
            
            // Map back to original datapoint indexes
            const originalStartIndex = sampledData[decelerationStart].originalIndex;
            let originalEndIndex = sampledData[decelerationEnd].originalIndex;
            
            // Include all aggregated points in the end sample
            if (sampledData[decelerationEnd].aggregatedIndexes.length > 0) {
                const lastAggregatedIndex = Math.max(...sampledData[decelerationEnd].aggregatedIndexes);
                originalEndIndex = Math.max(originalEndIndex, lastAggregatedIndex);
            }
            
            decelerationPeriods.push({
                start: originalStartIndex,
                end: originalEndIndex
            });
            
            // Skip ahead to avoid overlapping periods
            i = decelerationEnd;
        }
    }

    // Step 3: Merge overlapping or adjacent deceleration periods
    const mergedPeriods: Period[] = [];
    
    for (const period of decelerationPeriods) {
        if (mergedPeriods.length === 0) {
            mergedPeriods.push(period);
        } else {
            const lastPeriod = mergedPeriods[mergedPeriods.length - 1];
            
            // Check if periods overlap or are adjacent (within 1 second)
            const timeBetween = datapoints[period.start].time - datapoints[lastPeriod.end].time;
            
            if (timeBetween <= 1.0) {
                // Merge periods
                lastPeriod.end = period.end;
            } else {
                mergedPeriods.push(period);
            }
        }
    }

    return mergedPeriods;
}

function findNonDecelerationPeriods(datapoints: Datapoint[], decelerationPeriods: Period[]): Period[] {
    const nonDecelerationPeriods: Period[] = [];
    let currentStart = 0;
    
    for (const decPeriod of decelerationPeriods) {
        if (currentStart < decPeriod.start) {
            nonDecelerationPeriods.push({ start: currentStart, end: decPeriod.start - 1 });
        }
        currentStart = decPeriod.end + 1;
    }
    
    // Add final non-deceleration period if exists
    if (currentStart < datapoints.length) {
        nonDecelerationPeriods.push({ start: currentStart, end: datapoints.length - 1 });
    }
    
    return nonDecelerationPeriods;
}

function findNextDecelerationStart(datapoints: Datapoint[], fromIndex: number, decelerationPeriods: Period[]): number {
    for (const period of decelerationPeriods) {
        if (period.start > fromIndex) {
            return period.start;
        }
    }
    return -1;
}

function findClosestDatapointIndex(datapoints: Datapoint[], targetTime: number): number {
    let closestIndex = 0;
    let minDiff = Math.abs(datapoints[0].time - targetTime);
    
    for (let i = 1; i < datapoints.length; i++) {
        const diff = Math.abs(datapoints[i].time - targetTime);
        if (diff < minDiff) {
            minDiff = diff;
            closestIndex = i;
        }
    }
    
    return closestIndex;
}

function mergeShortSectors(datapoints: Datapoint[], splitPoints: number[]): number[] {
    if (splitPoints.length <= 1) return splitPoints;
    
    const sectors: { start: number; end: number; duration: number }[] = [];
    let prevIndex = 0;
    
    for (const splitIndex of splitPoints) {
        const duration = datapoints[splitIndex].time - datapoints[prevIndex].time;
        sectors.push({ start: prevIndex, end: splitIndex, duration });
        prevIndex = splitIndex;
    }
    
    // Merge sectors shorter than 3.5 seconds
    const finalSplitPoints: number[] = [];
    let i = 0;
    
    while (i < sectors.length) {
        if (sectors[i].duration < 3.5 && sectors.length > 1) {
            // Find which adjacent sector is shorter to merge with
            let mergeWithPrevious = false;
            
            if (i === 0) {
                // First sector, merge with next
                mergeWithPrevious = false;
            } else if (i === sectors.length - 1) {
                // Last sector, merge with previous
                mergeWithPrevious = true;
            } else {
                // Middle sector, merge with shorter adjacent sector
                const prevDuration = sectors[i - 1].duration;
                const nextDuration = sectors[i + 1].duration;
                mergeWithPrevious = prevDuration <= nextDuration;
            }
            
            if (mergeWithPrevious && i > 0) {
                // Merge with previous sector
                sectors[i - 1].end = sectors[i].end;
                sectors[i - 1].duration = datapoints[sectors[i - 1].end].time - datapoints[sectors[i - 1].start].time;
                sectors.splice(i, 1);
                i--; // Re-check the merged sector
            } else if (!mergeWithPrevious && i < sectors.length - 1) {
                // Merge with next sector
                sectors[i + 1].start = sectors[i].start;
                sectors[i + 1].duration = datapoints[sectors[i + 1].end].time - datapoints[sectors[i + 1].start].time;
                sectors.splice(i, 1);
                // Don't increment i, check the merged sector
            } else {
                i++;
            }
        } else {
            i++;
        }
    }
    
    // Extract final split points (excluding the first point which is always 0)
    for (let j = 0; j < sectors.length; j++) {
        if (j > 0 || sectors[j].end !== 0) {
            finalSplitPoints.push(sectors[j].end);
        }
    }

    return finalSplitPoints;
}
