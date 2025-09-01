import { Session, LapData } from './types.js';
import { TelemetryCSVParser } from './csvParser.js';
import { Studio } from './studio.js';
import { GraphManager } from './graphManager.js';

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

    constructor() {
        this.parser = new TelemetryCSVParser();
        this.graphManager = new GraphManager();
        this.setupGlobalFunctions();
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
        this.selectBestLap(sessionTab.session);
    }

    generateLapTable(session: Session): string {
        // Filter out incomplete laps (first and last are usually incomplete)
        const completeLaps = session.laps.slice(1, -1);
        
        if (completeLaps.length === 0) {
            return `
                <div class="empty-state">
                    <h2>No Complete Laps Found</h2>
                    <p>This session doesn't contain any complete lap data.</p>
                </div>
            `;
        }

        // Determine number of sectors from the first complete lap
        const sectorCount = completeLaps[0].sectorTimes?.length || 0;
        
        // Generate sector headers
        const sectorHeaders = Array.from({length: sectorCount}, (_, i) => 
            `<th>S${i + 1}</th>`
        ).join('');

        // Generate table rows
        const tableRows = completeLaps.map(lap => {
            const maxSpeed = lap.datapoints.length > 0
                ? Math.max(...lap.datapoints.map(point => point.data.get("GPS Speed") || 0))
                : 0;

            const sectorCells = lap.sectorTimes 
                ? lap.sectorTimes.map(time => 
                    `<td class="sector-time">${this.formatTime(time)}</td>`
                  ).join('')
                : Array.from({length: sectorCount}, () => '<td class="sector-time">-</td>').join('');

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
            ${this.generateTelemetryGraphs(session)}
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

    formatTime(seconds: number): string {
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
        const session = this.sessionTabs.find(tab => tab.id === sessionId)?.session;
        if (!session) return;

        // Find the lap directly by lapIndex
        const lap = session.laps.find(l => l.lapIndex === lapIndex);
        if (!lap) return;

        // Update visual selection in table
        const sessionContent = document.getElementById(`content_${sessionId}`);
        if (sessionContent) {
            // Remove previous selection
            sessionContent.querySelectorAll('.lap-table tbody tr').forEach(row => {
                row.classList.remove('selected');
            });
            
            // Find the clicked row by matching the exact lapIndex in the onclick attribute
            const rows = sessionContent.querySelectorAll('.lap-table tbody tr');
            rows.forEach(row => {
                const onclick = row.getAttribute('onclick');
                // Use more precise matching to avoid substring issues (e.g., lap 1 vs lap 11)
                if (onclick && onclick === `selectLap('${sessionId}', ${lapIndex})`) {
                    row.classList.add('selected');
                }
            });
        }

        // Update graphs with selected lap
        this.graphManager.setSelectedLap(lap);
    }

    addDefaultGraph(sessionTab: SessionTab): void {
        // Check if GPS Speed channel is available
        if (sessionTab.session.channels.includes('GPS Speed')) {
            // Add a GPS Speed graph
            this.graphManager.addTelemetryGraph(sessionTab.id, sessionTab.session);
            
            // Set GPS Speed as the primary channel for the first graph
            setTimeout(() => {
                const graphId = `graph_${sessionTab.id}_0`; // First graph has counter 0
                const channel1Select = document.getElementById(`${graphId}_channel1`) as HTMLSelectElement;
                if (channel1Select) {
                    channel1Select.value = 'GPS Speed';
                    this.updateGraph(graphId);
                }
            }, 100); // Small delay to ensure DOM elements are created
        }
    }

    selectBestLap(session: Session): void {
        if (session.bestLapIndex !== undefined) {
            this.selectLap(session.id, session.bestLapIndex);
        }
    }
}

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new RacingDataStudio();
});
