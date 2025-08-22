import { Session, LapData } from './types.js';
import { TelemetryCSVParser } from './csvParser.js';

// UI Handler for CSV File Upload
class CSVUploadHandler {
    private parser: TelemetryCSVParser;

    constructor() {
        this.parser = new TelemetryCSVParser();
        this.setupEventListeners();
    }

    setupEventListeners(): void {
        const uploadArea = document.getElementById('uploadArea')!;
        const fileInput = document.getElementById('fileInput') as HTMLInputElement;

        // File input change event
        fileInput.addEventListener('change', (e) => {
            const target = e.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                this.handleFile(target.files[0]);
            }
        });

        // Drag and drop events
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
                this.handleFile(e.dataTransfer.files[0]);
            }
        });

        // Click to select file
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });
    }

    async handleFile(file: File): Promise<void> {
        if (!file.name.toLowerCase().endsWith('.csv')) {
            alert('Please select a CSV file');
            return;
        }

        try {
            const text = await this.readFileAsText(file);
            const session = this.parser.parseCSV(text);
            this.displaySession(session);
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

    displaySession(session: Session): void {
        const sessionDataDiv = document.getElementById('sessionData')!;
        const sessionInfoDiv = document.getElementById('sessionInfo')!;
        const lapDataDiv = document.getElementById('lapData')!;

        // Show session data
        sessionDataDiv.style.display = 'block';

        // Display session info
        sessionInfoDiv.innerHTML = `
            <div class="data-grid">
                <div class="data-item">
                    <strong>Total Laps</strong>
                    ${session.laps.length}
                </div>
                <div class="data-item">
                    <strong>Total Duration</strong>
                    ${session.duration.length > 0 ? session.duration[0].toFixed(2) + 's' : 'N/A'}
                </div>
                <div class="data-item">
                    <strong>Date</strong>
                    ${session.date || 'N/A'}
                </div>
                <div class="data-item">
                    <strong>Time</strong>
                    ${session.time || 'N/A'}
                </div>
            </div>
        `;

        // Display lap data
        lapDataDiv.innerHTML = '';
        session.laps.forEach((lap: LapData) => {
            const lapDiv = document.createElement('div');
            lapDiv.className = 'lap-info';
            
            const avgSpeed = lap.telemetryData.length > 0 
                ? (lap.telemetryData.reduce((sum, point) => sum + point.speed, 0) / lap.telemetryData.length).toFixed(2)
                : '0.00';
            
            const maxSpeed = lap.telemetryData.length > 0
                ? Math.max(...lap.telemetryData.map(point => point.speed)).toFixed(2)
                : '0.00';

            lapDiv.innerHTML = `
                <h3>Lap ${lap.lapIndex}</h3>
                <div class="data-grid">
                    <div class="data-item">
                        <strong>Lap Time</strong>
                        ${lap.lapTime.toFixed(3)}s
                    </div>
                    <div class="data-item">
                        <strong>Data Points</strong>
                        ${lap.telemetryData.length}
                    </div>
                    <div class="data-item">
                        <strong>Avg Speed</strong>
                        ${avgSpeed} km/h
                    </div>
                    <div class="data-item">
                        <strong>Max Speed</strong>
                        ${maxSpeed} km/h
                    </div>
                </div>
            `;
            
            lapDataDiv.appendChild(lapDiv);
        });

        console.log('Parsed Session:', session);
    }
}

// Initialize the upload handler when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new CSVUploadHandler();
});
