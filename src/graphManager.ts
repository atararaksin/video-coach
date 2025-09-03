import { Session, LapData } from './types.js';
import { getDatapointForLap, getReferenceDatapointForLap } from './lapUtils.js';

export class GraphManager {
    private graphCounter: number = 0;
    private selectedLaps: Map<string, LapData | null> = new Map(); // sessionId -> selected lap
    private studio: any; // Reference to studio instance
    private currentTimePositions: Map<string, number> = new Map(); // sessionId -> current time position within the lap

    constructor(studio: any) {
        this.studio = studio;
    }

    setSelectedLap(lap: LapData): void {
        this.selectedLaps.set(lap.sessionId, lap);
        this.updateAllGraphsForSession(lap.sessionId);
    }

    getSelectedLap(sessionId: string): LapData | null {
        return this.selectedLaps.get(sessionId) || null;
    }

    addTelemetryGraph(sessionId: string, session: Session): string {
        const graphId = `graph_${sessionId}_${this.graphCounter++}`;
        const container = document.getElementById(`graphs-container-${sessionId}`);
        if (!container) return graphId;

        const graphDiv = document.createElement('div');
        graphDiv.className = 'graph-panel';
        graphDiv.id = graphId;
        
        const channelOptions = session.channels.map(channel => 
            `<option value="${channel}">${channel}</option>`
        ).join('');

        graphDiv.innerHTML = `
            <div class="graph-header">
                <div class="graph-controls-row">
                    <div class="channel-selector">
                        <select id="${graphId}_channel1" onchange="updateGraph('${graphId}')">
                            <option value="">Left channel...</option>
                            ${channelOptions}
                        </select>
                    </div>
                    <div class="channel-selector right-channel">
                        <select id="${graphId}_channel2" onchange="updateGraph('${graphId}')">
                            <option value="">Right channel...</option>
                            ${channelOptions}
                        </select>
                    </div>
                    <button class="remove-graph-btn" onclick="removeGraph('${graphId}')">×</button>
                </div>
            </div>
            <div class="graph-content">
                <canvas id="${graphId}_canvas"></canvas>
            </div>
        `;

        container.appendChild(graphDiv);
        return graphId;
    }

    removeGraph(graphId: string): void {
        const graphElement = document.getElementById(graphId);
        if (graphElement) {
            // Destroy Chart.js instance if it exists
            const canvas = document.getElementById(`${graphId}_canvas`) as HTMLCanvasElement;
            if (canvas && (canvas as any).chart) {
                (canvas as any).chart.destroy();
            }
            graphElement.remove();
        }
    }

    updateGraph(graphId: string): void {
        const channel1Select = document.getElementById(`${graphId}_channel1`) as HTMLSelectElement;
        const channel2Select = document.getElementById(`${graphId}_channel2`) as HTMLSelectElement;
        const canvas = document.getElementById(`${graphId}_canvas`) as HTMLCanvasElement;
        
        if (!channel1Select || !canvas) return;

        const channel1 = channel1Select.value;
        const channel2 = channel2Select?.value || '';

        // Destroy existing chart if it exists
        if ((canvas as any).chart) {
            try {
                (canvas as any).chart.destroy();
            } catch (e) {
                console.warn('Error destroying chart:', e);
            }
            (canvas as any).chart = null; // Clear the reference
            delete (canvas as any).chart; // Remove the property entirely
        }

        // Extract sessionId from graphId (format: graph_sessionId_counter)
        // The graphId format is: graph_session_timestamp_randomId_counter
        // We need to extract everything except "graph_" prefix and "_counter" suffix
        const parts = graphId.split('_');
        const sessionId = parts.slice(1, -1).join('_'); // Remove first part (graph) and last part (counter)
        const selectedLap = this.selectedLaps.get(sessionId);

        if (!channel1 || !selectedLap) {
            return; // No channel selected or no lap selected
        }

        // Render the graph directly without timeout since we properly destroyed the chart
        this.renderGraph(canvas, selectedLap, channel1, channel2);
    }

    updateAllGraphs(): void {
        // Find all graph canvases and update them
        const graphPanels = document.querySelectorAll('.graph-panel');
        graphPanels.forEach(panel => {
            const graphId = panel.id;
            this.updateGraph(graphId);
        });
    }

    updateAllGraphsForSession(sessionId: string): void {
        // Find graph canvases only for this specific session
        const sessionGraphs = document.querySelectorAll(`#graphs-container-${sessionId} .graph-panel`);
        sessionGraphs.forEach(panel => {
            const graphId = panel.id;
            this.updateGraph(graphId);
        });
    }

