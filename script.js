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
        
        // Control elements
        this.currentTimeSpan = document.getElementById('currentTime');
        this.durationSpan = document.getElementById('duration');
        this.currentFrameSpan = document.getElementById('currentFrame');
        this.prevFrameBtn = document.getElementById('prevFrame');
        this.nextFrameBtn = document.getElementById('nextFrame');
        this.selectFrameBtn = document.getElementById('selectFrame');
        
        // Selected frame info elements
        this.selectedFrameInfo = document.getElementById('selectedFrameInfo');
        this.selectedFrameNumber = document.getElementById('selectedFrameNumber');
        this.selectedFrameTime = document.getElementById('selectedFrameTime');
        this.syncInfo = document.getElementById('syncInfo');
        this.syncDetails = document.getElementById('syncDetails');
        this.syncInstructions = document.getElementById('syncInstructions');
        
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
        
        // GPS visualization elements
        this.gpsSection = document.getElementById('gpsSection');
        this.gpsCanvas = document.getElementById('gpsCanvas');
        this.gpsCtx = this.gpsCanvas.getContext('2d');
        this.toggleGpsBtn = document.getElementById('toggleGpsView');
        this.gpsVisible = false;
    }

    bindEvents() {
        // File input change events
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.csvInput.addEventListener('change', (e) => this.handleCsvSelect(e));
        
        // Video events
        this.video.addEventListener('loadedmetadata', () => this.handleVideoLoaded());
        this.video.addEventListener('timeupdate', () => this.handleTimeUpdate());
        this.video.addEventListener('loadeddata', () => this.estimateFrameRate());
        
        // Frame control events
        this.prevFrameBtn.addEventListener('click', () => this.previousFrame());
        this.nextFrameBtn.addEventListener('click', () => this.nextFrame());
        this.selectFrameBtn.addEventListener('click', () => this.selectCurrentFrame());
        
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.handleKeyboard(e));
        
        // GPS visualization events
        this.toggleGpsBtn.addEventListener('click', () => this.toggleGpsVisualization());
        
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
    }

    handleVideoLoaded() {
        this.updateDuration();
        this.currentFrameNumber = 0;
        this.updateFrameDisplay();
        
        // Reset selected frame info
        this.selectedFrame = null;
        this.hideSelectedFrameInfo();
    }

    handleTimeUpdate() {
        this.updateCurrentTime();
        this.updateCurrentFrame();
        this.updateTelemetryDisplay();
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

    selectCurrentFrame() {
        if (this.video.duration) {
            this.selectedFrame = {
                frameNumber: this.currentFrameNumber,
                timestamp: this.video.currentTime,
                formattedTime: this.formatTime(this.video.currentTime)
            };
            
            this.showSelectedFrameInfo();
            this.updateSelectedFrameDisplay();
            
            // If we have CSV data, show lap selection table
            if (this.csvData && this.lapTimes.length > 0) {
                this.showLapSelection();
                this.syncInstructions.style.display = 'block';
            }
            
            // Visual feedback
            this.selectFrameBtn.style.background = '#38a169';
            setTimeout(() => {
                this.selectFrameBtn.style.background = '#48bb78';
            }, 200);
        }
    }

    updateSelectedFrameDisplay() {
        if (this.selectedFrame) {
            this.selectedFrameNumber.textContent = this.selectedFrame.frameNumber;
            this.selectedFrameTime.textContent = this.selectedFrame.formattedTime;
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
            case 'Enter':
                event.preventDefault();
                this.selectCurrentFrame();
                break;
        }
    }

    showVideoSection() {
        this.videoSection.style.display = 'block';
        this.videoSection.classList.add('fade-in');
    }

    hideVideoSection() {
        this.videoSection.style.display = 'none';
        this.hideSelectedFrameInfo();
    }

    showSelectedFrameInfo() {
        this.selectedFrameInfo.style.display = 'block';
        this.selectedFrameInfo.classList.add('fade-in');
    }

    hideSelectedFrameInfo() {
        this.selectedFrameInfo.style.display = 'none';
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
                
                // Show GPS visualization button if GPS data is available
                this.showGpsButtonIfAvailable();
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
        if (!this.telemetryData.length || !this.selectedFrame || this.syncOffset === 0) {
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

    showLapSelection() {
        if (!this.lapTimes.length) return;
        
        // Clear existing table rows
        this.lapTableBody.innerHTML = '';
        
        // Create table rows for each lap
        for (let i = 0; i < this.lapTimes.length; i++) {
            const row = document.createElement('tr');
            
            // Radio button cell
            const radioCell = document.createElement('td');
            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'lapSelection';
            radio.value = i;
            radio.className = 'lap-radio';
            radio.addEventListener('change', () => this.handleLapSelection(i));
            radioCell.appendChild(radio);
            
            // Lap number cell
            const lapCell = document.createElement('td');
            lapCell.className = 'lap-number';
            lapCell.textContent = i === 0 ? 'Out Lap' : `Lap ${i}`;
            
            // Lap time cell
            const timeCell = document.createElement('td');
            timeCell.className = 'lap-time';
            timeCell.textContent = this.formatTime(this.lapTimes[i]);
            
            // Jump button cell
            const jumpCell = document.createElement('td');
            const jumpBtn = document.createElement('button');
            jumpBtn.className = 'jump-btn';
            jumpBtn.textContent = 'Jump to Start';
            jumpBtn.addEventListener('click', () => this.jumpToLapStart(i));
            jumpCell.appendChild(jumpBtn);
            
            row.appendChild(radioCell);
            row.appendChild(lapCell);
            row.appendChild(timeCell);
            row.appendChild(jumpCell);
            
            this.lapTableBody.appendChild(row);
        }
        
        this.lapSelection.style.display = 'block';
    }

    handleLapSelection(lapIndex) {
        this.selectedLapIndex = lapIndex;
        
        // Update table row selection visual
        const rows = this.lapTableBody.querySelectorAll('tr');
        rows.forEach((row, index) => {
            if (index === lapIndex) {
                row.classList.add('selected');
            } else {
                row.classList.remove('selected');
            }
        });
        
        // Calculate sync offset
        const lapStartTime = this.lapStartTimes[lapIndex];
        this.syncOffset = this.selectedFrame.timestamp - lapStartTime;
        
        // Update sync info
        const lapName = lapIndex === 0 ? 'Out Lap' : `Lap ${lapIndex}`;
        this.syncDetails.textContent = `Video time ${this.selectedFrame.formattedTime} = ${lapName} start (${this.formatTime(lapStartTime)} in data)`;
        this.syncInfo.style.display = 'block';
        this.syncInstructions.style.display = 'none';
        
        // Show telemetry display now that we're synced
        this.telemetryDisplay.style.display = 'block';
        
        console.log(`Synced to ${lapName}: Video ${this.selectedFrame.timestamp}s = Data ${lapStartTime}s (offset: ${this.syncOffset}s)`);
    }

    jumpToLapStart(lapIndex) {
        if (!this.video.duration || !this.lapStartTimes.length) return;
        
        // Calculate the video time for the lap start
        const lapStartTime = this.lapStartTimes[lapIndex];
        let videoTime;
        
        if (this.syncOffset !== 0) {
            // If we have a sync offset, use it to calculate video time
            videoTime = lapStartTime + this.syncOffset;
        } else {
            // If no sync is established, assume direct mapping
            videoTime = lapStartTime;
        }
        
        // Ensure the time is within video bounds
        videoTime = Math.max(0, Math.min(videoTime, this.video.duration));
        
        // Jump to the calculated time
        this.video.currentTime = videoTime;
        
        // Pause the video to allow precise positioning
        this.video.pause();
        
        // Visual feedback
        const jumpBtn = event.target;
        const originalText = jumpBtn.textContent;
        jumpBtn.textContent = 'Jumped!';
        jumpBtn.style.background = '#52c41a';
        
        setTimeout(() => {
            jumpBtn.textContent = originalText;
            jumpBtn.style.background = '#1890ff';
        }, 1000);
        
        // Log for debugging
        const lapName = lapIndex === 0 ? 'Out Lap' : `Lap ${lapIndex}`;
        console.log(`Jumped to ${lapName} start: Video time ${this.formatTime(videoTime)} (Data time: ${this.formatTime(lapStartTime)})`);
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
        
        // Update the lap table to show sector times - FORCE UPDATE
        this.forceUpdateLapTableWithSectors();
    }
    forceUpdateLapTableWithSectors() {
        console.log('FORCE UPDATE: Starting lap table update with sectors');
        
        if (!this.lapSectorTimes.length) {
            console.log('FORCE UPDATE: No sector times available to display');
            return;
        }
        
        // Determine number of sectors (use first lap's sector count)
        const numSectors = this.lapSectorTimes[0] ? this.lapSectorTimes[0].length : 3;
        console.log(`FORCE UPDATE: Updating table with ${numSectors} sectors for ${this.lapSectorTimes.length} laps`);
        
        // Get the table elements
        const headerRow = this.lapTable.querySelector('thead tr');
        const bodyRows = this.lapTableBody.querySelectorAll('tr');
        
        console.log(`FORCE UPDATE: Found header row: ${!!headerRow}, body rows: ${bodyRows.length}`);
        
        if (!headerRow) {
            console.error('FORCE UPDATE: No header row found!');
            return;
        }
        
        // Remove ALL existing sector headers and cells first
        const existingSectorHeaders = headerRow.querySelectorAll('.sector-header');
        console.log(`FORCE UPDATE: Removing ${existingSectorHeaders.length} existing sector headers`);
        existingSectorHeaders.forEach(header => header.remove());
        
        bodyRows.forEach((row, index) => {
            const existingSectorCells = row.querySelectorAll('.sector-time');
            console.log(`FORCE UPDATE: Removing ${existingSectorCells.length} existing sector cells from row ${index}`);
            existingSectorCells.forEach(cell => cell.remove());
        });
        
        // Add sector headers - insert before the last column (Jump to Start)
        const allHeaders = headerRow.querySelectorAll('th');
        const lastHeader = allHeaders[allHeaders.length - 1];
        console.log(`FORCE UPDATE: Inserting ${numSectors} sector headers before last header: ${lastHeader.textContent}`);
        
        for (let i = 0; i < numSectors; i++) {
            const sectorHeader = document.createElement('th');
            sectorHeader.className = 'sector-header';
            sectorHeader.textContent = `S${i + 1}`;
            sectorHeader.style.backgroundColor = '#f0f0f0';
            sectorHeader.style.border = '1px solid #ccc';
            headerRow.insertBefore(sectorHeader, lastHeader);
            console.log(`FORCE UPDATE: Added sector header S${i + 1}`);
        }
        
        // Add sector cells to each row
        bodyRows.forEach((row, lapIndex) => {
            const allCells = row.querySelectorAll('td');
            const lastCell = allCells[allCells.length - 1];
            const sectorTimes = this.lapSectorTimes[lapIndex] || [];
            
            console.log(`FORCE UPDATE: Adding ${numSectors} sector cells to lap ${lapIndex}, sector times:`, sectorTimes);
            
            for (let i = 0; i < numSectors; i++) {
                const sectorCell = document.createElement('td');
                sectorCell.className = 'sector-time';
                sectorCell.style.border = '1px solid #ccc';
                sectorCell.style.padding = '4px';
                sectorCell.style.textAlign = 'center';
                
                if (i < sectorTimes.length && sectorTimes[i] !== undefined && sectorTimes[i] !== null) {
                    sectorCell.textContent = this.formatSectorTime(sectorTimes[i]);
                    sectorCell.style.backgroundColor = '#e6f7ff';
                    console.log(`FORCE UPDATE: Sector ${i + 1} for lap ${lapIndex}: ${this.formatSectorTime(sectorTimes[i])}`);
                } else {
                    sectorCell.textContent = '--';
                    sectorCell.style.backgroundColor = '#f5f5f5';
                    console.log(`FORCE UPDATE: Sector ${i + 1} for lap ${lapIndex}: no data`);
                }
                
                row.insertBefore(sectorCell, lastCell);
            }
        });
        
        console.log(`FORCE UPDATE: Successfully updated lap table with ${numSectors} sector columns`);
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

        // Draw track
        ctx.strokeStyle = '#1890ff';
        ctx.lineWidth = 2;
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

        // Draw data points
        ctx.fillStyle = '#1890ff';
        for (const dataPoint of mercatorData) {
            const point = mercatorToCanvas(dataPoint.mercatorX, dataPoint.mercatorY);
            ctx.beginPath();
            ctx.arc(point.x, point.y, 1.5, 0, 2 * Math.PI);
            ctx.fill();
        }


        // Draw sector borders
        if (this.sectorBorders.length > 0) {
            ctx.strokeStyle = '#ff4d4f';
            ctx.lineWidth = 3;
            
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
                
                // Add sector number label
                const midPoint = {
                    x: (startPoint.x + endPoint.x) / 2,
                    y: (startPoint.y + endPoint.y) / 2
                };
                
                ctx.fillStyle = '#ff4d4f';
                ctx.font = 'bold 14px Arial';
                ctx.textAlign = 'center';
                ctx.fillText(`S${i + 1}`, midPoint.x, midPoint.y - 5);
            }
            
            // Draw start/finish line as the final sector border
            // Use the end point of the reference/best lap, not the first data point
            if (mercatorData.length > 0 && this.bestLapEndPoint) {
                const numSectors = this.sectorBorders.length + 1; // Total sectors = borders + 1
                
                // Create a perpendicular line at the lap end position (start/finish line)
                const startFinishBorder = this.createStartFinishBorder(this.bestLapEndPoint, mercatorData);
                
                if (startFinishBorder) {
                    const startMercatorX = this.lonToMercatorX(startFinishBorder.startLon);
                    const startMercatorY = this.latToMercatorY(startFinishBorder.startLat);
                    const endMercatorX = this.lonToMercatorX(startFinishBorder.endLon);
                    const endMercatorY = this.latToMercatorY(startFinishBorder.endLat);
                    
                    const startPoint = mercatorToCanvas(startMercatorX, startMercatorY);
                    const endPoint = mercatorToCanvas(endMercatorX, endMercatorY);
                    
                    // Draw the start/finish line with a different style (thicker, different color)
                    ctx.strokeStyle = '#52c41a'; // Green color to match start/finish point
                    ctx.lineWidth = 4;
                    ctx.beginPath();
                    ctx.moveTo(startPoint.x, startPoint.y);
                    ctx.lineTo(endPoint.x, endPoint.y);
                    ctx.stroke();
                    
                    // Add start/finish sector label
                    const midPoint = {
                        x: (startPoint.x + endPoint.x) / 2,
                        y: (startPoint.y + endPoint.y) / 2
                    };
                    
                    ctx.fillStyle = '#52c41a';
                    ctx.font = 'bold 14px Arial';
                    ctx.textAlign = 'center';
                    ctx.fillText(`Start/S${numSectors}`, midPoint.x, midPoint.y - 5);
                }
            }
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
        ctx.fillText(`${this.sectorBorders.length} sector borders (Mercator projection)`, width - 10, height - 10);
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


    showGpsButtonIfAvailable() {
        // Check if we have GPS data
        const hasGpsData = this.telemetryData.some(point => point.lat !== 0 && point.lon !== 0);
        
        if (hasGpsData) {
            // Show the GPS section and button
            this.gpsSection.style.display = 'block';
            this.toggleGpsBtn.textContent = 'Show GPS Track';
            this.gpsVisible = false;
            console.log('GPS data detected - GPS visualization available');
        } else {
            // Hide GPS section if no GPS data
            this.gpsSection.style.display = 'none';
            console.log('No GPS data found - GPS visualization not available');
        }
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
