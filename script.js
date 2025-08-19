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
        
        if (timeIndex === -1 || speedIndex === -1) {
            throw new Error('Could not find Time or GPS Speed columns');
        }
        
        // Parse data rows
        this.telemetryData = [];
        const maxIndex = Math.max(timeIndex, speedIndex, latAccIndex, lonAccIndex, altitudeIndex);
        
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
                
                if (!isNaN(time) && !isNaN(speed)) {
                    this.telemetryData.push({
                        time: time,
                        speed: speed,
                        latAcc: isNaN(latAcc) ? 0 : latAcc,
                        lonAcc: isNaN(lonAcc) ? 0 : lonAcc,
                        altitude: isNaN(altitude) ? 0 : altitude
                    });
                }
            }
        }
        
        this.csvData = { headers, telemetryData: this.telemetryData };
        console.log(`Parsed ${this.telemetryData.length} telemetry data points`);
        console.log(`Found ${this.lapTimes.length} lap times:`, this.lapTimes);
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

    showLapSelection() {
        if (!this.lapTimes.length) return;
        
        // Calculate cumulative start times for each lap
        this.lapStartTimes = [0]; // Out lap starts at 0
        let cumulativeTime = 0;
        
        for (let i = 0; i < this.lapTimes.length; i++) {
            cumulativeTime += this.lapTimes[i];
            if (i < this.lapTimes.length - 1) { // Don't add start time for the last lap
                this.lapStartTimes.push(cumulativeTime);
            }
        }
        
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
            
            // Start time cell
            const startCell = document.createElement('td');
            startCell.className = 'start-time';
            startCell.textContent = this.formatTime(this.lapStartTimes[i]);
            
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
            row.appendChild(startCell);
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
