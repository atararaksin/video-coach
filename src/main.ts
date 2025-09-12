import { Session, LapData } from './types.js';
import { TelemetryCSVParser } from './csvParser.js';
import { Studio } from './studio.js';
import { GraphManager } from './graphManager.js';
import { VideoManager } from './videoManager.js';
import { MapManager } from './mapManager.js';
import { getLapAtTimeForSession, getReferenceDatapointForSession } from './sessionUtils.js';
import { getDatapointForLap, getReferenceDatapointForLap } from './lapUtils.js';
import { findDatapointInLapWithInterpolation } from './gpsUtils.js';

const studio = new Studio();

interface SessionTab {
    id: string;
    session: Session;
    filename: string;
}

class RacingDataStudio {
    private parser: TelemetryCSVParser;
    private sessionTabs: SessionTab[] = [];
    private activeSessionId: string | null = null;
    private graphManager: GraphManager;
    private videoManager: VideoManager;
    private mapManager: MapManager;
    public currentLaps: Map<string, LapData> = new Map(); // sessionId -> current lap

    constructor() {
        this.parser = new TelemetryCSVParser();
        this.graphManager = new GraphManager(studio);
        this.videoManager = new VideoManager(studio);
        this.mapManager = new MapManager(studio);
        this.setupGlobalFunctions();
        this.setupTimeSync();
        this.setupStudioTimeSync();
        this.setupDropdownClickOutside();
        this.setupHotkeys();
    }

    setupGlobalFunctions(): void {
        // Make functions available globally for HTML onclick handlers
        (window as any).importSession = () => this.importSession();
        (window as any).handleFileSelect = (event: Event) => this.handleFileSelect(event);
        (window as any).switchToTab = (sessionId: string) => this.switchToTab(sessionId);
        (window as any).closeTab = (sessionId: string, event: Event) => this.closeTab(sessionId, event);
        (window as any).addTelemetryGraph = (sessionId: string) => this.addTelemetryGraph(sessionId);
        (window as any).removeGraph = (graphId: string) => this.removeGraph(graphId);
        (window as any).updateGraph = (graphId: string) => this.updateGraph(graphId);
        (window as any).selectLap = (sessionId: string, lapIndex: number) => this.selectLap(sessionId, lapIndex);
        
        // Video-related functions
        (window as any).loadVideo = (sessionId: string) => this.videoManager.loadVideo(sessionId);
        (window as any).syncVideo = (sessionId: string) => this.videoManager.syncVideo(sessionId);
        
        // Navigation panel functions
        (window as any).jumpToLap = (sessionId: string, lapIndex: number) => this.jumpToLap(sessionId, lapIndex);
        (window as any).jumpToLapStart = (sessionId: string, lapIndex: number) => this.jumpToLapStart(sessionId, lapIndex);
        (window as any).jumpToSplit = (sessionId: string, lapIndex: number, splitIndex: number) => this.jumpToSplit(sessionId, lapIndex, splitIndex);
        
        // Reference lap dropdown functions
        (window as any).selectReferenceFromDropdown = (currentSessionId: string, value: string) => this.selectReferenceFromDropdown(currentSessionId, value);
    }

    setupTimeSync(): void {
        // Set up the time synchronization callback
        this.videoManager.setTimeUpdateCallback((time: number, source: 'video' | 'ui', sessionId: string) => {
            this.updateAllUIToTime(time, source, sessionId);
        });
    }

    setupStudioTimeSync(): void {
        // Add the updateAllUIToTime method to the studio instance so graphs can call it
        (studio as any).updateAllUIToTime = (time: number, source: 'video' | 'ui', sessionId: string) => {
            this.updateAllUIToTime(time, source, sessionId);
        };
    }

    importSession(): void {
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;
        fileInput.click();
    }

    async handleFileSelect(event: Event): Promise<void> {
        const target = event.target as HTMLInputElement;
        if (target.files && target.files.length > 0) {
            await this.handleFile(target.files[0]);
            // Reset the input so the same file can be selected again
            target.value = '';
        }
    }

    async handleFile(file: File): Promise<void> {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Please select a CSV file');
            return;
        }