    updateAllGraphsForReferenceChange(): void {
        // Update all graphs when reference lap changes
        this.updateAllGraphs();
    }

    updateCurrentTimePosition(sessionTime: number, sessionId: string): void {
        const selectedLap = this.selectedLaps.get(sessionId);
        if (!selectedLap) return;

        // Calculate position within the current lap (0 to lap duration)
        const currentTimePosition = sessionTime - selectedLap.lapStartTime;
        this.currentTimePositions.set(sessionId, currentTimePosition);
        
        // Update position indicator only on graphs for this session
        this.updatePositionIndicatorOnGraphsForSession(sessionId, currentTimePosition);
    }

    private updatePositionIndicatorOnGraphsForSession(sessionId: string, currentTimePosition: number): void {
        const selectedLap = this.selectedLaps.get(sessionId);
        if (!selectedLap) return;

        const timeResolution = 0.1;
        const indexPosition = currentTimePosition / timeResolution;

        // Find graph canvases only for this specific session
        const sessionGraphs = document.querySelectorAll(`#graphs-container-${sessionId} .graph-panel`);
        sessionGraphs.forEach(panel => {
            const canvas = document.getElementById(`${panel.id}_canvas`) as HTMLCanvasElement;
            if (canvas && (canvas as any).chart) {
                const chart = (canvas as any).chart;
                
                // Update or add the current position annotation
                if (chart.options.plugins.annotation.annotations) {
                    chart.options.plugins.annotation.annotations.currentPosition = {
                        type: 'line',
                        xMin: indexPosition,
                        xMax: indexPosition,
                        borderColor: 'rgba(255, 0, 0, 0.8)',
                        borderWidth: 1,
                        display: true, // Make sure it's visible
                        label: {
                            display: true,
                            content: `${currentTimePosition.toFixed(1)}s`,
                            position: 'end',
                            backgroundColor: 'rgba(255, 0, 0, 0.8)',
                            color: 'white',
                            font: {
                                size: 10
                            }
                        }
                    };
                    
                    // Update the chart immediately without animation
                    chart.update('none');
                }
            }
        });
    }

