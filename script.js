class VideoFrameAnalyzer {
    constructor() {
        this.video = null;
        this.frameRate = 30; // Default frame rate, will be updated when video loads
        this.currentFrameNumber = 0;
        this.selectedFrame = null;
        this.csvData = null;
        this.telemetryData = [];
        this.lapTimes = [];
        this.lapStartTimes = []; // Cumulative start times for each lap
        this.selectedLapIndex = -1; // Index of selected lap for sync
        this.syncOffset = 0; // Time offset between video and telemetry data
        this.sectorBorders = []; // GPS-based sector borders
        this.lapSectorTimes = []; // Sector times for each lap
        this.bestLapData = []; // Telemetry data for the best lap
        this.bestLapIndex = -1; // Index of the best lap
        this.diffToBestData = []; // Diff to best lap for each datapoint
        
        this.initializeElements();
        this.bindEvents();
    }

    initializeElements() {
        // File input elements
        this.fileInput = document.getElementById('videoFile');
        this.csvInput = document.getElementById('csvFile');
        this.fileInfo = document.getElementById('fileInfo');
        this.csvInfo = document.getElementById('csvInfo');
        
        // Video elements
        this.videoSection = document.getElementById('videoSection');
        this.video = document.getElementById('videoPlayer');
        this.mainContentArea = document.getElementById('mainContentArea');
        
        // Control elements
        this.currentTimeSpan = document.getElementById('currentTime');
        this.durationSpan = document.getElementById('duration');
        this.currentFrameSpan = document.getElementById('currentFrame');
        this.prevFrameBtn = document.getElementById('prevFrame');
        this.nextFrameBtn = document.getElementById('nextFrame');
        
        
        // Lap selection elements
        this.lapSelection = document.getElementById('lapSelection');
        this.lapTable = document.getElementById('lapTable');
        this.lapTableBody = document.getElementById('lapTableBody');
        
        // Telemetry elements
        this.telemetryDisplay = document.getElementById('telemetryDisplay');
        this.speedValue = document.getElementById('speedValue');
        this.latAccValue = document.getElementById('latAccValue');
        this.lonAccValue = document.getElementById('lonAccValue');
        this.altitudeValue = document.getElementById('altitudeValue');
        this.diffValue = document.getElementById('diffValue');
        
        // Delta bar elements
        this.deltaBarContainer = document.getElementById('deltaBarContainer');
        this.deltaBarFill = document.getElementById('deltaBarFill');
        this.deltaBarText = document.getElementById('deltaBarText');
        
        // GPS visualization elements
        this.gpsSection = document.getElementById('gpsSection');
        this.gpsCanvas = document.getElementById('gpsCanvas');
        this.gpsCtx = this.gpsCanvas.getContext('2d');
        this.gpsVisible = false;
        this.layerSelect = document.getElementById('layerSelect');
        this.refreshMapBtn = document.getElementById('refreshMap');
        this.currentMapLayer = 'satellite';
        this.tileCache = new Map(); // Cache for map tiles
        this.loadingTiles = new Set(); // Track tiles being loaded
        
        // Speed graph elements
        this.speedGraphContainer = document.getElementById('speedGraphContainer');
        this.speedGraphCanvas = document.getElementById('speedGraphCanvas');
        this.speedGraphCtx = this.speedGraphCanvas ? this.speedGraphCanvas.getContext('2d') : null;
        this.speedGraphRange = document.getElementById('speedGraphRange');
        this.timelineEnd = document.getElementById('timelineEnd');
        this.speedGraphVisible = false;
        this.speedGraphData = []; // Processed speed data for current lap
        this.speedGraphTimeWindow = 30; // Show 30 seconds of data
    }

    bindEvents() {
        // File input change events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.csvInput.addEventListener('change', (e) => this.handleCsvSelect(e));
        
        // Video events
        this.video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.video.addEventListener('loadeddata', () => this.estimateFrameRate());
        this.video.addEventListener('play', () => this.startHighFrequencyUpdates());
        this.video.addEventListener('pause', () => this.stopHighFrequencyUpdates());
        this.video.addEventListener('seeking', () => this.handleSeeking());
        this.video.addEventListener('seeked', () => this.handleSeeked());
        
        // Frame control events
        this.prevFrameBtn.addEventListener('click', () => this.previousFrame());
        this.nextFrameBtn.addEventListener('click', () => this.nextFrame());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // GPS layer controls
        if (this.layerSelect) {
            this.layerSelect.addEventListener('change', (e) => this.handleLayerChange(e));
        }
        if (this.refreshMapBtn) {
            this.refreshMapBtn.addEventListener('click', () => this.refreshGpsVisualization());
        }
        
        // Initialize high-frequency update system
        this.isHighFrequencyActive = false;
        this.animationFrameId = null;
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 60; // Target 60 FPS updates
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        
        if (!file) {
            this.hideVideoSection();
            return;
        }

        // Validate file type
        if (!file.type.startsWith('video/')) {
            this.showFileInfo('Please select a valid video file.', 'error');
            return;
        }

        // Display file information
        this.showFileInfo(`
            <strong>Selected:</strong> ${file.name}<br>
            <strong>Size:</strong> ${this.formatFileSize(file.size)}<br>
            <strong>Type:</strong> ${file.type}
        `);

        // Create object URL and load video
        const videoURL = URL.createObjectURL(file);
        this.video.src = videoURL;
        this.showVideoSection();

        // Clean up previous URL
        this.video.addEventListener('loadstart', () => {
            if (this.previousVideoURL) {
                URL.revokeObjectURL(this.previousVideoURL);
            }
            this.previousVideoURL = videoURL;
        });

        // Check if we should show the main content area
        this.checkAndShowMainContent();
    }

    handleVideoLoaded() {
        this.updateDuration();
        this.currentFrameNumber = 0;
        this.updateFrameDisplay();
        
        // Reset selected frame info
        this.selectedFrame = null;
    }

    handleTimeUpdate() {
        this.updateCurrentTime();
        this.updateCurrentFrame();
        // Only update telemetry if high-frequency updates are not active
        if (!this.isHighFrequencyActive) {
            this.updateTelemetryDisplay();
        }
    }

    estimateFrameRate() {
        // Try to estimate frame rate from video metadata
        // This is an approximation since HTML5 video doesn't directly expose frame rate
        if (this.video.videoWidth && this.video.videoHeight) {
            // Default to 30fps, but this could be enhanced with more sophisticated detection
            this.frameRate = 30;
            
            // Some videos might have different frame rates
            // This is a basic estimation - for more accuracy, you'd need to analyze the video file
            const duration = this.video.duration;
            if (duration > 0) {
                // Keep default frame rate for now
                // In a real application, you might want to use a library like FFmpeg.js
                // to get accurate frame rate information
            }
        }
    }

    updateCurrentTime() {
        const currentTime = this.video.currentTime;
        this.currentTimeSpan.textContent = this.formatTime(currentTime);
    }

    updateDuration() {
        const duration = this.video.duration;
        this.durationSpan.textContent = this.formatTime(duration);
    }

    updateCurrentFrame() {
        const currentTime = this.video.currentTime;
        this.currentFrameNumber = Math.floor(currentTime * this.frameRate);
        this.updateFrameDisplay();
    }

    updateFrameDisplay() {
        this.currentFrameSpan.textContent = this.currentFrameNumber;
    }

    previousFrame() {
        if (this.video.duration) {
            const frameTime = 1 / this.frameRate;
            const newTime = Math.max(0, this.video.currentTime - frameTime);
            this.video.currentTime = newTime;
        }
    }

    nextFrame() {
        if (this.video.duration) {
            const frameTime = 1 / this.frameRate;
            const newTime = Math.min(this.video.duration, this.video.currentTime + frameTime);
            this.video.currentTime = newTime;
        }
    }
    

    handleKeyboard(event) {
        // Only handle keyboard shortcuts when video is loaded
        if (!this.video.duration) return;
        
        switch(event.key) {
            case 'ArrowLeft':
                event.preventDefault();
                this.previousFrame();
                break;
            case 'ArrowRight':
                event.preventDefault();
                this.nextFrame();
                break;
            case ' ':
                event.preventDefault();
                if (this.video.paused) {
                    this.video.play();
                } else {
                    this.video.pause();
                }
                break;
        }
    }

    showVideoSection() {
        this.videoSection.style.display = 'block';
        this.videoSection.classList.add('fade-in');
    }

    hideVideoSection() {
        this.videoSection.style.display = 'none';
    }


    showFileInfo(message, type = 'info') {
        this.fileInfo.innerHTML = message;
        this.fileInfo.className = `file-info ${type}`;
        this.fileInfo.style.display = 'block';
    }

    formatTime(seconds) {
        if (isNaN(seconds)) return '00:00.000';
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        const wholeSeconds = Math.floor(remainingSeconds);
        const milliseconds = Math.round((remainingSeconds - wholeSeconds) * 1000);
        
        return `${minutes.toString().padStart(2, '0')}:${wholeSeconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(3, '0')}`;
    }

    formatSectorTime(seconds) {
        if (isNaN(seconds)) return '0.000';
        
        const wholeSeconds = Math.floor(seconds);
        const milliseconds = Math.round((seconds - wholeSeconds) * 1000);
        
        return `${wholeSeconds}.${milliseconds.toString().padStart(3, '0')}`;
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    handleCsvSelect(event) {
        const file = event.target.files[0];
        
        if (!file) {
            this.csvInfo.style.display = 'none';
            this.csvData = null;
            this.telemetryData = [];
            this.lapTimes = [];
            return;
        }

        // Validate file type
        if (!file.name.toLowerCase().endsWith('.csv')) {
            this.showCsvInfo('Please select a valid CSV file.', 'error');
            return;
        }

        // Read and parse CSV file
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                this.parseCsvData(e.target.result);
                this.showCsvInfo(`
                    <strong>CSV Loaded:</strong> ${file.name}<br>
                    <strong>Laps:</strong> ${this.lapTimes.length}<br>
                    <strong>Data Points:</strong> ${this.telemetryData.length}<br>
                    <strong>Duration:</strong> ${this.formatTime(this.telemetryData[this.telemetryData.length - 1]?.time || 0)}
                `);
                
                // Show lap table immediately after CSV is loaded
                if (this.lapTimes.length > 0) {
                    this.renderLapDataTable();
                }
                
                // Show GPS visualization if GPS data is available
                this.showGpsVisualizationIfAvailable();
                
                // Check if we should show the main content area
                this.checkAndShowMainContent();
            } catch (error) {
                console.error('Error parsing CSV:', error);
                this.showCsvInfo('Error parsing CSV file. Please check the format.', 'error');
            }
        };
        reader.readAsText(file);
    }

    parseCsvData(csvText) {
        const lines = csvText.split('\n');
        let headerIndex = -1;
        let dataStartIndex = -1;
        
        // Find the header line and segment times
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Parse segment times (lap times)
            if (line.startsWith('"Segment Times"')) {
                const timesStr = line.substring(line.indexOf(',') + 1);
                const timeMatches = timesStr.match(/"([^"]+)"/g);
                if (timeMatches) {
                    this.lapTimes = timeMatches.map(match => {
                        const timeStr = match.replace(/"/g, '');
                        return this.parseTimeString(timeStr);
                    });
                }
                continue;
            }
            
            // Find the data header
            if (line.includes('"Time"') && line.includes('"GPS Speed"')) {
                headerIndex = i;
                dataStartIndex = i + 2; // Skip header and units line
                break;
            }
        }
        
        if (headerIndex === -1 || dataStartIndex === -1) {
            throw new Error('Could not find data header in CSV file');
        }
        
        // Parse header to find column indices
        const headerLine = lines[headerIndex];
        const headers = this.parseCsvLine(headerLine);
        const timeIndex = headers.indexOf('Time');
        const speedIndex = headers.indexOf('GPS Speed');
        const latAccIndex = headers.indexOf('GPS LatAcc');
        const lonAccIndex = headers.indexOf('GPS LonAcc');
        const altitudeIndex = headers.indexOf('Altitude');
        const latIndex = headers.indexOf('GPS Latitude');
        const lonIndex = headers.indexOf('GPS Longitude');
        const headingIndex = headers.indexOf('GPS Heading');
        
        if (timeIndex === -1 || speedIndex === -1) {
            throw new Error('Could not find Time or GPS Speed columns');
        }
        
        // Parse data rows
        this.telemetryData = [];
        const maxIndex = Math.max(timeIndex, speedIndex, latAccIndex, lonAccIndex, altitudeIndex, latIndex, lonIndex, headingIndex);
        
        for (let i = dataStartIndex; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const values = this.parseCsvLine(line);
            if (values.length > maxIndex) {
                const time = parseFloat(values[timeIndex]);
                const speed = parseFloat(values[speedIndex]);
                const latAcc = latAccIndex !== -1 ? parseFloat(values[latAccIndex]) : 0;
                const lonAcc = lonAccIndex !== -1 ? parseFloat(values[lonAccIndex]) : 0;
                const altitude = altitudeIndex !== -1 ? parseFloat(values[altitudeIndex]) : 0;
                const lat = latIndex !== -1 ? parseFloat(values[latIndex]) : 0;
                const lon = lonIndex !== -1 ? parseFloat(values[lonIndex]) : 0;
                const heading = headingIndex !== -1 ? parseFloat(values[headingIndex]) : 0;
                
                if (!isNaN(time) && !isNaN(speed)) {
                    this.telemetryData.push({
                        time: time,
                        speed: speed,
                        latAcc: isNaN(latAcc) ? 0 : latAcc,
                        lonAcc: isNaN(lonAcc) ? 0 : lonAcc,
                        altitude: isNaN(altitude) ? 0 : altitude,
                        lat: isNaN(lat) ? 0 : lat,
                        lon: isNaN(lon) ? 0 : lon,
                        heading: isNaN(heading) ? 0 : heading
                    });
                }
            }
        }
        
        this.csvData = { headers, telemetryData: this.telemetryData };
        console.log(`Parsed ${this.telemetryData.length} telemetry data points`);
        console.log(`Found ${this.lapTimes.length} lap times:`, this.lapTimes);
        
        // Calculate cumulative start times for each lap
        this.calculateLapStartTimes();
        
        // Generate sector splits after parsing data
        this.generateSectorSplits();
        
        // Calculate diff to best lap data
        this.calculateDiffToBestLap();
    }

    parseCsvLine(line) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current.trim());
                current = '';
            } else {
                current += char;
            }
        }
        
        result.push(current.trim());
        return result;
    }

    parseTimeString(timeStr) {
        // Parse time strings like "1:03.608" to seconds
        const parts = timeStr.split(':');
        if (parts.length === 2) {
            const minutes = parseInt(parts[0]);
            const seconds = parseFloat(parts[1]);
            return minutes * 60 + seconds;
        }
        return parseFloat(timeStr);
    }

    updateTelemetryDisplay() {
        if (!this.telemetryData.length || this.syncOffset === 0) {
            return;
        }
        
        // Calculate telemetry time based on video time and sync offset
        const telemetryTime = this.video.currentTime - this.syncOffset;
        
        // Find the closest telemetry data point
        let closestIndex = 0;
        let minDiff = Math.abs(this.telemetryData[0].time - telemetryTime);
        
        for (let i = 1; i < this.telemetryData.length; i++) {
            const diff = Math.abs(this.telemetryData[i].time - telemetryTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            } else {
                break; // Data is sorted, so we can break early
            }
        }
        
        // Update telemetry displays
        const data = this.telemetryData[closestIndex];
        this.speedValue.textContent = Math.round(data.speed);
        this.latAccValue.textContent = data.latAcc.toFixed(1);
        this.lonAccValue.textContent = data.lonAcc.toFixed(1);
        this.altitudeValue.textContent = Math.round(data.altitude);
        
        // Update diff to best lap
        const diffValue = this.diffToBestData[closestIndex];
        this.diffValue.textContent = this.formatDiffTime(diffValue);
        
        // Color code the diff value
        if (diffValue !== null && diffValue !== undefined && !isNaN(diffValue)) {
            if (diffValue > 0) {
                // Behind best lap - red
                this.diffValue.style.color = '#ff4d4f';
            } else if (diffValue < 0) {
                // Ahead of best lap - green
                this.diffValue.style.color = '#52c41a';
            } else {
                // Equal to best lap - blue
                this.diffValue.style.color = '#1890ff';
            }
        } else {
            // No data - default color
            this.diffValue.style.color = '#666';
        }
        
        // Update delta bar
        this.updateDeltaBar(diffValue);
        
        // Update speed graph if visible - always update for moving window
        if (this.speedGraphVisible) {
            this.prepareSpeedGraphData();
            this.drawSpeedGraph();
        }
    }

    showCsvInfo(message, type = 'info') {
        this.csvInfo.innerHTML = message;
        this.csvInfo.className = `csv-info ${type}`;
        this.csvInfo.style.display = 'block';
    }

    calculateLapStartTimes() {
        // Calculate cumulative start times for each lap
        this.lapStartTimes = [0]; // Out lap starts at 0
        let cumulativeTime = 0;
        
        for (let i = 0; i < this.lapTimes.length; i++) {
            cumulativeTime += this.lapTimes[i];
            if (i < this.lapTimes.length - 1) { // Don't add start time for the last lap
                this.lapStartTimes.push(cumulativeTime);
            }
        }
        
        console.log('Calculated lap start times:', this.lapStartTimes);
    }

    renderLapDataTable() {
        if (!this.lapTimes.length) return;
        
        // Clear existing table rows
        this.lapTableBody.innerHTML = '';
        
        // Check if we have sector times to display
        const hasSectorTimes = this.lapSectorTimes.length > 0;
        const numSectors = hasSectorTimes ? (this.lapSectorTimes[0] ? this.lapSectorTimes[0].length : 0) : 0;
        
        console.log(`renderLapDataTable: hasSectorTimes=${hasSectorTimes}, numSectors=${numSectors}`);
        
        // Find best sector times and best lap for purple highlighting
        const bestSectorTimes = hasSectorTimes && numSectors > 0 ? this.findBestSectorTimes(numSectors) : [];
        const bestLapIndex = this.findBestLapIndex();
        
        console.log('Best sector times for purple highlighting:', bestSectorTimes);
        console.log('Best lap index for purple highlighting:', bestLapIndex);
        
        // Update table header if we have sector times
        if (hasSectorTimes && numSectors > 0) {
            const headerRow = this.lapTable.querySelector('thead tr');
            if (headerRow) {
                // Remove existing sector headers
                const existingSectorHeaders = headerRow.querySelectorAll('.sector-header');
                existingSectorHeaders.forEach(header => header.remove());
                
                // Find the "Sync Video" column and insert sector headers before it
                const syncHeader = headerRow.querySelector('th:last-child');
                
                for (let i = 0; i < numSectors; i++) {
                    const sectorHeader = document.createElement('th');
                    sectorHeader.className = 'sector-header';
                    sectorHeader.textContent = `S${i + 1}`;
                    sectorHeader.style.backgroundColor = '#f0f0f0';
                    sectorHeader.style.border = '1px solid #ccc';
                    headerRow.insertBefore(sectorHeader, syncHeader);
                }
            }
        }
        
        // Create table rows for each lap
        for (let i = 0; i < this.lapTimes.length; i++) {
            const row = document.createElement('tr');
            
            // Lap number cell
            const lapCell = document.createElement('td');
            lapCell.className = 'lap-number';
            lapCell.textContent = i === 0 ? 'Out Lap' : `Lap ${i}`;
            
            // Lap time cell
            const timeCell = document.createElement('td');
            timeCell.className = 'lap-time';
            timeCell.textContent = this.formatTime(this.lapTimes[i]);
            
            // Highlight best lap time in purple
            if (i === bestLapIndex) {
                timeCell.style.backgroundColor = '#722ed1';
                timeCell.style.color = 'white';
                timeCell.style.fontWeight = 'bold';
                console.log(`Highlighted lap ${i} as best lap time in purple`);
            }
            
            // Actions cell with sync and jump buttons
            const actionsCell = document.createElement('td');
            actionsCell.style.display = 'flex';
            actionsCell.style.gap = '4px';
            actionsCell.style.justifyContent = 'center';
            actionsCell.style.alignItems = 'center';
            
            // Sync button (establish synchronization)
            const syncBtn = document.createElement('button');
            syncBtn.className = 'action-btn sync-btn';
            syncBtn.innerHTML = '🔗'; // Link icon for sync
            syncBtn.title = 'Sync: Set current video time as lap start';
            syncBtn.style.fontSize = '14px';
            syncBtn.style.padding = '4px 6px';
            syncBtn.style.border = '1px solid #d9d9d9';
            syncBtn.style.borderRadius = '4px';
            syncBtn.style.backgroundColor = '#fff';
            syncBtn.style.cursor = 'pointer';
            syncBtn.addEventListener('click', () => this.syncVideoToLapStart(i));
            
            // Jump button (navigate to lap start)
            const jumpBtn = document.createElement('button');
            jumpBtn.className = 'action-btn jump-btn';
            jumpBtn.innerHTML = '⏭️'; // Skip forward icon for jump
            jumpBtn.title = 'Jump: Go to lap start time';
            jumpBtn.style.fontSize = '14px';
            jumpBtn.style.padding = '4px 6px';
            jumpBtn.style.border = '1px solid #d9d9d9';
            jumpBtn.style.borderRadius = '4px';
            jumpBtn.style.backgroundColor = '#fff';
            jumpBtn.style.cursor = 'pointer';
            jumpBtn.addEventListener('click', () => this.jumpToLapStart(i));
            
            actionsCell.appendChild(syncBtn);
            actionsCell.appendChild(jumpBtn);
            
            // Append cells in correct order: Lap, Time, [Sectors], Sync
            row.appendChild(lapCell);
            row.appendChild(timeCell);
            
            // Add sector time cells if we have sector data
            if (hasSectorTimes && numSectors > 0) {
                const sectorTimes = this.lapSectorTimes[i] || [];
                console.log(`Lap ${i} sector times:`, sectorTimes);
                
                for (let j = 0; j < numSectors; j++) {
                    const sectorCell = document.createElement('td');
                    sectorCell.className = 'sector-time';
                    sectorCell.style.border = '1px solid #ccc';
                    sectorCell.style.padding = '4px';
                    sectorCell.style.textAlign = 'center';
                    
                    if (j < sectorTimes.length && sectorTimes[j] !== undefined && sectorTimes[j] !== null) {
                        sectorCell.textContent = this.formatSectorTime(sectorTimes[j]);
                        sectorCell.style.backgroundColor = '#e6f7ff';
                        
                        // Highlight best sector time in purple
                        if (bestSectorTimes[j] !== undefined && 
                            Math.abs(sectorTimes[j] - bestSectorTimes[j]) < 0.001) { // Use small tolerance for floating point comparison
                            sectorCell.style.backgroundColor = '#722ed1';
                            sectorCell.style.color = 'white';
                            sectorCell.style.fontWeight = 'bold';
                            console.log(`Highlighted sector ${j + 1} for lap ${i} as best sector time in purple`);
                        }
                        
                        console.log(`Sector ${j + 1} for lap ${i}: ${this.formatSectorTime(sectorTimes[j])}`);
                    } else {
                        sectorCell.textContent = '--';
                        sectorCell.style.backgroundColor = '#f5f5f5';
                        console.log(`Sector ${j + 1} for lap ${i}: no data`);
                    }
                    
                    row.appendChild(sectorCell);
                }
            }
            
            // Add actions cell as the last column
            row.appendChild(actionsCell);
            
            this.lapTableBody.appendChild(row);
        }
        
        this.lapSelection.style.display = 'block';
        
        console.log(`renderLapDataTable: Created table with ${this.lapTimes.length} laps and ${numSectors} sector columns`);
    }

    syncVideoToLapStart(lapIndex) {
        if (!this.video.duration || !this.lapStartTimes.length) {
            alert('Please load a video file first to sync with the lap data.');
            return;
        }
        
        const lapStartTime = this.lapStartTimes[lapIndex];
        
        // If we already have a sync offset, jump to the corresponding video time
        if (this.syncOffset !== 0) {
            // Calculate the video time that corresponds to this lap start
            const targetVideoTime = lapStartTime + this.syncOffset;
            
            // Clamp to video bounds
            const clampedTime = Math.max(0, Math.min(this.video.duration, targetVideoTime));
            
            // Jump video to the lap start time
            this.video.currentTime = clampedTime;
            
            console.log(`Jumped to ${lapIndex === 0 ? 'Out Lap' : `Lap ${lapIndex}`} start: video time ${this.formatTime(clampedTime)}`);
        } else {
            // No sync established yet - use current video time to establish sync
            const currentVideoTime = this.video.currentTime;
            
            // Calculate sync offset: video time - data time
            this.syncOffset = currentVideoTime - lapStartTime;
            this.selectedLapIndex = lapIndex;
            
            // Create a selected frame object for compatibility with existing sync display
            this.selectedFrame = {
                frameNumber: this.currentFrameNumber,
                timestamp: currentVideoTime,
                formattedTime: this.formatTime(currentVideoTime)
            };
            
            const lapName = lapIndex === 0 ? 'Out Lap' : `Lap ${lapIndex}`;
            console.log(`Synced to ${lapName}: Video ${currentVideoTime}s = Data ${lapStartTime}s (offset: ${this.syncOffset}s)`);
        }
        
        // Show telemetry display now that we're synced (moved outside the if/else)
        this.telemetryDisplay.style.display = 'block';
        
        // Show delta bar if we have diff data
        if (this.diffToBestData.some(d => d !== null)) {
            this.deltaBarContainer.style.display = 'block';
        }
        
        // Show speed graph
        this.showSpeedGraph();
        
        // Update table row selection visual
        const rows = this.lapTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            if (index === lapIndex) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
        
        // Visual feedback on the sync button
        const syncBtn = event.target;
        const originalText = syncBtn.textContent;
        const originalColor = syncBtn.style.backgroundColor;
        
        if (this.syncOffset !== 0) {
            syncBtn.textContent = 'Jumped!';
            syncBtn.style.backgroundColor = '#1890ff';
        } else {
            syncBtn.textContent = 'Synced!';
            syncBtn.style.backgroundColor = '#52c41a';
        }
        
        setTimeout(() => {
            syncBtn.textContent = originalText;
            syncBtn.style.backgroundColor = originalColor;
        }, 2000);
    }

    jumpToLapStart(lapIndex) {
        if (!this.video.duration || !this.lapStartTimes.length) {
            alert('Please load a video file first to jump to lap data.');
            return;
        }
        
        if (this.syncOffset === 0) {
            alert('Please establish synchronization first by clicking the sync button (🔗) next to any lap.');
            return;
        }
        
        const lapStartTime = this.lapStartTimes[lapIndex];
        
        // Calculate the video time that corresponds to this lap start
        const targetVideoTime = lapStartTime + this.syncOffset;
        
        // Clamp to video bounds
        const clampedTime = Math.max(0, Math.min(this.video.duration, targetVideoTime));
        
        // Jump video to the lap start time
        this.video.currentTime = clampedTime;
        
        // Update table row selection visual
        const rows = this.lapTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            if (index === lapIndex) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
        
        // Visual feedback on the jump button
        const jumpBtn = event.target;
        const originalText = jumpBtn.innerHTML;
        const originalColor = jumpBtn.style.backgroundColor;
        
        jumpBtn.innerHTML = '✓';
        jumpBtn.style.backgroundColor = '#1890ff';
        
        setTimeout(() => {
            jumpBtn.innerHTML = originalText;
            jumpBtn.style.backgroundColor = originalColor;
        }, 1000);
        
        console.log(`Jumped to ${lapIndex === 0 ? 'Out Lap' : `Lap ${lapIndex}`} start: video time ${this.formatTime(clampedTime)}`);
    }

    showSpeedGraph() {
        if (!this.speedGraphContainer || !this.speedGraphCanvas || !this.speedGraphCtx) {
            console.log('Speed graph elements not found');
            return;
        }

        if (!this.telemetryData.length) {
            console.log('No telemetry data available for speed graph');
            return;
        }

        // Show the speed graph container
        this.speedGraphContainer.style.display = 'block';
        this.speedGraphVisible = true;

        // Prepare speed data for the current lap or all data
        this.prepareSpeedGraphData();

        // Set up canvas size
        this.setupSpeedGraphCanvas();

        // Draw the initial graph
        this.drawSpeedGraph();

        console.log('Speed graph displayed');
    }

    prepareSpeedGraphData() {
        if (!this.telemetryData.length || this.syncOffset === 0) {
            this.speedGraphData = [];
            this.bestLapSpeedGraphData = [];
            return;
        }

        // Calculate current telemetry time
        const currentTelemetryTime = this.video.currentTime - this.syncOffset;
        
        // Define 20-second window: 10 seconds before and 10 seconds after current time
        const windowSize = 20; // seconds
        const halfWindow = windowSize / 2;
        const windowStartTime = currentTelemetryTime - halfWindow;
        const windowEndTime = currentTelemetryTime + halfWindow;

        // Filter current telemetry data to the 20-second window
        this.speedGraphData = this.telemetryData
            .filter(point => point.time >= windowStartTime && point.time <= windowEndTime)
            .map(point => ({
                time: point.time,
                speed: point.speed
            }));

        // Prepare best lap reference data aligned by GPS position (not time)
        this.bestLapSpeedGraphData = [];
        if (this.bestLapData && this.bestLapData.length > 0 && this.bestLapIndex !== -1 && this.speedGraphData.length > 0) {
            // For each point in the current window, find the corresponding GPS position in the best lap
            this.bestLapSpeedGraphData = this.speedGraphData.map(currentPoint => {
                // Find the current telemetry point with GPS data
                const currentTelemetryPoint = this.telemetryData.find(point => 
                    Math.abs(point.time - currentPoint.time) < 0.1
                );
                
                if (!currentTelemetryPoint || !currentTelemetryPoint.lat || !currentTelemetryPoint.lon) {
                    return null; // No GPS data for this point
                }
                
                // Find the closest GPS position in the best lap data
                const correspondingBestLapPoint = this.findClosestGpsPosition(
                    currentTelemetryPoint, 
                    this.bestLapData
                );
                
                if (correspondingBestLapPoint) {
                    return {
                        time: currentPoint.time, // Use current lap time for x-axis alignment
                        speed: correspondingBestLapPoint.speed
                    };
                }
                
                return null;
            }).filter(point => point !== null); // Remove null entries
        }

        console.log(`Speed graph showing 20s window: ${this.formatTime(windowStartTime)} to ${this.formatTime(windowEndTime)} (${this.speedGraphData.length} current + ${this.bestLapSpeedGraphData.length} reference points)`);

        // Update timeline to show the window duration
        if (this.timelineEnd) {
            this.timelineEnd.textContent = `${windowSize}s`;
        }

        // Update speed range display based on current window data (include both current and reference data)
        if (this.speedGraphRange && (this.speedGraphData.length > 0 || this.bestLapSpeedGraphData.length > 0)) {
            const allSpeeds = [
                ...this.speedGraphData.map(d => d.speed),
                ...this.bestLapSpeedGraphData.map(d => d.speed)
            ];
            const minSpeed = Math.min(...allSpeeds);
            const maxSpeed = Math.max(...allSpeeds);
            const roundedMax = Math.ceil(maxSpeed / 10) * 10; // Round up to nearest 10
            this.speedGraphRange.textContent = `0-${roundedMax} km/h`;
        } else if (this.speedGraphRange) {
            // Fallback when no data in window
            this.speedGraphRange.textContent = `0-200 km/h`;
        }

        // Store current window bounds for other methods
        this.currentWindowStartTime = windowStartTime;
        this.currentWindowEndTime = windowEndTime;
    }

    getCurrentLapIndex() {
        if (!this.video || this.syncOffset === 0 || !this.lapStartTimes.length) {
            return -1;
        }

        const telemetryTime = this.video.currentTime - this.syncOffset;
        
        // Find which lap the current telemetry time falls into
        for (let i = 0; i < this.lapStartTimes.length; i++) {
            const lapStartTime = this.lapStartTimes[i];
            const lapEndTime = i < this.lapStartTimes.length - 1 ? 
                this.lapStartTimes[i + 1] : 
                lapStartTime + this.lapTimes[i];
            
            if (telemetryTime >= lapStartTime && telemetryTime <= lapEndTime) {
                return i;
            }
        }
        
        return -1;
    }

    setupSpeedGraphCanvas() {
        const canvas = this.speedGraphCanvas;
        const rect = canvas.getBoundingClientRect();
        
        // Set canvas size to match CSS size for crisp rendering
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        
        // Scale the context to match device pixel ratio
        this.speedGraphCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
        
        // Set canvas CSS size
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
    }

    drawSpeedGraph() {
        if (!this.speedGraphData.length && !this.bestLapSpeedGraphData.length) return;

        const canvas = this.speedGraphCanvas;
        const ctx = this.speedGraphCtx;
        const width = canvas.width / window.devicePixelRatio;
        const height = canvas.height / window.devicePixelRatio;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Calculate data bounds from both current and reference data
        const allSpeeds = [
            ...this.speedGraphData.map(d => d.speed),
            ...this.bestLapSpeedGraphData.map(d => d.speed)
        ];
        const allTimes = [
            ...this.speedGraphData.map(d => d.time),
            ...this.bestLapSpeedGraphData.map(d => d.time)
        ];

        if (allSpeeds.length === 0 || allTimes.length === 0) return;

        const minSpeed = 0; // Always start from 0
        const maxSpeed = Math.max(...allSpeeds);
        const minTime = Math.min(...allTimes);
        const maxTime = Math.max(...allTimes);

        // Add padding
        const padding = { top: 20, right: 20, bottom: 20, left: 50 };
        const graphWidth = width - padding.left - padding.right;
        const graphHeight = height - padding.top - padding.bottom;

        // Helper functions for coordinate conversion
        const timeToX = (time) => padding.left + ((time - minTime) / (maxTime - minTime)) * graphWidth;
        const speedToY = (speed) => padding.top + ((maxSpeed - speed) / (maxSpeed - minSpeed)) * graphHeight;

        // Draw grid lines
        this.drawSpeedGraphGrid(ctx, padding, graphWidth, graphHeight, minSpeed, maxSpeed, minTime, maxTime);

        // Draw best lap reference line (purple, behind current line)
        if (this.bestLapSpeedGraphData.length > 0) {
            ctx.strokeStyle = '#722ed1'; // Purple color
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 3]); // Dashed line to distinguish from current
            ctx.beginPath();

            for (let i = 0; i < this.bestLapSpeedGraphData.length; i++) {
                const point = this.bestLapSpeedGraphData[i];
                const x = timeToX(point.time);
                const y = speedToY(point.speed);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
            ctx.setLineDash([]); // Reset dash pattern
        }

        // Draw current speed line (blue, on top)
        if (this.speedGraphData.length > 0) {
            ctx.strokeStyle = '#1890ff';
            ctx.lineWidth = 2;
            ctx.beginPath();

            for (let i = 0; i < this.speedGraphData.length; i++) {
                const point = this.speedGraphData[i];
                const x = timeToX(point.time);
                const y = speedToY(point.speed);

                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }

        // Draw current position indicator if video is synced
        if (this.syncOffset !== 0 && this.video) {
            this.drawCurrentPositionIndicator(ctx, timeToX, speedToY, minTime, maxTime);
        }

        // Draw lap markers if we have lap data
        this.drawLapMarkers(ctx, timeToX, padding.top, graphHeight, minTime, maxTime);
    }

    drawSpeedGraphGrid(ctx, padding, graphWidth, graphHeight, minSpeed, maxSpeed, minTime, maxTime) {
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.font = '10px Arial';
        ctx.fillStyle = '#666';

        // Horizontal grid lines (speed)
        const speedStep = Math.ceil((maxSpeed - minSpeed) / 5 / 10) * 10; // Round to nearest 10
        for (let speed = minSpeed; speed <= maxSpeed; speed += speedStep) {
            const y = padding.top + ((maxSpeed - speed) / (maxSpeed - minSpeed)) * graphHeight;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + graphWidth, y);
            ctx.stroke();
            
            // Label
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${speed}`, padding.left - 5, y);
        }

        // Vertical grid lines (time)
        const timeRange = maxTime - minTime;
        const timeStep = timeRange > 300 ? 60 : timeRange > 120 ? 30 : timeRange > 60 ? 15 : 10; // Adaptive time step
        
        for (let time = Math.ceil(minTime / timeStep) * timeStep; time <= maxTime; time += timeStep) {
            const x = padding.left + ((time - minTime) / (maxTime - minTime)) * graphWidth;
            
            // Grid line
            ctx.beginPath();
            ctx.moveTo(x, padding.top);
            ctx.lineTo(x, padding.top + graphHeight);
            ctx.stroke();
            
            // Label
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(this.formatTime(time), x, padding.top + graphHeight + 5);
        }
    }

    drawCurrentPositionIndicator(ctx, timeToX, speedToY, minTime, maxTime) {
        const telemetryTime = this.video.currentTime - this.syncOffset;
        
        console.log(`drawCurrentPositionIndicator: telemetryTime=${telemetryTime}, minTime=${minTime}, maxTime=${maxTime}`);
        
        if (telemetryTime >= minTime && telemetryTime <= maxTime && this.speedGraphData.length > 0) {
            const x = timeToX(telemetryTime);
            
            // Find current speed from the current lap's speed data
            let currentSpeed = 0;
            let closestIndex = 0;
            let minDiff = Math.abs(this.speedGraphData[0].time - telemetryTime);
            
            for (let i = 1; i < this.speedGraphData.length; i++) {
                const diff = Math.abs(this.speedGraphData[i].time - telemetryTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = i;
                } else {
                    break;
                }
            }
            
            currentSpeed = this.speedGraphData[closestIndex].speed;
            const y = speedToY(currentSpeed);
            
            console.log(`Drawing position indicator at x=${x}, y=${y}, speed=${currentSpeed}`);
            
            // Draw vertical line
            ctx.strokeStyle = '#ff4d4f';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.beginPath();
            ctx.moveTo(x, 20);
            ctx.lineTo(x, ctx.canvas.height / window.devicePixelRatio - 20);
            ctx.stroke();
            ctx.setLineDash([]);
            
            // Draw current position dot
            ctx.fillStyle = '#ff4d4f';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.fill();
            
            // Draw white outline for better visibility
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, 2 * Math.PI);
            ctx.stroke();
            
            // Draw speed value
            ctx.font = 'bold 12px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            const text = `${Math.round(currentSpeed)} km/h`;
            const textWidth = ctx.measureText(text).width;
            const textHeight = 16;
            
            // Background
            ctx.fillStyle = '#ff4d4f';
            ctx.fillRect(x - textWidth/2 - 4, y - textHeight/2 - 20, textWidth + 8, textHeight + 4);
            
            // Text
            ctx.fillStyle = '#fff';
            ctx.fillText(text, x, y - 16);
        } else {
            console.log('Position indicator not drawn - conditions not met');
        }
    }

    drawLapMarkers(ctx, timeToX, graphTop, graphHeight, minTime, maxTime) {
        // Draw sector borders that fall within the 20-second moving window
        if (!this.sectorBorders.length) {
            return;
        }

        ctx.strokeStyle = '#ff4d4f';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.font = '12px Arial';
        ctx.fillStyle = '#ff4d4f';

        let sectorsDrawn = 0;
        for (let i = 0; i < this.sectorBorders.length; i++) {
            const border = this.sectorBorders[i];
            const sectorTime = border.time;
            
            // Check if this sector border falls within the current 20-second window
            if (sectorTime >= minTime && sectorTime <= maxTime) {
                const x = timeToX(sectorTime);
                
                // Draw vertical line
                ctx.beginPath();
                ctx.moveTo(x, graphTop);
                ctx.lineTo(x, graphTop + graphHeight);
                ctx.stroke();
                
                // Draw sector label with background
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                const sectorLabel = `S${i + 1}`;
                
                // Draw label background
                ctx.fillStyle = '#ff4d4f';
                ctx.fillRect(x - 15, graphTop + 5, 30, 20);
                
                // Draw label text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(sectorLabel, x, graphTop + 15);
                
                // Reset fill style
                ctx.fillStyle = '#ff4d4f';
                sectorsDrawn++;
            }
        }
        
        ctx.setLineDash([]);
    }

    generateSectorSplits() {
        if (!this.lapTimes.length || !this.telemetryData.length) {
            console.log('Cannot generate sectors: missing lap times or telemetry data');
            return;
        }
        
        // Check if we have GPS data
        const hasGpsData = this.telemetryData.some(point => point.lat !== 0 && point.lon !== 0);
        if (!hasGpsData) {
            console.warn('No GPS data found in telemetry - cannot generate sectors');
            this.showCsvInfo('Warning: No GPS data found in telemetry. Sector splitting requires GPS coordinates (latitude, longitude) in the CSV data.', 'error');
            return;
        }
        
        // Find the best lap (excluding out lap if it exists)
        let bestLapIndex = this.lapTimes.length > 1 ? 1 : 0;
        let bestLapTime = this.lapTimes[bestLapIndex];
        
        for (let i = bestLapIndex + 1; i < this.lapTimes.length; i++) {
            if (this.lapTimes[i] < bestLapTime) {
                bestLapTime = this.lapTimes[i];
                bestLapIndex = i;
            }
        }
        
        console.log(`Using Lap ${bestLapIndex} as reference (${this.formatTime(bestLapTime)})`);
        
        // Get telemetry data for the best lap
        const lapStartTime = this.lapStartTimes[bestLapIndex];
        const lapEndTime = bestLapIndex < this.lapStartTimes.length - 1 ? 
            this.lapStartTimes[bestLapIndex + 1] : 
            lapStartTime + this.lapTimes[bestLapIndex];
        
        console.log(`Lap ${bestLapIndex} time range: ${this.formatTime(lapStartTime)} to ${this.formatTime(lapEndTime)}`);
        
        const lapData = this.telemetryData.filter(point => 
            point.time >= lapStartTime && point.time <= lapEndTime
        );
        
        console.log(`Found ${lapData.length} telemetry points for best lap`);
        
        if (lapData.length === 0) {
            console.warn('No telemetry data found for best lap - cannot generate sectors');
            this.showCsvInfo('Warning: No telemetry data found for the best lap. Cannot generate sector splits.', 'error');
            return;
        }
        
        // Store the end point of the best lap for start/finish line visualization
        this.bestLapEndPoint = lapData[lapData.length - 1];
        console.log(`Stored best lap end point:`, this.bestLapEndPoint);
        
        // Find acceleration periods (straights)
        const accelerationPeriods = this.findAccelerationPeriods(lapData);
        console.log(`Found ${accelerationPeriods.length} acceleration periods:`, accelerationPeriods);
        
        if (accelerationPeriods.length === 0) {
            console.warn('No acceleration periods found - cannot generate sectors');
            this.showCsvInfo('Warning: No suitable acceleration periods found in telemetry data. Cannot generate sector splits. Ensure the data contains sufficient speed variations.', 'error');
            return;
        }
        
        // Generate sector borders
        this.sectorBorders = this.createSectorBorders(lapData, accelerationPeriods);
        console.log(`Generated ${this.sectorBorders.length} sector borders:`, this.sectorBorders);
        
        // Calculate sector times for all laps
        this.calculateAllLapSectorTimes();
        console.log('Calculated sector times for all laps:', this.lapSectorTimes);
        
        // Re-render the lap table to include sector times
        this.renderLapDataTable();
    }


    findAccelerationPeriods(lapData) {
        if (lapData.length < 2) return [];
        
        // Step 1: Find deceleration periods (at least 0.2 seconds long)
        const decelerationPeriods = [];
        let currentDecelPeriod = null;
        
        for (let i = 1; i < lapData.length; i++) {
            const current = lapData[i];
            const previous = lapData[i - 1];
            const timeDiff = current.time - previous.time;
            
            if (timeDiff <= 0) continue;
            
            const acceleration = (current.speed - previous.speed) / timeDiff;
            
            // Start of deceleration period (negative acceleration)
            if (acceleration < -0.5 && !currentDecelPeriod) {
                currentDecelPeriod = {
                    startTime: previous.time,
                    startIndex: i - 1
                };
            }
            
            // End of deceleration period (acceleration becomes positive or neutral)
            if (currentDecelPeriod && acceleration >= -0.5) {
                currentDecelPeriod.endTime = current.time;
                currentDecelPeriod.endIndex = i;
                currentDecelPeriod.duration = currentDecelPeriod.endTime - currentDecelPeriod.startTime;
                
                // Only keep deceleration periods that are at least 1 seconds long
                if (currentDecelPeriod.duration >= 1.0) {
                    decelerationPeriods.push(currentDecelPeriod);
                }
                
                currentDecelPeriod = null;
            }
        }
        
        // Handle case where deceleration continues to end of lap
        if (currentDecelPeriod) {
            const lastPoint = lapData[lapData.length - 1];
            currentDecelPeriod.endTime = lastPoint.time;
            currentDecelPeriod.endIndex = lapData.length - 1;
            currentDecelPeriod.duration = currentDecelPeriod.endTime - currentDecelPeriod.startTime;
            
            if (currentDecelPeriod.duration >= 0.2) {
                decelerationPeriods.push(currentDecelPeriod);
            }
        }
        
        // Step 2: Create sectors between deceleration periods (consecutive periods without deceleration)
        const sectors = [];
        let sectorStartTime = lapData[0].time;
        
        for (const decelPeriod of decelerationPeriods) {
            // Create sector from current start to beginning of deceleration
            const sectorEndTime = decelPeriod.startTime;
            const sectorDuration = sectorEndTime - sectorStartTime;
            
            if (sectorDuration > 0) {
                sectors.push({
                    startTime: sectorStartTime,
                    endTime: sectorEndTime,
                    duration: sectorDuration
                });
            }
            
            // Next sector starts after this deceleration period
            sectorStartTime = decelPeriod.endTime;
        }
        
        // Add final sector from last deceleration to end of lap
        const finalSectorEndTime = lapData[lapData.length - 1].time;
        const finalSectorDuration = finalSectorEndTime - sectorStartTime;
        
        if (finalSectorDuration > 0) {
            sectors.push({
                startTime: sectorStartTime,
                endTime: finalSectorEndTime,
                duration: finalSectorDuration
            });
        }
        
        // Step 3: Merge sectors shorter than 5 seconds
        const mergedSectors = [];
        
        for (let i = 0; i < sectors.length; i++) {
            const sector = sectors[i];
            
            if (sector.duration < 5.0) {
                // If it's the last sector and too short, merge with previous
                if (i === sectors.length - 1 && mergedSectors.length > 0) {
                    const prevSector = mergedSectors[mergedSectors.length - 1];
                    prevSector.endTime = sector.endTime;
                    prevSector.duration = prevSector.endTime - prevSector.startTime;
                }
                // If not the last sector, merge with next sector
                else if (i < sectors.length - 1) {
                    const nextSector = sectors[i + 1];
                    nextSector.startTime = sector.startTime;
                    nextSector.duration = nextSector.endTime - nextSector.startTime;
                    // Skip the current sector (it's merged into next)
                    continue;
                }
                // If it's the only sector or first sector and too short, keep it anyway
                else {
                    mergedSectors.push(sector);
                }
            } else {
                mergedSectors.push(sector);
            }
        }
        
        // Step 4: Convert sectors to acceleration periods (for compatibility with existing code)
        // Each sector represents a period without significant deceleration
        const accelerationPeriods = mergedSectors.map(sector => ({
            startTime: sector.startTime,
            endTime: sector.endTime,
            duration: sector.duration,
            // These fields are for compatibility with existing createSectorBorders code
            maxSpeed: 0, // Will be calculated if needed
            maxSpeedTime: sector.endTime,
            speedIncrease: 0 // Will be calculated if needed
        }));
        
        return accelerationPeriods;
    }

    createSectorBorders(lapData, accelerationPeriods) {
        const borders = [];
        const lapEndTime = lapData[lapData.length - 1].time;
        
        for (let i = 0; i < accelerationPeriods.length; i++) {
            const period = accelerationPeriods[i];
            
            // Place sector border 0.2 seconds before deceleration
            const borderTime = period.endTime - 0.2;
            
            // Skip creating a border if it would result in a very short final sector
            // (less than 2 seconds from lap end)
            const timeToLapEnd = lapEndTime - borderTime;
            if (timeToLapEnd < 2.0) {
                console.log(`Skipping sector border at ${this.formatTime(borderTime)} - would create short final sector (${this.formatTime(timeToLapEnd)})`);
                continue;
            }
            
            // Find the closest telemetry point
            let closestIndex = 0;
            let minDiff = Math.abs(lapData[0].time - borderTime);
            
            for (let j = 1; j < lapData.length; j++) {
                const diff = Math.abs(lapData[j].time - borderTime);
                if (diff < minDiff) {
                    minDiff = diff;
                    closestIndex = j;
                } else {
                    break;
                }
            }
            
            const borderPoint = lapData[closestIndex];
            
            // Create GPS line perpendicular to trajectory
            const border = this.createPerpendicularLine(borderPoint, lapData, closestIndex);
            borders.push(border);
        }
        
        // Sort borders by time
        borders.sort((a, b) => a.time - b.time);
        
        return borders;
    }

    createPerpendicularLine(centerPoint, lapData, centerIndex) {
        // Calculate trajectory direction using nearby points
        const lookAhead = Math.min(5, lapData.length - centerIndex - 1);
        const lookBehind = Math.min(5, centerIndex);
        
        let trajectoryVector = { lat: 0, lon: 0 };
        
        if (lookAhead > 0 && lookBehind > 0) {
            const beforePoint = lapData[centerIndex - lookBehind];
            const afterPoint = lapData[centerIndex + lookAhead];
            
            // Calculate the trajectory direction vector
            trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
            trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
        } else {
            // Fallback: use a smaller window
            if (centerIndex > 0 && centerIndex < lapData.length - 1) {
                const beforePoint = lapData[centerIndex - 1];
                const afterPoint = lapData[centerIndex + 1];
                trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
                trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
            } else {
                // Use GPS heading as last resort
                const headingRad = (centerPoint.heading || 0) * Math.PI / 180;
                trajectoryVector.lat = Math.cos(headingRad);
                trajectoryVector.lon = Math.sin(headingRad);
            }
        }
        
        // Apply cosine latitude correction to longitude component
        // This accounts for longitude convergence without complex projections
        const latRad = centerPoint.lat * Math.PI / 180;
        const cosLat = Math.cos(latRad);
        
        // Adjust longitude component by cosine of latitude
        const correctedTrajectoryVector = {
            lat: trajectoryVector.lat,
            lon: trajectoryVector.lon * cosLat
        };
        
        // Normalize the corrected trajectory vector
        const trajectoryLength = Math.sqrt(
            correctedTrajectoryVector.lat * correctedTrajectoryVector.lat + 
            correctedTrajectoryVector.lon * correctedTrajectoryVector.lon
        );
        
        if (trajectoryLength > 0) {
            correctedTrajectoryVector.lat /= trajectoryLength;
            correctedTrajectoryVector.lon /= trajectoryLength;
        }
        
        // Create perpendicular vector by rotating 90 degrees
        // For a vector (x, y), the perpendicular vector is (-y, x)
        const perpVector = {
            lat: -correctedTrajectoryVector.lon,  // Perpendicular lat component
            lon: correctedTrajectoryVector.lat    // Perpendicular lon component
        };
        
        // Scale the perpendicular vector to desired length (small finite line)
        const lineLength = 0.00004; // Approximately 4m in degrees
        const perpLat = perpVector.lat * lineLength;
        const perpLon = perpVector.lon * lineLength / cosLat; // Undo cosine correction for final coordinates
        
        return {
            time: centerPoint.time,
            centerLat: centerPoint.lat,
            centerLon: centerPoint.lon,
            trajectoryVector: trajectoryVector,
            perpVector: perpVector,
            startLat: centerPoint.lat - perpLat,
            startLon: centerPoint.lon - perpLon,
            endLat: centerPoint.lat + perpLat,
            endLon: centerPoint.lon + perpLon
        };
    }

    calculateAllLapSectorTimes() {
        this.lapSectorTimes = [];
        
        for (let lapIndex = 0; lapIndex < this.lapTimes.length; lapIndex++) {
            const sectorTimes = this.calculateLapSectorTimes(lapIndex);
            this.lapSectorTimes.push(sectorTimes);
        }
    }

    calculateLapSectorTimes(lapIndex) {
        const lapStartTime = this.lapStartTimes[lapIndex];
        const lapEndTime = lapIndex < this.lapStartTimes.length - 1 ? 
            this.lapStartTimes[lapIndex + 1] : 
            lapStartTime + this.lapTimes[lapIndex];
        
        const lapData = this.telemetryData.filter(point => 
            point.time >= lapStartTime && point.time <= lapEndTime
        );
        
        if (lapData.length === 0 || this.sectorBorders.length === 0) {
            return [this.lapTimes[lapIndex]]; // Return full lap time as single sector
        }
        
        const sectorTimes = [];
        let sectorStartTime = lapStartTime;
        
        // Calculate time for each sector
        for (const border of this.sectorBorders) {
            // Find when this lap crosses the sector border
            const crossingTime = this.findBorderCrossing(lapData, border);
            
            if (crossingTime > sectorStartTime) {
                sectorTimes.push(crossingTime - sectorStartTime);
                sectorStartTime = crossingTime;
            }
        }
        
        // Add final sector time
        if (sectorStartTime < lapEndTime) {
            sectorTimes.push(lapEndTime - sectorStartTime);
        }
        
        return sectorTimes;
    }

    findBorderCrossing(lapData, border) {
        // Find where the trajectory actually intersects the sector border line
        // This provides much higher precision than just finding the closest point
        
        let bestCrossingTime = lapData[0].time;
        let minDistance = this.distanceToLineSegment(lapData[0], border);
        let intersectionFound = false;
        
        // Look for actual intersection between consecutive trajectory segments and the border line
        for (let i = 0; i < lapData.length - 1; i++) {
            const point1 = lapData[i];
            const point2 = lapData[i + 1];
            
            // Check if trajectory segment intersects with border line segment
            const intersection = this.lineSegmentIntersection(
                point1.lon, point1.lat,
                point2.lon, point2.lat,
                border.startLon, border.startLat,
                border.endLon, border.endLat
            );
            
            if (intersection && intersection.t !== undefined) {
                // Use the interpolation factor directly from the intersection calculation
                // intersection.t is already the correct interpolation factor (0 = point1, 1 = point2)
                const t = Math.max(0, Math.min(1, intersection.t)); // Clamp to [0,1] for safety
                
                // Interpolate the precise crossing time
                const preciseCrossingTime = point1.time + t * (point2.time - point1.time);
                
                // Validate the result
                if (preciseCrossingTime >= point1.time && preciseCrossingTime <= point2.time) {
                    console.log(`Found precise border crossing at ${this.formatTime(preciseCrossingTime)} (t=${t.toFixed(3)}, between ${this.formatTime(point1.time)} and ${this.formatTime(point2.time)})`);
                    return preciseCrossingTime;
                } else {
                    console.warn(`Invalid interpolated time ${this.formatTime(preciseCrossingTime)}, falling back to closest point`);
                }
            }
        }
        
        // Fallback: if no intersection found, use the closest point method
        console.log('No intersection found, using closest point method');
        for (let i = 0; i < lapData.length; i++) {
            const point = lapData[i];
            const distance = this.distanceToLineSegment(point, border);
            
            if (distance < minDistance) {
                minDistance = distance;
                bestCrossingTime = point.time;
            }
        }
        
        return bestCrossingTime;
    }

    // Calculate distance from point to finite line segment (not infinite line)
    distanceToLineSegment(point, border) {
        const x = point.lon;
        const y = point.lat;
        const x1 = border.startLon;
        const y1 = border.startLat;
        const x2 = border.endLon;
        const y2 = border.endLat;
        
        // Calculate the squared length of the line segment
        const segmentLengthSquared = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
        
        // If the segment has zero length, return distance to the point
        if (segmentLengthSquared === 0) {
            return Math.sqrt((x - x1) * (x - x1) + (y - y1) * (y - y1));
        }
        
        // Calculate the parameter t that represents the projection of the point onto the line segment
        const t = Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / segmentLengthSquared));
        
        // Calculate the closest point on the line segment
        const closestX = x1 + t * (x2 - x1);
        const closestY = y1 + t * (y2 - y1);
        
        // Return the distance from the point to the closest point on the segment
        return Math.sqrt((x - closestX) * (x - closestX) + (y - closestY) * (y - closestY));
    }

    // Helper method to find intersection between two line segments
    lineSegmentIntersection(x1, y1, x2, y2, x3, y3, x4, y4) {
        const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
        
        if (Math.abs(denom) < 1e-10) {
            return null; // Lines are parallel
        }
        
        const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
        const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;
        
        // Check if intersection point lies within both line segments
        if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
            return {
                lon: x1 + t * (x2 - x1),  // x1 is longitude
                lat: y1 + t * (y2 - y1),  // y1 is latitude
                t: t  // Return the interpolation factor for the first segment
            };
        }
        
        return null; // No intersection within segments
    }

    distanceToLine(point, border) {
        // Calculate distance from point to line segment
        const A = border.endLat - border.startLat;
        const B = border.startLon - border.endLon;
        const C = A * border.startLon + B * border.startLat;
        
        const distance = Math.abs(A * point.lon + B * point.lat - C) / Math.sqrt(A * A + B * B);
        return distance;
    }

    createStartFinishBorder(startFinishPoint, mercatorData) {
        // Create a perpendicular line at the start/finish position
        // Use the same logic as createPerpendicularLine but for the start/finish point
        
        // Find the index of the start/finish point in the data
        let centerIndex = 0;
        let minDiff = Math.abs(mercatorData[0].time - startFinishPoint.time);
        
        for (let i = 1; i < mercatorData.length; i++) {
            const diff = Math.abs(mercatorData[i].time - startFinishPoint.time);
            if (diff < minDiff) {
                minDiff = diff;
                centerIndex = i;
            } else {
                break;
            }
        }
        
        // Calculate trajectory direction using nearby points
        const lookAhead = Math.min(5, mercatorData.length - centerIndex - 1);
        const lookBehind = Math.min(5, centerIndex);
        
        let trajectoryVector = { lat: 0, lon: 0 };
        
        if (lookAhead > 0 && lookBehind > 0) {
            const beforePoint = mercatorData[centerIndex - lookBehind];
            const afterPoint = mercatorData[centerIndex + lookAhead];
            
            // Calculate the trajectory direction vector
            trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
            trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
        } else {
            // Fallback: use a smaller window
            if (centerIndex > 0 && centerIndex < mercatorData.length - 1) {
                const beforePoint = mercatorData[centerIndex - 1];
                const afterPoint = mercatorData[centerIndex + 1];
                trajectoryVector.lat = afterPoint.lat - beforePoint.lat;
                trajectoryVector.lon = afterPoint.lon - beforePoint.lon;
            } else {
                // Use GPS heading as last resort
                const headingRad = (startFinishPoint.heading || 0) * Math.PI / 180;
                trajectoryVector.lat = Math.cos(headingRad);
                trajectoryVector.lon = Math.sin(headingRad);
            }
        }
        
        // Apply cosine latitude correction to longitude component
        const latRad = startFinishPoint.lat * Math.PI / 180;
        const cosLat = Math.cos(latRad);
        
        // Adjust longitude component by cosine of latitude
        const correctedTrajectoryVector = {
            lat: trajectoryVector.lat,
            lon: trajectoryVector.lon * cosLat
        };
        
        // Normalize the corrected trajectory vector
        const trajectoryLength = Math.sqrt(
            correctedTrajectoryVector.lat * correctedTrajectoryVector.lat + 
            correctedTrajectoryVector.lon * correctedTrajectoryVector.lon
        );
        
        if (trajectoryLength > 0) {
            correctedTrajectoryVector.lat /= trajectoryLength;
            correctedTrajectoryVector.lon /= trajectoryLength;
        }
        
        // Create perpendicular vector by rotating 90 degrees
        const perpVector = {
            lat: -correctedTrajectoryVector.lon,
            lon: correctedTrajectoryVector.lat
        };
        
        // Scale the perpendicular vector to desired length
        const lineLength = 0.00004; // Approximately 4m in degrees
        const perpLat = perpVector.lat * lineLength;
        const perpLon = perpVector.lon * lineLength / cosLat; // Undo cosine correction for final coordinates
        
        return {
            time: startFinishPoint.time,
            centerLat: startFinishPoint.lat,
            centerLon: startFinishPoint.lon,
            trajectoryVector: trajectoryVector,
            perpVector: perpVector,
            startLat: startFinishPoint.lat - perpLat,
            startLon: startFinishPoint.lon - perpLon,
            endLat: startFinishPoint.lat + perpLat,
            endLon: startFinishPoint.lon + perpLon
        };
    }

    updateLapTableWithSectors() {
        if (!this.lapSectorTimes.length) {
            console.log('No sector times available to display');
            return;
        }
        
        // Determine number of sectors (use first lap's sector count)
        const numSectors = this.lapSectorTimes[0] ? this.lapSectorTimes[0].length : 3;
        console.log(`Updating table with ${numSectors} sectors for ${this.lapSectorTimes.length} laps`);
        
        // Update table header to include sector columns
        const headerRow = this.lapTable.querySelector('thead tr');
        if (headerRow) {
            // Remove existing sector headers
            const existingSectorHeaders = headerRow.querySelectorAll('.sector-header');
            existingSectorHeaders.forEach(header => header.remove());
            
            // Find the "Jump to Start" column and insert sector headers before it
            const jumpHeader = headerRow.querySelector('th:last-child'); // "Jump to Start" column
            
            for (let i = 0; i < numSectors; i++) {
                const sectorHeader = document.createElement('th');
                sectorHeader.className = 'sector-header';
                sectorHeader.textContent = `S${i + 1}`;
                headerRow.insertBefore(sectorHeader, jumpHeader);
            }
        }
        
        // Update each row with sector times
        const rows = this.lapTableBody.querySelectorAll('tr');
        rows.forEach((row, lapIndex) => {
            // Remove existing sector cells
            const existingSectorCells = row.querySelectorAll('.sector-time');
            existingSectorCells.forEach(cell => cell.remove());
            
            // Find the jump button cell and insert sector cells before it
            const jumpCell = row.querySelector('td:last-child'); // Jump button cell
            const sectorTimes = this.lapSectorTimes[lapIndex] || [];
            
            console.log(`Lap ${lapIndex} sector times:`, sectorTimes);
            
            for (let i = 0; i < numSectors; i++) {
                const sectorCell = document.createElement('td');
                sectorCell.className = 'sector-time';
                
                if (i < sectorTimes.length && sectorTimes[i] !== undefined) {
                    sectorCell.textContent = this.formatTime(sectorTimes[i]);
                    console.log(`Sector ${i + 1} for lap ${lapIndex}: ${this.formatTime(sectorTimes[i])}`);
                } else {
                    sectorCell.textContent = '--';
                    console.log(`Sector ${i + 1} for lap ${lapIndex}: no data`);
                }
                
                row.insertBefore(sectorCell, jumpCell);
            }
        });
        
        console.log(`Successfully updated lap table with ${numSectors} sector columns`);
    }

    toggleGpsVisualization() {
        if (!this.telemetryData.length) {
            this.showCsvInfo('No GPS data available for visualization. Please load a CSV file with GPS coordinates.', 'error');
            return;
        }

        // Check if we have GPS data
        const hasGpsData = this.telemetryData.some(point => point.lat !== 0 && point.lon !== 0);
        if (!hasGpsData) {
            this.showCsvInfo('No GPS coordinates found in telemetry data. GPS visualization requires latitude and longitude data.', 'error');
            return;
        }

        this.gpsVisible = !this.gpsVisible;
        
        if (this.gpsVisible) {
            this.gpsSection.style.display = 'block';
            this.toggleGpsBtn.textContent = 'Hide GPS Track';
            this.renderGpsVisualization();
        } else {
            this.gpsSection.style.display = 'none';
            this.toggleGpsBtn.textContent = 'Show GPS Track';
        }
    }

    renderGpsVisualization() {
        const canvas = this.gpsCanvas;
        const ctx = this.gpsCtx;
        const width = canvas.width;
        const height = canvas.height;

        // Clear canvas
        ctx.clearRect(0, 0, width, height);

        // Sample data points (every 5th point to reduce density)
        const sampledData = this.telemetryData.filter((point, index) => 
            index % 5 === 0 && point.lat !== 0 && point.lon !== 0
        );

        if (sampledData.length === 0) {
            ctx.fillStyle = '#666';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('No GPS data to display', width / 2, height / 2);
            return;
        }

        // Convert all GPS points to Mercator coordinates
        const mercatorData = sampledData.map(point => ({
            ...point,
            mercatorX: this.lonToMercatorX(point.lon),
            mercatorY: this.latToMercatorY(point.lat)
        }));

        // Find Mercator bounds
        const bounds = this.calculateMercatorBounds(mercatorData);
        
        // Add padding
        const padding = 0.1; // 10% padding
        const xRange = bounds.maxX - bounds.minX;
        const yRange = bounds.maxY - bounds.minY;
        bounds.minX -= xRange * padding;
        bounds.maxX += xRange * padding;
        bounds.minY -= yRange * padding;
        bounds.maxY += yRange * padding;

        // Convert Mercator coordinates to canvas coordinates
        const mercatorToCanvas = (mercatorX, mercatorY) => {
            const x = ((mercatorX - bounds.minX) / (bounds.maxX - bounds.minX)) * width;
            const y = height - ((mercatorY - bounds.minY) / (bounds.maxY - bounds.minY)) * height;
            return { x, y };
        };

        // Draw satellite/map tiles if enabled
        if (this.currentMapLayer !== 'none') {
            this.drawMapTiles(ctx, bounds, width, height, mercatorToCanvas);
        }

        // Draw track
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 3;
        ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowBlur = 2;
        ctx.beginPath();

        for (let i = 0; i < mercatorData.length; i++) {
            const point = mercatorToCanvas(mercatorData[i].mercatorX, mercatorData[i].mercatorY);
            if (i === 0) {
                ctx.moveTo(point.x, point.y);
            } else {
                ctx.lineTo(point.x, point.y);
            }
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow

        // Draw data points
        ctx.fillStyle = '#1890ff';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        for (const dataPoint of mercatorData) {
            const point = mercatorToCanvas(dataPoint.mercatorX, dataPoint.mercatorY);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
        }

        // Draw sector borders
        if (this.sectorBorders.length > 0) {
            ctx.strokeStyle = '#ff4d4f';
            ctx.lineWidth = 4;
            ctx.shadowColor = 'rgba(255, 255, 255, 0.8)';
            ctx.shadowBlur = 2;
            
            for (let i = 0; i < this.sectorBorders.length; i++) {
                const border = this.sectorBorders[i];
                const startMercatorX = this.lonToMercatorX(border.startLon);
                const startMercatorY = this.latToMercatorY(border.startLat);
                const endMercatorX = this.lonToMercatorX(border.endLon);
                const endMercatorY = this.latToMercatorY(border.endLat);
                
                const startPoint = mercatorToCanvas(startMercatorX, startMercatorY);
                const endPoint = mercatorToCanvas(endMercatorX, endMercatorY);
                
                ctx.beginPath();
                ctx.moveTo(startPoint.x, startPoint.y);
                ctx.lineTo(endPoint.x, endPoint.y);
                ctx.stroke();
                
                // Add sector number label with background
                const midPoint = {
                    x: (startPoint.x + endPoint.x) / 2,
                    y: (startPoint.y + endPoint.y) / 2
                };
                
                // Draw label background
                ctx.fillStyle = 'rgba(255, 77, 79, 0.9)';
                ctx.fillRect(midPoint.x - 15, midPoint.y - 18, 30, 16);
                
                ctx.fillStyle = '#ffffff';
                ctx.font = 'bold 12px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`S${i + 1}`, midPoint.x, midPoint.y - 5);
            }
            
            // Draw start/finish line
            if (mercatorData.length > 0 && this.bestLapEndPoint) {
                const numSectors = this.sectorBorders.length + 1;
                const startFinishBorder = this.createStartFinishBorder(this.bestLapEndPoint, mercatorData);
                
                if (startFinishBorder) {
                    const startMercatorX = this.lonToMercatorX(startFinishBorder.startLon);
                    const startMercatorY = this.latToMercatorY(startFinishBorder.startLat);
                    const endMercatorX = this.lonToMercatorX(startFinishBorder.endLon);
                    const endMercatorY = this.latToMercatorY(startFinishBorder.endLat);
                    
                    const startPoint = mercatorToCanvas(startMercatorX, startMercatorY);
                    const endPoint = mercatorToCanvas(endMercatorX, endMercatorY);
                    
                    ctx.strokeStyle = '#52c41a';
                    ctx.lineWidth = 5;
                    ctx.beginPath();
                    ctx.moveTo(startPoint.x, startPoint.y);
                    ctx.lineTo(endPoint.x, endPoint.y);
                    ctx.stroke();
                    
                    // Add start/finish label with background
                    const midPoint = {
                        x: (startPoint.x + endPoint.x) / 2,
                        y: (startPoint.y + endPoint.y) / 2
                    };
                    
                    ctx.fillStyle = 'rgba(82, 196, 26, 0.9)';
                    ctx.fillRect(midPoint.x - 25, midPoint.y - 18, 50, 16);
                    
                    ctx.fillStyle = '#ffffff';
                    ctx.font = 'bold 12px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Start/S${numSectors}`, midPoint.x, midPoint.y - 5);
                }
            }
            ctx.shadowBlur = 0; // Reset shadow
        }

        // Draw coordinate info
        ctx.fillStyle = '#666';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        const originalBounds = this.calculateGpsBounds(sampledData);
        ctx.fillText(`Lat: ${originalBounds.minLat.toFixed(6)} to ${originalBounds.maxLat.toFixed(6)}`, 10, height - 25);
        ctx.fillText(`Lon: ${originalBounds.minLon.toFixed(6)} to ${originalBounds.maxLon.toFixed(6)}`, 10, height - 10);

        // Draw data info
        ctx.textAlign = 'right';
        ctx.fillText(`${sampledData.length} points (sampled from ${this.telemetryData.length})`, width - 10, height - 25);
        ctx.fillText(`${this.sectorBorders.length} sector borders (${this.currentMapLayer} layer)`, width - 10, height - 10);
    }

    // Web Mercator projection functions
    lonToMercatorX(lon) {
        return lon * Math.PI / 180;
    }

    latToMercatorY(lat) {
        const latRad = lat * Math.PI / 180;
        return Math.log(Math.tan(Math.PI / 4 + latRad / 2));
    }

    mercatorXToLon(mercatorX) {
        return mercatorX * 180 / Math.PI;
    }

    mercatorYToLat(mercatorY) {
        return (2 * Math.atan(Math.exp(mercatorY)) - Math.PI / 2) * 180 / Math.PI;
    }

    calculateMercatorBounds(mercatorData) {
        let minX = mercatorData[0].mercatorX;
        let maxX = mercatorData[0].mercatorX;
        let minY = mercatorData[0].mercatorY;
        let maxY = mercatorData[0].mercatorY;

        for (const point of mercatorData) {
            minX = Math.min(minX, point.mercatorX);
            maxX = Math.max(maxX, point.mercatorX);
            minY = Math.min(minY, point.mercatorY);
            maxY = Math.max(maxY, point.mercatorY);
        }

        return { minX, maxX, minY, maxY };
    }

    calculateGpsBounds(data) {
        let minLat = data[0].lat;
        let maxLat = data[0].lat;
        let minLon = data[0].lon;
        let maxLon = data[0].lon;

        for (const point of data) {
            minLat = Math.min(minLat, point.lat);
            maxLat = Math.max(maxLat, point.lat);
            minLon = Math.min(minLon, point.lon);
            maxLon = Math.max(maxLon, point.lon);
        }

        return { minLat, maxLat, minLon, maxLon };
    }


    showGpsVisualizationIfAvailable() {
        // Check if we have GPS data
        const hasGpsData = this.telemetryData.some(point => point.lat !== 0 && point.lon !== 0);
        
        if (hasGpsData) {
            // Always show GPS section and render visualization immediately
            this.gpsSection.style.display = 'block';
            this.gpsVisible = true;
            this.renderGpsVisualization();
            console.log('GPS data detected - GPS visualization displayed');
        } else {
            // Hide GPS section if no GPS data
            this.gpsSection.style.display = 'none';
            console.log('No GPS data found - GPS visualization not available');
        }
    }

    checkAndShowMainContent() {
        // Show main content area when both CSV and video are loaded
        const hasVideo = this.video && this.video.src;
        const hasCsvData = this.telemetryData && this.telemetryData.length > 0;
        
        if (hasVideo && hasCsvData) {
            this.mainContentArea.style.display = 'flex';
            console.log('Both video and CSV loaded - showing main content area');
        } else {
            console.log(`Main content not ready - Video: ${!!hasVideo}, CSV: ${!!hasCsvData}`);
        }
    }

    findBestSectorTimes(numSectors) {
        const bestSectorTimes = [];
        
        console.log('DEBUG: Finding best sector times for', numSectors, 'sectors');
        console.log('DEBUG: Lap sector times:', this.lapSectorTimes);
        
        for (let sectorIndex = 0; sectorIndex < numSectors; sectorIndex++) {
            let bestTime = Infinity;
            
            for (let lapIndex = 0; lapIndex < this.lapSectorTimes.length; lapIndex++) {
                const sectorTimes = this.lapSectorTimes[lapIndex];
                
                if (sectorTimes && sectorIndex < sectorTimes.length) {
                    const sectorTime = sectorTimes[sectorIndex];
                    
                    if (sectorTime !== undefined && sectorTime !== null && sectorTime < bestTime) {
                        bestTime = sectorTime;
                    }
                }
            }
            
            bestSectorTimes[sectorIndex] = bestTime === Infinity ? undefined : bestTime;
            console.log(`DEBUG: Best time for sector ${sectorIndex + 1}:`, bestSectorTimes[sectorIndex]);
        }
        
        console.log('DEBUG: Final best sector times:', bestSectorTimes);
        return bestSectorTimes;
    }

    findBestLapIndex() {
        if (!this.lapTimes.length) return -1;
        
        console.log('DEBUG: Finding best lap index from lap times:', this.lapTimes);
        
        // Find the best lap time (excluding out lap if it exists)
        let bestLapIndex = this.lapTimes.length > 1 ? 1 : 0; // Skip out lap if we have multiple laps
        let bestLapTime = this.lapTimes[bestLapIndex];
        
        console.log(`DEBUG: Starting with lap ${bestLapIndex} as best (${this.formatTime(bestLapTime)})`);
        
        for (let i = bestLapIndex + 1; i < this.lapTimes.length; i++) {
            if (this.lapTimes[i] < bestLapTime) {
                console.log(`DEBUG: Found better lap ${i} (${this.formatTime(this.lapTimes[i])}) vs current best ${this.formatTime(bestLapTime)}`);
                bestLapTime = this.lapTimes[i];
                bestLapIndex = i;
            }
        }
        
        console.log(`DEBUG: Final best lap index: ${bestLapIndex} with time ${this.formatTime(bestLapTime)}`);
        return bestLapIndex;
    }

    calculateDiffToBestLap() {
        if (!this.lapTimes.length || !this.telemetryData.length) {
            console.log('Cannot calculate diff to best lap: missing lap times or telemetry data');
            return;
        }

        // Find the best lap index
        this.bestLapIndex = this.findBestLapIndex();
        if (this.bestLapIndex === -1) {
            console.log('No best lap found');
            return;
        }

        // Get telemetry data for the best lap
        const bestLapStartTime = this.lapStartTimes[this.bestLapIndex];
        const bestLapEndTime = this.bestLapIndex < this.lapStartTimes.length - 1 ? 
            this.lapStartTimes[this.bestLapIndex + 1] : 
            bestLapStartTime + this.lapTimes[this.bestLapIndex];

        this.bestLapData = this.telemetryData.filter(point => 
            point.time >= bestLapStartTime && point.time <= bestLapEndTime
        );

        console.log(`Best lap ${this.bestLapIndex}: ${this.bestLapData.length} datapoints from ${this.formatTime(bestLapStartTime)} to ${this.formatTime(bestLapEndTime)}`);

        // Initialize diff data array
        this.diffToBestData = new Array(this.telemetryData.length).fill(null);

        // Calculate diff for each lap
        for (let lapIndex = 0; lapIndex < this.lapTimes.length; lapIndex++) {
            if (lapIndex === this.bestLapIndex) {
                // For the best lap itself, diff is always 0
                const lapStartTime = this.lapStartTimes[lapIndex];
                const lapEndTime = lapIndex < this.lapStartTimes.length - 1 ? 
                    this.lapStartTimes[lapIndex + 1] : 
                    lapStartTime + this.lapTimes[lapIndex];

                for (let i = 0; i < this.telemetryData.length; i++) {
                    const point = this.telemetryData[i];
                    if (point.time >= lapStartTime && point.time <= lapEndTime) {
                        this.diffToBestData[i] = 0.0;
                    }
                }
                continue;
            }

            // Calculate diff for this lap
            this.calculateLapDiffToBest(lapIndex);
        }

        console.log(`Calculated diff to best lap for ${this.diffToBestData.filter(d => d !== null).length} datapoints`);
    }

    calculateLapDiffToBest(lapIndex) {
        const lapStartTime = this.lapStartTimes[lapIndex];
        const lapEndTime = lapIndex < this.lapStartTimes.length - 1 ? 
            this.lapStartTimes[lapIndex + 1] : 
            lapStartTime + this.lapTimes[lapIndex];

        const currentLapData = this.telemetryData.filter(point => 
            point.time >= lapStartTime && point.time <= lapEndTime
        );

        if (currentLapData.length === 0 || this.bestLapData.length === 0) {
            console.log(`No data for lap ${lapIndex} or best lap`);
            return;
        }

        // For each datapoint in the current lap, find the corresponding point in the best lap
        for (let i = 0; i < currentLapData.length; i++) {
            const currentPoint = currentLapData[i];
            const currentLapProgress = currentPoint.time - lapStartTime;
            
            // Find the corresponding point in the best lap using GPS trajectory intersection
            const correspondingTime = this.findCorrespondingTimeInBestLap(currentPoint, currentLapProgress);
            
            if (correspondingTime !== null) {
                // Calculate the diff: positive means behind best lap, negative means ahead
                const bestLapStartTime = this.lapStartTimes[this.bestLapIndex];
                const bestLapProgress = correspondingTime - bestLapStartTime;
                const diff = currentLapProgress - bestLapProgress;
                
                // Find the index of this datapoint in the main telemetry array
                const telemetryIndex = this.telemetryData.findIndex(point => 
                    Math.abs(point.time - currentPoint.time) < 0.001
                );
                
                if (telemetryIndex !== -1) {
                    this.diffToBestData[telemetryIndex] = diff;
                }
            }
        }
    }

    findClosestGpsPosition(currentPoint, bestLapData) {
        if (!currentPoint.lat || !currentPoint.lon || !bestLapData.length) {
            return null;
        }

        let closestPoint = null;
        let minDistance = Infinity;

        // Find the point in best lap data with the closest GPS coordinates
        for (const bestLapPoint of bestLapData) {
            if (!bestLapPoint.lat || !bestLapPoint.lon) {
                continue;
            }

            // Calculate distance using Haversine formula for accuracy
            const distance = this.calculateGpsDistance(
                currentPoint.lat, currentPoint.lon,
                bestLapPoint.lat, bestLapPoint.lon
            );

            if (distance < minDistance) {
                minDistance = distance;
                closestPoint = bestLapPoint;
            }
        }

        // Only return if we found a reasonably close point (within 50 meters)
        if (closestPoint && minDistance < 0.05) { // 50 meters in km
            return closestPoint;
        }

        return null;
    }

    calculateGpsDistance(lat1, lon1, lat2, lon2) {
        // Haversine formula to calculate distance between two GPS points
        const R = 6371; // Earth's radius in kilometers
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c; // Distance in kilometers
    }

    findCorrespondingTimeInBestLap(currentPoint, currentLapProgress) {
        if (!currentPoint.lat || !currentPoint.lon || this.bestLapData.length === 0) {
            return null;
        }

        // Create a perpendicular line through the current point
        const currentPointIndex = this.bestLapData.findIndex(point => 
            Math.abs(point.time - (this.lapStartTimes[this.bestLapIndex] + currentLapProgress)) < 1.0
        );
        
        if (currentPointIndex === -1) {
            return null;
        }

        // Use the same method as sector border crossing to find the intersection
        const perpendicularLine = this.createPerpendicularLine(currentPoint, this.bestLapData, 
            Math.min(currentPointIndex, this.bestLapData.length - 1));
        
        // Find where the best lap trajectory crosses this perpendicular line
        const crossingTime = this.findBorderCrossing(this.bestLapData, perpendicularLine);
        
        return crossingTime;
    }

    formatDiffTime(seconds) {
        if (seconds === null || seconds === undefined || isNaN(seconds)) {
            return '+0.000';
        }
        
        const sign = seconds >= 0 ? '+' : '';
        const absSeconds = Math.abs(seconds);
        
        if (absSeconds >= 1) {
            // For diffs >= 1 second, show as seconds with 3 decimal places
            return `${sign}${absSeconds.toFixed(3)}`;
        } else {
            // For diffs < 1 second, show as milliseconds with 3 decimal places
            return `${sign}${absSeconds.toFixed(3)}`;
        }
    }

    updateDeltaBar(diffValue) {
        if (!this.deltaBarFill || !this.deltaBarText) {
            return;
        }

        // Update the text display
        this.deltaBarText.textContent = this.formatDiffTime(diffValue);

        // Handle null/undefined/NaN values
        if (diffValue === null || diffValue === undefined || isNaN(diffValue)) {
            // No data - show empty bar
            this.deltaBarFill.style.width = '0%';
            this.deltaBarFill.style.left = '50%';
            this.deltaBarFill.style.background = '#666';
            return;
        }

        // Clamp diff value to range [-2, 2] seconds
        const maxDiff = 2.0;
        const clampedDiff = Math.max(-maxDiff, Math.min(maxDiff, diffValue));
        
        // Calculate bar properties using logarithmic scale
        // We want: 0.5s -> 50% of bar, 2.0s -> 100% of bar
        // Using formula: barPercent = log(1 + abs(diff) * scaleFactor) / log(1 + maxDiff * scaleFactor)
        // Where scaleFactor is chosen so that 0.5s gives us 0.5 (50%)
        
        const absDiff = Math.abs(clampedDiff);
        if (absDiff === 0) {
            // Equal to best lap - thin blue bar at center
            this.deltaBarFill.style.left = '49%';
            this.deltaBarFill.style.width = '2%';
            this.deltaBarFill.style.background = '#1890ff';
            return;
        }
        
        // Calculate scale factor so that 0.5s maps to 50% of the bar
        // We want: log(1 + 0.5 * scaleFactor) / log(1 + 2.0 * scaleFactor) = 0.5
        // Solving: log(1 + 0.5 * scaleFactor) = 0.5 * log(1 + 2.0 * scaleFactor)
        // This gives us scaleFactor ≈ 3.0
        const scaleFactor = 3.0;
        
        const logPercent = Math.log(1 + absDiff * scaleFactor) / Math.log(1 + maxDiff * scaleFactor);
        const barWidth = logPercent * 50; // 0% to 50% of total width
        
        if (clampedDiff < 0) {
            // Ahead of best lap (good) - green bar extending right from center
            this.deltaBarFill.style.left = '50%';
            this.deltaBarFill.style.width = `${barWidth}%`;
            this.deltaBarFill.style.background = '#52c41a';
        } else if (clampedDiff > 0) {
            // Behind best lap (bad) - red bar extending left from center
            this.deltaBarFill.style.left = `${50 - barWidth}%`;
            this.deltaBarFill.style.width = `${barWidth}%`;
            this.deltaBarFill.style.background = '#ff4d4f';
        }
    }

    // Handle layer selection change
    handleLayerChange(event) {
        this.currentMapLayer = event.target.value;
        console.log(`Map layer changed to: ${this.currentMapLayer}`);
        
        // Clear tile cache when switching layers
        this.tileCache.clear();
        this.loadingTiles.clear();
        
        // Re-render GPS visualization with new layer
        if (this.gpsVisible) {
            this.renderGpsVisualization();
        }
    }

    // Refresh GPS visualization
    refreshGpsVisualization() {
        if (!this.gpsVisible) {
            this.showGpsVisualizationIfAvailable();
        } else {
            // Clear cache and re-render
            this.tileCache.clear();
            this.loadingTiles.clear();
            this.renderGpsVisualization();
        }
    }

    // Draw map tiles as background
    drawMapTiles(ctx, bounds, width, height, mercatorToCanvas) {
        // Calculate appropriate zoom level based on the view
        const latRange = this.mercatorYToLat(bounds.maxY) - this.mercatorYToLat(bounds.minY);
        const lonRange = this.mercatorXToLon(bounds.maxX) - this.mercatorXToLon(bounds.minX);
        
        // For racing tracks, we want high detail, so use a more aggressive zoom calculation
        // Calculate zoom based on the smaller dimension to ensure good detail
        const minRange = Math.min(latRange, lonRange);
        
        // Improved zoom calculation for racing tracks
        // This formula gives higher zoom levels for smaller areas
        let zoom;
        if (minRange > 0.1) {
            // Very large area - use lower zoom
            zoom = Math.floor(Math.log2(360 / minRange)) - 2;
        } else if (minRange > 0.01) {
            // Medium area - use medium-high zoom
            zoom = Math.floor(Math.log2(360 / minRange)) + 1;
        } else {
            // Small area (typical racing track) - use high zoom for detail
            zoom = Math.floor(Math.log2(360 / minRange)) + 3;
        }
        
        // For racing tracks, prefer higher zoom levels (15-18) for sharp detail
        const clampedZoom = Math.max(14, Math.min(18, zoom)); // Minimum zoom 14 for racing tracks
        
        console.log(`GPS bounds - Lat range: ${latRange.toFixed(6)}, Lon range: ${lonRange.toFixed(6)}`);
        console.log(`Calculated zoom: ${zoom}, Using zoom level: ${clampedZoom}`);
        
        // Get tile URLs for the current layer
        const tileUrls = this.getTileUrls(this.currentMapLayer);
        if (!tileUrls.length) {
            console.warn(`No tile URLs available for layer: ${this.currentMapLayer}`);
            return;
        }
        
        // Calculate tile bounds
        const tileBounds = this.calculateTileBounds(bounds, clampedZoom);
        console.log(`Tile bounds at zoom ${clampedZoom}:`, tileBounds);
        
        // Draw tiles
        for (let x = tileBounds.minX; x <= tileBounds.maxX; x++) {
            for (let y = tileBounds.minY; y <= tileBounds.maxY; y++) {
                this.drawTile(ctx, x, y, clampedZoom, bounds, width, height, mercatorToCanvas, tileUrls);
            }
        }
    }

    // Get tile URLs for different map layers
    getTileUrls(layer) {
        const tileUrls = {
            satellite: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
                'https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}' // Google Satellite as fallback
            ],
            osm: [
                // Higher quality OSM alternatives
                'https://a.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png', // OSM France - often higher quality
                'https://tile-a.openstreetmap.fr/hot/{z}/{x}/{y}.png', // Humanitarian OSM - good quality
                'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png', // Standard OSM with 'a' subdomain
                'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png', // Standard OSM with 'b' subdomain
                'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'  // Standard OSM with 'c' subdomain
            ],
            terrain: [
                'https://server.arcgisonline.com/ArcGIS/rest/services/World_Terrain_Base/MapServer/tile/{z}/{y}/{x}',
                'https://tile.opentopomap.org/{z}/{x}/{y}.png' // OpenTopoMap as fallback
            ]
        };
        
        return tileUrls[layer] || [];
    }

    // Calculate which tiles we need to cover the bounds
    calculateTileBounds(bounds, zoom) {
        const tileSize = 256;
        const n = Math.pow(2, zoom);
        
        // Convert mercator bounds to tile coordinates
        const minTileX = Math.floor((this.mercatorXToLon(bounds.minX) + 180) / 360 * n);
        const maxTileX = Math.floor((this.mercatorXToLon(bounds.maxX) + 180) / 360 * n);
        
        const minLat = this.mercatorYToLat(bounds.minY);
        const maxLat = this.mercatorYToLat(bounds.maxY);
        
        const minTileY = Math.floor((1 - Math.log(Math.tan(maxLat * Math.PI / 180) + 1 / Math.cos(maxLat * Math.PI / 180)) / Math.PI) / 2 * n);
        const maxTileY = Math.floor((1 - Math.log(Math.tan(minLat * Math.PI / 180) + 1 / Math.cos(minLat * Math.PI / 180)) / Math.PI) / 2 * n);
        
        return {
            minX: Math.max(0, minTileX),
            maxX: Math.min(n - 1, maxTileX),
            minY: Math.max(0, minTileY),
            maxY: Math.min(n - 1, maxTileY)
        };
    }

    // Draw a single tile
    drawTile(ctx, tileX, tileY, zoom, bounds, width, height, mercatorToCanvas, tileUrls) {
        const tileKey = `${this.currentMapLayer}_${zoom}_${tileX}_${tileY}`;
        
        // Check if tile is already cached
        if (this.tileCache.has(tileKey)) {
            const img = this.tileCache.get(tileKey);
            if (img.complete && img.naturalWidth > 0) {
                this.renderTileToCanvas(ctx, img, tileX, tileY, zoom, bounds, width, height, mercatorToCanvas);
                return;
            }
        }
        
        // Check if tile is already being loaded
        if (this.loadingTiles.has(tileKey)) {
            return;
        }
        
        // Load tile
        this.loadingTiles.add(tileKey);
        
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        img.onload = () => {
            this.tileCache.set(tileKey, img);
            this.loadingTiles.delete(tileKey);
            
            // Re-render the visualization to show the loaded tile
            if (this.gpsVisible) {
                this.renderGpsVisualization();
            }
        };
        
        img.onerror = () => {
            this.loadingTiles.delete(tileKey);
            console.warn(`Failed to load tile: ${tileKey}`);
        };
        
        // Try each URL until one works
        let urlIndex = 0;
        const tryNextUrl = () => {
            if (urlIndex < tileUrls.length) {
                const url = tileUrls[urlIndex]
                    .replace('{z}', zoom)
                    .replace('{x}', tileX)
                    .replace('{y}', tileY);
                
                img.src = url;
                urlIndex++;
            }
        };
        
        img.onerror = () => {
            tryNextUrl();
        };
        
        tryNextUrl();
    }

    // Render a loaded tile to the canvas
    renderTileToCanvas(ctx, img, tileX, tileY, zoom, bounds, width, height, mercatorToCanvas) {
        const n = Math.pow(2, zoom);
        
        // Calculate tile bounds in mercator coordinates
        const tileLonMin = (tileX / n) * 360 - 180;
        const tileLonMax = ((tileX + 1) / n) * 360 - 180;
        
        const tileLatMax = Math.atan(Math.sinh(Math.PI * (1 - 2 * tileY / n))) * 180 / Math.PI;
        const tileLatMin = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tileY + 1) / n))) * 180 / Math.PI;
        
        const tileMercatorMinX = this.lonToMercatorX(tileLonMin);
        const tileMercatorMaxX = this.lonToMercatorX(tileLonMax);
        const tileMercatorMinY = this.latToMercatorY(tileLatMin);
        const tileMercatorMaxY = this.latToMercatorY(tileLatMax);
        
        // Convert to canvas coordinates
        const topLeft = mercatorToCanvas(tileMercatorMinX, tileMercatorMaxY);
        const bottomRight = mercatorToCanvas(tileMercatorMaxX, tileMercatorMinY);
        
        const tileWidth = bottomRight.x - topLeft.x;
        const tileHeight = bottomRight.y - topLeft.y;
        
        // Draw the tile with reduced opacity so track is still visible
        ctx.globalAlpha = 0.7;
        ctx.drawImage(img, topLeft.x, topLeft.y, tileWidth, tileHeight);
        ctx.globalAlpha = 1.0;
    }

    // High-frequency update methods for smoother telemetry
    startHighFrequencyUpdates() {
        if (this.isHighFrequencyActive) return;
        
        this.isHighFrequencyActive = true;
        this.lastUpdateTime = performance.now();
        this.highFrequencyUpdate();
        
        console.log('Started high-frequency telemetry updates (60 FPS)');
    }

    stopHighFrequencyUpdates() {
        if (!this.isHighFrequencyActive) return;
        
        this.isHighFrequencyActive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        
        console.log('Stopped high-frequency telemetry updates');
    }

    highFrequencyUpdate() {
        if (!this.isHighFrequencyActive) return;
        
        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;
        
        // Update at target interval (60 FPS = ~16.67ms)
        if (deltaTime >= this.updateInterval) {
            this.updateTelemetryDisplay();
            this.lastUpdateTime = currentTime;
        }
        
        // Schedule next update
        this.animationFrameId = requestAnimationFrame(() => this.highFrequencyUpdate());
    }

    handleSeeking() {
        // Temporarily stop high-frequency updates during seeking for performance
        if (this.isHighFrequencyActive) {
            this.stopHighFrequencyUpdates();
            this.wasHighFrequencyActiveBeforeSeeking = true;
        }
    }

    handleSeeked() {
        // Resume high-frequency updates after seeking if video is playing
        if (this.wasHighFrequencyActiveBeforeSeeking && !this.video.paused) {
            this.startHighFrequencyUpdates();
        }
        this.wasHighFrequencyActiveBeforeSeeking = false;
        
        // Force immediate telemetry update after seeking
        this.updateTelemetryDisplay();
    }
}

// Initialize the application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new VideoFrameAnalyzer();
    
    // Add some helpful instructions
    console.log('Video Frame Analyzer loaded!');
    console.log('Keyboard shortcuts:');
    console.log('- Arrow Left/Right: Navigate frames');
    console.log('- Spacebar: Play/Pause');
    console.log('- Enter: Select current frame');
});