        try {
            const text = await this.readFileAsText(file);
            const session = this.parser.parseCSV(text);
            studio.addSession(session);
            
            // Create a new session tab
            const sessionTab: SessionTab = {
                id: session.id,
                session: session,
                filename: file.name
            };
            
            this.sessionTabs.push(sessionTab);
            this.createTab(sessionTab);
            this.createSessionContent(sessionTab);
            this.switchToTab(sessionTab.id);
            
            // Refresh reference lap dropdowns in all other sessions
            this.refreshAllReferenceDropdowns();
            
        } catch (error) {
            console.error('Error parsing CSV:', error);
            alert('Error parsing CSV file: ' + (error as Error).message);
        }
    }

    readFileAsText(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as string);
            reader.onerror = (e) => reject(e);
            reader.readAsText(file);
        });
    }

    createTab(sessionTab: SessionTab): void {
        const tabsContainer = document.getElementById('tabsContainer')!;
        
        const tab = document.createElement('div');
        tab.className = 'tab';
        tab.id = `tab_${sessionTab.id}`;
        tab.onclick = () => this.switchToTab(sessionTab.id);
        
        tab.innerHTML = `
            <span>${sessionTab.filename}</span>
            <span class="tab-close" onclick="closeTab('${sessionTab.id}', event)">×</span>
        `;
        
        tabsContainer.appendChild(tab);
    }

    createSessionContent(sessionTab: SessionTab): void {
        const content = document.getElementById('content')!;
        
        const sessionDiv = document.createElement('div');
        sessionDiv.className = 'session-content';
        sessionDiv.id = `content_${sessionTab.id}`;
        
        sessionDiv.innerHTML = this.generateLapTable(sessionTab.session);
        
        content.appendChild(sessionDiv);

        // Auto-add GPS Speed graph if available
        this.addDefaultGraph(sessionTab);

        // Auto-select the best lap (fastest lap time)
        this.jumpToBestLapStart(sessionTab.session);

        // Initialize map for this session
        this.initializeMapForSession(sessionTab.id);
    }

    generateLapTable(session: Session): string {
        // Filter out incomplete laps (first and last are usually incomplete)
        const laps = session.laps;//.slice(1, -1);
        
        if (laps.length === 0) {
            return `
                <div class="empty-state">
                    <h2>No Laps Found</h2>
                    <p>This session doesn't contain any lap data.</p>
                </div>
            `;
        }

        const sectorCount = studio.track.sectorSplits.length + 1;
        
        // Generate sector headers
        const sectorHeaders = Array.from({length: sectorCount}, (_, i) => 
            `<th>S${i + 1}</th>`
        ).join('');

        // Generate table rows
        const tableRows = laps.map(lap => {
            const maxSpeed = lap.rawDatapoints.length > 0
                ? Math.max(...lap.rawDatapoints.map(point => point.data.get("GPS Speed") || 0))
                : 0;

            const sectorCells = lap.sectorTimes.map(time => 
                `<td class="sector-time">${this.formatTime(time)}</td>`
            ).join('');

            return `
                <tr onclick="selectLap('${session.id}', ${lap.lapIndex})" style="cursor: pointer;">
                    <td>${lap.lapIndex}</td>
                    <td class="lap-time">${this.formatTime(lap.lapTime)}</td>
                    ${sectorCells}
                    <td>${maxSpeed.toFixed(1)} km/h</td>
                </tr>
            `;
        }).join('');

        return `
            <table class="lap-table">
                <thead>
                    <tr>
                        <th>Lap #</th>
                        <th>Lap Time</th>
                        ${sectorHeaders}
                        <th>Top Speed</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}
                </tbody>
            </table>
            ${this.generateVideoPanel(session)}
            ${this.generateTelemetryGraphs(session)}
        `;
    }

    generateVideoPanel(session: Session): string {
        const navigationTable = this.generateNavigationTable(session);
        
        return `
            <div class="video-panel" id="video-panel-${session.id}">
                <div class="video-header">
                    <h3>Video</h3>
                    <div class="video-controls">
                        <div class="time-delta-bar" id="time-delta-bar-${session.id}">
                            <div class="delta-container">
                                <div class="delta-bar-background">
                                    <div class="delta-bar-fill" id="delta-bar-fill-${session.id}"></div>
                                    <div class="delta-center-line"></div>
                                </div>
                                <div class="delta-text" id="delta-text-${session.id}">--</div>
                            </div>
                        </div>
                        <div class="reference-lap-selector">
                            <label for="reference-select-${session.id}">Reference Lap:</label>
                            <select id="reference-select-${session.id}" class="reference-select" onchange="selectReferenceFromDropdown('${session.id}', this.value)">
                                <option value="">Select Reference Lap</option>
                                ${this.generateReferenceOptions()}
                            </select>
                        </div>
                        <input type="file" id="video-file-${session.id}" accept="video/*" style="display: none;">
                        <button class="load-video-btn" onclick="loadVideo('${session.id}')">Load Video</button>
                        <button class="sync-video-btn" onclick="syncVideo('${session.id}')" disabled>Sync with Current Time</button>
                    </div>
                </div>
                <div class="video-content-wrapper">
                    ${navigationTable}
                    <div class="video-content">
                        <div class="video-placeholder" id="video-placeholder-${session.id}">
                            <p>No video loaded</p>
                            <button class="load-video-btn" onclick="loadVideo('${session.id}')">Load Video File</button>
                        </div>
                        <video id="video-${session.id}" class="video-player" controls style="display: none;">
                            Your browser does not support the video tag.
                        </video>
                    </div>
                    <div class="map-panel" id="map-panel-${session.id}">
                        <div class="map-header">
                            <h3>Track Map</h3>
                        </div>
                        <div class="map-container" id="map-container-${session.id}">
                            <!-- Map will be initialized here -->
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    generateNavigationTable(session: Session): string {
        if (session.laps.length === 0) {
            return '<div class="navigation-panel"></div>';
        }

        // Get sector count from studio track
        const splitCount = studio.track.sectorSplits.length;
        
        // Generate sector headers
        const sectorHeaders = Array.from({length: splitCount}, (_, i) => 
            `<th>S${i + 1}</th>`
        ).join('');

        // Generate table rows
        const tableRows = session.laps.map(lap => {
            // Generate sector cells using sectorSplitTimes
            const sectorCells = lap.sectorSplitTimes.map((splitTime, index) => {
                if (splitTime != null) return `<td class="sector-cell" onclick="jumpToSplit('${session.id}', ${lap.lapIndex}, ${index})" title="Jump to split ${index + 1}">S${index + 1}</td>`;
                else return `<td class="sector-cell" title="--">--</td>`;
            }).join('');

            return `
                <tr>
                    <td class="lap-index-cell" onclick="jumpToLap('${session.id}', ${lap.lapIndex})" title="Jump to corresponding position in this lap">${lap.lapIndex}</td>
                    <td class="lap-time-cell" onclick="jumpToLap('${session.id}', ${lap.lapIndex})" title="Jump to corresponding position in this lap">${this.formatTime(lap.lapTime)}</td>
                    <td class="lap-start-cell" onclick="jumpToLapStart('${session.id}', ${lap.lapIndex})" title="Jump to start of this lap">Start</td>
                    ${sectorCells}
                </tr>
            `;
        }).join('');

        return `
            <div class="navigation-panel">
                <div class="navigation-header">
                    <h4>Quick Navigation</h4>
                </div>
                <div class="navigation-table-container">
                    <table class="navigation-table">
                        <thead>
                            <tr>
                                <th>Lap</th>
                                <th>Time</th>
                                <th>Start</th>
                                ${sectorHeaders}
                            </tr>
                        </thead>
                        <tbody>
                            ${tableRows}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    generateTelemetryGraphs(session: Session): string {
        return `
            <div class="telemetry-section">
                <div class="graph-controls">
                    <button class="add-graph-btn" onclick="addTelemetryGraph('${session.id}')">Add Graph</button>
                </div>
                <div id="graphs-container-${session.id}" class="graphs-container">
                    <!-- Graphs will be added here dynamically -->
                </div>
            </div>
        `;
    }

    updateAllUIToTime(time: number, source: 'video' | 'ui', sessionId: string): void {
        if (source === 'ui') console.log("Jumping to ", time);
        
        // Update current time for this session in studio
        studio.currentTimes.set(sessionId, time);

        // Update map current position
        this.mapManager.updateCurrentPosition(sessionId, time);

        if (source !== 'video') {
            this.videoManager.updateVideoTime(time, sessionId);
        }
        
        // Find which lap this time corresponds to for the active session
        const session = this.sessionTabs.find(tab => tab.id === sessionId)?.session;
        if (!session) return;

        // Find the lap that contains this time
        const currentLap = getLapAtTimeForSession(session, time);

        if (currentLap && currentLap != this.currentLaps.get(sessionId)) {
            this.currentLaps.set(sessionId, currentLap);

            // Update visual selection in the lap table
            this.updateLapSelectionVisual(sessionId, currentLap.lapIndex);
        }

        // Update graph manager's selected lap if it's different
        if (!this.graphManager.getSelectedLap(sessionId) || 
            this.graphManager.getSelectedLap(sessionId)?.lapIndex !== currentLap.lapIndex) {
            this.graphManager.setSelectedLap(currentLap);
        }
        
        // Update graph position indicators
        this.graphManager.updateCurrentTimePosition(time, sessionId);

        // Update video time if the source is not video (to avoid feedback loop)
        if (source !== 'video') {
            this.videoManager.updateVideoTime(time, sessionId);
        }

        // Update time delta bar
        this.updateTimeDeltaBar(sessionId, time);
    }

    updateTimeDeltaBar(sessionId: string, time: number): void {
        const session = this.sessionTabs.find(tab => tab.id === sessionId)?.session;
        if (!session) return;

        const deltaBarFill = document.getElementById(`delta-bar-fill-${sessionId}`);
        const deltaText = document.getElementById(`delta-text-${sessionId}`);
        
        if (!deltaBarFill || !deltaText) return;

        // Get current lap
        const currentLap = getLapAtTimeForSession(session, time);
        if (!currentLap) return;

        // Get reference lap from studio
        const referenceLap = studio.getReferenceLap(sessionId);
        
        if (!referenceLap) {
            // No reference lap selected, show placeholder
            deltaText.textContent = '--';
            deltaBarFill.style.width = '0%';
            deltaBarFill.style.left = '50%';
            deltaBarFill.style.backgroundColor = '#ccc';
            return;
        }

        try {
            // Get current lap datapoint using getDatapointForLap()
            const currentLapDatapoint = getDatapointForLap(currentLap, time);
            if (!currentLapDatapoint) return;

            // Get reference lap datapoint using getReferenceDatapointForLap()
            const referenceLapDatapoint = getReferenceDatapointForLap(currentLap, time, referenceLap);
            //const referenceLapDatapoint = findDatapointInLapWithInterpolation(currentLap.datapoints, currentLapDatapoint, referenceLap.datapoints);
            if (!referenceLapDatapoint) return;

            // Compute diff as specified: currentLapDatapoint.time - currentLap.startTime - referenceLapDatapoint.time + referenceLap.startTime
            const diff = currentLapDatapoint.time - currentLap.lapStartTime - referenceLapDatapoint.time + referenceLap.lapStartTime;

            // Update delta text
            const sign = diff >= 0 ? '+' : '';
            deltaText.textContent = `${sign}${diff.toFixed(3)}s`;

            // Update delta bar visualization
            const maxDelta = 1.0; // Maximum delta to show (1 seconds)
            const normalizedDelta = Math.max(-1, Math.min(1, diff / maxDelta)); // Clamp between -1 and 1
            
            if (diff < 0) {
                // Faster than reference (negative delta) - green, to the right
                deltaBarFill.style.backgroundColor = '#4CAF50';
                deltaBarFill.style.left = `${50 + (normalizedDelta * 50)}%`; // normalizedDelta is negative, so this moves left from center
                deltaBarFill.style.width = `${Math.abs(normalizedDelta) * 50}%`;
                deltaText.style.color = '#4CAF50';
            } else {
                // Slower than reference (positive delta) - red, to the left
                deltaBarFill.style.backgroundColor = '#F44336';
                deltaBarFill.style.left = '50%';
                deltaBarFill.style.width = `${normalizedDelta * 50}%`;
                deltaText.style.color = '#F44336';
            }
        } catch (error) {
            console.error('Error calculating time delta:', error);
            deltaText.textContent = '--';
            deltaBarFill.style.width = '0%';
            deltaBarFill.style.left = '50%';
            deltaBarFill.style.backgroundColor = '#ccc';
        }
    }


    updateLapSelectionVisual(sessionId: string, lapIndex: number): void {
        console.log("Updating lap table selection to lapIndex:", lapIndex);

        // Update visual selection in table without triggering graph updates
        const sessionContent = document.getElementById(`content_${sessionId}`);
        if (sessionContent) {
            // Remove previous selection
            sessionContent.querySelectorAll('.lap-table tbody tr').forEach(row => {
                row.classList.remove('selected');
            });
            
            // Find the row by matching the exact lapIndex in the onclick attribute
            const rows = sessionContent.querySelectorAll('.lap-table tbody tr');
            rows.forEach(row => {
                const onclick = row.getAttribute('onclick');
                if (onclick && onclick === `selectLap('${sessionId}', ${lapIndex})`) {
                    row.classList.add('selected');
                }
            });
        }

        // Also update navigation panel highlighting
        this.updateNavigationPanelHighlight(sessionId, lapIndex);
    }

    updateNavigationPanelHighlight(sessionId: string, lapIndex: number): void {
        const videoPanel = document.getElementById(`video-panel-${sessionId}`);
        if (videoPanel) {
            // Remove previous highlighting from navigation table
            videoPanel.querySelectorAll('.navigation-table tbody tr').forEach(row => {
                row.classList.remove('current-lap');
            });
            
            // Find and highlight the current lap row in navigation table
            const navigationRows = videoPanel.querySelectorAll('.navigation-table tbody tr');
            navigationRows.forEach(row => {
                // Check if any cell in this row has a click handler for this lapIndex
                const lapCell = row.querySelector(`[onclick*="jumpToLap('${sessionId}', ${lapIndex})"]`);
                if (lapCell) {
                    row.classList.add('current-lap');
                }
            });
        }
    }

    formatTime(seconds: number): string {
        if (seconds == null) return "--";

        if (seconds < 60) {
            return seconds.toFixed(3) + 's';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
    }

    switchToTab(sessionId: string): void {
        // Hide empty state
        const emptyState = document.getElementById('emptyState')!;
        emptyState.style.display = 'none';

        // Update active tab
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
        });
        
        const activeTab = document.getElementById(`tab_${sessionId}`);
        if (activeTab) {
            activeTab.classList.add('active');
        }

        // Update active content
        document.querySelectorAll('.session-content').forEach(content => {
            content.classList.remove('active');
        });
        
        const activeContent = document.getElementById(`content_${sessionId}`);
        if (activeContent) {
            activeContent.classList.add('active');
        }

        this.activeSessionId = sessionId;
    }

    closeTab(sessionId: string, event: Event): void {
        event.stopPropagation(); // Prevent tab switch when clicking close button
        
        // Find and remove the session
        const sessionIndex = this.sessionTabs.findIndex(s => s.id === sessionId);
        if (sessionIndex === -1) return;
        
        this.sessionTabs.splice(sessionIndex, 1);
        
        // Remove tab and content elements
        const tab = document.getElementById(`tab_${sessionId}`);
        const content = document.getElementById(`content_${sessionId}`);
        
        if (tab) tab.remove();
        if (content) content.remove();
        
        // If this was the active tab, switch to another tab or show empty state
        if (this.activeSessionId === sessionId) {
            if (this.sessionTabs.length > 0) {
                // Switch to the last remaining session
                this.switchToTab(this.sessionTabs[this.sessionTabs.length - 1].id);
            } else {
                // Show empty state
                this.activeSessionId = null;
                const emptyState = document.getElementById('emptyState')!;
                emptyState.style.display = 'block';
            }
        }

        studio.removeSession(sessionId);
        
        // Clean up video resources
        this.videoManager.removeVideo(sessionId);
        
        // Refresh reference lap dropdowns in all remaining sessions
        this.refreshAllReferenceDropdowns();
        
        // Update all graphs in case the reference lap was removed
        this.graphManager.updateAllGraphsForReferenceChange();
    }

    addTelemetryGraph(sessionId: string): void {
        const session = this.sessionTabs.find(tab => tab.id === sessionId)?.session;
        if (!session) return;
        
        this.graphManager.addTelemetryGraph(sessionId, session);
    }

    removeGraph(graphId: string): void {
        this.graphManager.removeGraph(graphId);
    }

    updateGraph(graphId: string): void {
        this.graphManager.updateGraph(graphId);
    }

    selectLap(sessionId: string, lapIndex: number): void {
        this.jumpToLapStart(sessionId, lapIndex);
    }

    addDefaultGraph(sessionTab: SessionTab): void {
        // Check if GPS Speed channel is available
        if (sessionTab.session.channels.includes('GPS Speed')) {
            // Add a GPS Speed graph and get the graph ID
            const graphId = this.graphManager.addTelemetryGraph(sessionTab.id, sessionTab.session);
            
            // Set GPS Speed as the primary channel for the new graph
            setTimeout(() => {
                const channel1Select = document.getElementById(`${graphId}_channel1`) as HTMLSelectElement;
                if (channel1Select) {
                    channel1Select.value = 'GPS Speed';
                    this.updateGraph(graphId);
                }
            }, 100); // Small delay to ensure DOM elements are created
        }
    }

    jumpToBestLapStart(session: Session): void {
        if (session.bestLapIndex !== undefined) {
            this.jumpToLapStart(session.id, session.bestLapIndex);
        }
    }

    jumpToLap(sessionId: string, lapIndex: number): void {
        const session = studio.sessions.get(sessionId);
        if (!session) return;

        // Get the current time for this session
        const currentTime = studio.currentTimes.get(sessionId) || 0;

        const currentLap = getLapAtTimeForSession(session, currentTime);

        if (currentLap.lapIndex == lapIndex) return; // Same lap

        // Find the target lap
        const targetLap = session.laps.find(l => l.lapIndex === lapIndex);
        if (!targetLap) return;
        
        // Use getReferenceDatapointForSession to find corresponding position in target lap
        const referenceDatapoint = getReferenceDatapointForSession(session, currentTime, targetLap);
        
        if (referenceDatapoint) {
            this.updateAllUIToTime(referenceDatapoint.time, 'ui', sessionId);
        }
    }

    jumpToLapStart(sessionId: string, lapIndex: number): void {
        const session = studio.sessions.get(sessionId);
        if (!session) return;

        // Find the target lap
        const targetLap = session.laps.find(l => l.lapIndex === lapIndex);
        if (!targetLap) return;

        // Jump to the start of the lap
        this.updateAllUIToTime(targetLap.lapStartTime, 'ui', sessionId);
    }

    jumpToSplit(sessionId: string, lapIndex: number, splitIndex: number): void {
        const session = studio.sessions.get(sessionId);
        if (!session) return;

        // Find the target lap
        const targetLap = session.laps.find(l => l.lapIndex === lapIndex);
        if (!targetLap) return;

        // Check if the sector index is valid
        if (splitIndex < 0 || splitIndex >= targetLap.sectorSplitTimes.length) return;

        // Jump to the sector start time
        const sectorSplitTime = targetLap.sectorSplitTimes[splitIndex];

        if (sectorSplitTime != null) {
            this.updateAllUIToTime(sectorSplitTime, 'ui', sessionId);
        }
    }

    initializeMapForSession(sessionId: string): void {
        // Initialize the map for this session
        this.mapManager.initializeMap(sessionId);
    }

    generateReferenceOptions(): string {
        let options = '';
        
        // Add all sessions with their laps
        this.sessionTabs.forEach(sessionTab => {
            const session = sessionTab.session;
            const completeLaps = session.laps.filter(lap => lap.isComplete); // Filter out incomplete laps
            
            if (completeLaps.length === 0) return; // Skip sessions with no complete laps

            // Create optgroup for this session
            options += `<optgroup label="${sessionTab.filename}">`;

            // Add complete laps
            completeLaps.forEach(lap => {
                const value = `${session.id}:lap:${lap.lapIndex}`;
                options += `<option value="${value}">Lap ${lap.lapIndex} - ${this.formatTime(lap.lapTime)}</option>`;
            });

            // Add best theoretical lap if available
            if (session.bestTheoreticalLap) {
                const value = `${session.id}:theoretical`;
                options += `<option value="${value}">Best Theoretical - ${this.formatTime(session.bestTheoreticalLap.lapTime)}</option>`;
            }

            options += `</optgroup>`;
        });

        return options;
    }

    selectReferenceFromDropdown(currentSessionId: string, value: string): void {
        if (!value) {
            // Clear reference lap
            studio.setReferenceLap(null, currentSessionId);
            this.graphManager.updateAllGraphsForReferenceChange();
            this.mapManager.updateAllMapsForReferenceChange();
            return;
        }

        const parts = value.split(':');
        if (parts.length < 2) return;

        const sessionId = parts[0];
        const type = parts[1];

        const session = studio.sessions.get(sessionId);
        if (!session) return;

        if (type === 'theoretical' && session.bestTheoreticalLap) {
            // Set best theoretical lap as reference
            studio.setReferenceLap(session.bestTheoreticalLap, currentSessionId);
        } else if (type === 'lap' && parts.length === 3) {
            const lapIndex = parseInt(parts[2]);
            const lap = session.laps.find(l => l.lapIndex === lapIndex);
            if (lap) {
                studio.setReferenceLap(lap, currentSessionId);
            }
        }
        
        // Update all graphs and maps for reference change
        this.graphManager.updateAllGraphsForReferenceChange();
        this.mapManager.updateAllMapsForReferenceChange();
    }

    refreshAllReferenceDropdowns(): void {
        // Update all reference select elements with current session options
        this.sessionTabs.forEach(sessionTab => {
            const select = document.getElementById(`reference-select-${sessionTab.id}`) as HTMLSelectElement;
            if (select) {
                // Store current selection to preserve it if still valid
                const currentValue = select.value;
                
                // Regenerate options with current sessions
                const newOptions = this.generateReferenceOptions();
                select.innerHTML = `<option value="">Select Reference Lap</option>${newOptions}`;
                
                // Try to restore previous selection if it still exists
                if (currentValue && this.isValidReferenceOption(currentValue)) {
                    select.value = currentValue;
                } else {
                    // If previous selection is no longer valid, clear it
                    select.value = '';
                    
                    this.graphManager.updateAllGraphsForReferenceChange();
                    this.mapManager.updateAllMapsForReferenceChange();
                }
            }
        });
    }

    isValidReferenceOption(value: string): boolean {
        if (!value) return true; // Empty value is always valid
        
        const parts = value.split(':');
        if (parts.length < 2) return false;
        
        const sessionId = parts[0];
        const type = parts[1];
        
        const session = studio.sessions.get(sessionId);
        if (!session) return false;
        
        if (type === 'theoretical') {
            return !!session.bestTheoreticalLap;
        } else if (type === 'lap' && parts.length === 3) {
            const lapIndex = parseInt(parts[2]);
            return !!session.laps.find(l => l.lapIndex === lapIndex);
        }
        
        return false;
    }

    setupDropdownClickOutside(): void {
        // Close dropdowns when clicking outside
        document.addEventListener('click', (event) => {
            const target = event.target as HTMLElement;
            
            // Check if the click is outside any dropdown
            if (!target.closest('.dropdown-container')) {
                document.querySelectorAll('.dropdown-menu').forEach(menu => {
                    (menu as HTMLElement).style.display = 'none';
                });
            }
        });
    }

    setupHotkeys(): void {
        document.addEventListener('keydown', (event) => {
            // Only handle hotkeys if no input elements are focused
            const activeElement = document.activeElement;
            if (activeElement && (
                activeElement.tagName === 'INPUT' || 
                activeElement.tagName === 'TEXTAREA' || 
                activeElement.tagName === 'SELECT' ||
                activeElement.hasAttribute('contenteditable')
            )) {
                return;
            }

            // Only handle hotkeys if there's an active session
            if (!this.activeSessionId) {
                return;
            }

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    this.adjustCurrentLap(-1);
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    this.adjustCurrentLap(1);
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    this.adjustCurrentTime(-0.05);
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    this.adjustCurrentTime(0.05);
                    break;
            }
        });
    }

    adjustCurrentLap(deltaLaps: number): void {
        if (!this.activeSessionId) return;

        const session = studio.sessions.get(this.activeSessionId);
        if (!session) return;

        const currentTime = studio.currentTimes.get(this.activeSessionId) || 0;
        const currentLap = getLapAtTimeForSession(session, currentTime);
        
        if (!currentLap) return;

        // Find adjusted lap
        const currentLapIndex = currentLap.lapIndex;
        const adjustedLap = session.laps.find(lap => lap.lapIndex === currentLapIndex + deltaLaps);
        
        if (adjustedLap) {
            this.jumpToLap(this.activeSessionId, adjustedLap.lapIndex);
        }
    }

    adjustCurrentTime(deltaSeconds: number): void {
        if (!this.activeSessionId) return;

        const session = studio.sessions.get(this.activeSessionId);
        if (!session) return;

        const currentTime = studio.currentTimes.get(this.activeSessionId) || 0;
        const newTime = Math.min(Math.max(0, currentTime + deltaSeconds), session.duration);
        
        this.updateAllUIToTime(newTime, 'ui', this.activeSessionId);
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RacingDataStudio();
});