    renderGraph(canvas: HTMLCanvasElement, lap: LapData, channel1: string, channel2: string): void {
        const timeResolution = 0.1;
        const timePoints: number[] = [];
        const channel1Data: number[] = [];
        const channel2Data: number[] = [];

        for (let time = lap.lapStartTime; time <= lap.lapStartTime + lap.lapTime; time += timeResolution) {
            const datapoint = getDatapointForLap(lap, time);
            if (datapoint) {
                timePoints.push(time - lap.lapStartTime);
                channel1Data.push(datapoint.data.get(channel1) || 0);
                if (channel2) {
                    channel2Data.push(datapoint.data.get(channel2) || 0);
                }
            }
        }

        if (timePoints.length === 0) return;

        // Prepare datasets
        const datasets: any[] = [
            {
                label: channel1,
                data: channel1Data,
                borderColor: '#1e3a8a', // Dark blue
                backgroundColor: 'rgba(30, 58, 138, 0.1)',
                yAxisID: 'y',
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 3,
                borderWidth: 1
            }
        ];

        if (channel2 && channel2Data.length > 0) {
            datasets.push({
                label: channel2,
                data: channel2Data,
                borderColor: '#92400e', // Dark brown
                backgroundColor: 'rgba(146, 64, 14, 0.1)',
                yAxisID: 'y1',
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 3,
                borderWidth: 1
            });
        }

        // Add reference lap data if available
        const referenceLap = this.studio.getReferenceLap();
        if (referenceLap && referenceLap !== lap) {
            const refChannel1Data: number[] = [];
            const refChannel2Data: number[] = [];

            // Generate reference lap data using the same time points
            for (let time = lap.lapStartTime; time <= lap.lapStartTime + lap.lapTime; time += timeResolution) {
                const refDatapoint = getReferenceDatapointForLap(lap, time, referenceLap);
                if (refDatapoint) {
                    refChannel1Data.push(refDatapoint.data.get(channel1) || 0);
                    if (channel2) {
                        refChannel2Data.push(refDatapoint.data.get(channel2) || 0);
                    }
                }
            }

            // Add reference lap datasets
            datasets.push({
                label: `${channel1} (Ref)`,
                data: refChannel1Data,
                borderColor: '#60a5fa', // Light blue
                backgroundColor: 'rgba(96, 165, 250, 0.1)',
                yAxisID: 'y',
                tension: 0.1,
                pointRadius: 0,
                pointHoverRadius: 3,
                borderWidth: 1
            });

            if (channel2 && refChannel2Data.length > 0) {
                datasets.push({
                    label: `${channel2} (Ref)`,
                    data: refChannel2Data,
                    borderColor: '#d97706', // Light brown
                    backgroundColor: 'rgba(217, 119, 6, 0.1)',
                    yAxisID: 'y1',
                    tension: 0.1,
                    pointRadius: 0,
                    pointHoverRadius: 3,
                    borderWidth: 1
                });
            }
        }

        // Create sector split annotations
        const sectorAnnotations: any = {};
        if (lap.sectorStartTimes && lap.sectorStartTimes.length > 0) {
            lap.sectorStartTimes.map(t => t - lap.lapStartTime).forEach((splitTime, index) => {
                // Convert time to index position (splitTime / timeResolution)
                const indexPosition = splitTime / timeResolution;
                sectorAnnotations[`sector${index + 1}`] = {
                    type: 'line',
                    xMin: indexPosition,
                    xMax: indexPosition,
                    borderColor: 'rgba(126, 125, 125, 0.8)',
                    borderWidth: 1,
                    label: {
                        display: true,
                        content: `S${index + 1}`,
                        position: 'start',
                        backgroundColor: 'rgba(126, 125, 125, 0.8)',
                        color: 'white',
                        font: {
                            size: 10
                        }
                    }
                };
            });
        }

        // Add current position annotation placeholder
        sectorAnnotations.currentPosition = {
            type: 'line',
            xMin: 0,
            xMax: 0,
            borderColor: 'rgba(255, 0, 0, 0.8)',
            borderWidth: 1,
            display: false, // Initially hidden
            label: {
                display: true,
                content: '0.0s',
                position: 'end',
                backgroundColor: 'rgba(255, 0, 0, 0.8)',
                color: 'white',
                font: {
                    size: 10
                }
            }
        };

        // Create Chart.js configuration
        const config = {
            type: 'line' as const,
            data: {
                labels: timePoints.map((_, index) => index),
                datasets: datasets
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false, // Disable animations to prevent replay during updates
                interaction: {
                    mode: 'index' as const,
                    intersect: false,
                },
                scales: {
                    x: {
                        display: true,
                        title: {
                            display: false
                        },
                        min: 0,
                        max: timePoints.length - 1,
                        ticks: {
                            callback: function(value: any) {
                                // Convert index back to time for display
                                const timeValue = (value as number) * timeResolution;
                                return timeValue.toFixed(1) + 's';
                            }
                        }
                    },
                    y: {
                        type: 'linear' as const,
                        display: true,
                        position: 'left' as const,
                        title: {
                            display: true,
                            text: channel1
                        }
                    },
                    ...(channel2 ? {
                        y1: {
                            type: 'linear' as const,
                            display: true,
                            position: 'right' as const,
                            title: {
                                display: true,
                                text: channel2
                            },
                            grid: {
                                drawOnChartArea: false,
                            },
                        }
                    } : {})
                },
                plugins: {
                    title: {
                        display: false
                    },
                    legend: {
                        display: true
                    },
                    annotation: {
                        annotations: sectorAnnotations
                    }
                }
            }
        };

        // Create the chart
        const ctx = canvas.getContext('2d');
        if (ctx) {
            const chart = new (window as any).Chart(ctx, config);
            (canvas as any).chart = chart;
            
            // Add click event listener for jumping to time
            this.addClickEventListener(canvas, chart, lap, timeResolution);
        }
    }

    private addClickEventListener(canvas: HTMLCanvasElement, chart: any, lap: LapData, timeResolution: number): void {
        canvas.addEventListener('click', (event) => {
            try {
                // Get the chart's scale information using Chart.js helper
                const canvasPosition = (window as any).Chart.helpers.getRelativePosition(event, chart);
                const dataX = chart.scales.x.getValueForPixel(canvasPosition.x);
                
                if (dataX !== null && dataX >= 0) {
                    // Convert the x-axis index back to time within the lap
                    const timeInLap = dataX * timeResolution;
                    
                    // Calculate the absolute session time
                    const sessionTime = lap.lapStartTime + timeInLap;
                    
                    // Ensure the time is within the lap bounds
                    if (timeInLap >= 0 && timeInLap <= lap.lapTime) {
                        // Trigger time update through the studio's time sync system
                        if (this.studio && this.studio.updateAllUIToTime) {
                            this.studio.updateAllUIToTime(sessionTime, 'ui', lap.sessionId);
                        }
                    }
                }
            } catch (error) {
                console.warn('Error handling graph click:', error);
            }
        });
    }

    private formatTime(seconds: number): string {
        if (seconds < 60) {
            return seconds.toFixed(3) + 's';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
    }
}
