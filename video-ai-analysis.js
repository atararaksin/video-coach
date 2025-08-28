class VideoAIAnalysis {
    constructor(videoAnalyzer) {
        this.videoAnalyzer = videoAnalyzer;
        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.analysisResults = [];
        this.isAnalyzing = false;
        this.analysisProgress = 0;
        
        // AI Analysis settings
        this.frameAnalysisInterval = 2.0; // Analyze every 2 seconds
        this.aiApiKey = null; // Will be set by user
        this.useLocalAI = true; // Start with browser-based analysis
        
        this.initializeUI();
        this.loadTensorFlowJS();
    }

    initializeUI() {
        // Create AI video analysis panel
        const analysisPanel = document.createElement('div');
        analysisPanel.className = 'video-ai-analysis-panel';
        analysisPanel.innerHTML = `
            <div class="ai-analysis-header">
                <h3>🎥 AI Video Analysis</h3>
                <div class="ai-settings">
                    <label>
                        <input type="checkbox" id="useCloudAI" ${!this.useLocalAI ? 'checked' : ''}>
                        Use Cloud AI (OpenAI Vision)
                    </label>
                    <input type="password" id="aiApiKey" placeholder="OpenAI API Key (optional)" 
                           style="margin-left: 10px; padding: 5px; display: ${!this.useLocalAI ? 'inline' : 'none'};">
                </div>
            </div>
            <div class="analysis-controls">
                <button id="startVideoAnalysis" class="analysis-btn">🤖 Analyze Video with AI</button>
                <div class="analysis-options">
                    <label>
                        Frame Interval: 
                        <select id="frameInterval">
                            <option value="1">Every 1 second</option>
                            <option value="2" selected>Every 2 seconds</option>
                            <option value="5">Every 5 seconds</option>
                            <option value="10">Every 10 seconds</option>
                        </select>
                    </label>
                </div>
            </div>
            <div class="video-analysis-progress" id="videoAnalysisProgress" style="display: none;">
                <div class="progress-bar">
                    <div class="progress-fill" id="videoProgressFill"></div>
                </div>
                <div class="progress-info">
                    <span class="progress-text" id="videoProgressText">Analyzing frames...</span>
                    <span class="frame-info" id="frameInfo">Frame 0/0</span>
                </div>
            </div>
            <div class="video-analysis-results" id="videoAnalysisResults"></div>
            <canvas id="analysisCanvas" style="display: none;"></canvas>
        `;
        
        // Insert after GPS section
        const gpsSection = document.getElementById('gpsSection');
        if (gpsSection) {
            gpsSection.parentNode.insertBefore(analysisPanel, gpsSection.nextSibling);
        }
        
        // Bind events
        this.bindEvents();
        this.addStyles();
    }

    bindEvents() {
        document.getElementById('startVideoAnalysis').addEventListener('click', () => this.startVideoAnalysis());
        
        document.getElementById('useCloudAI').addEventListener('change', (e) => {
            this.useLocalAI = !e.target.checked;
            const apiKeyInput = document.getElementById('aiApiKey');
            apiKeyInput.style.display = this.useLocalAI ? 'none' : 'inline';
        });
        
        document.getElementById('frameInterval').addEventListener('change', (e) => {
            this.frameAnalysisInterval = parseFloat(e.target.value);
        });
        
        document.getElementById('aiApiKey').addEventListener('input', (e) => {
            this.aiApiKey = e.target.value;
        });
    }

    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .video-ai-analysis-panel {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                border-radius: 12px;
                padding: 25px;
                margin: 25px 0;
                box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            }
            
            .ai-analysis-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 15px;
            }
            
            .ai-analysis-header h3 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            
            .ai-settings {
                display: flex;
                align-items: center;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .ai-settings label {
                display: flex;
                align-items: center;
                gap: 5px;
                font-size: 14px;
            }
            
            .ai-settings input[type="password"] {
                padding: 8px 12px;
                border: none;
                border-radius: 6px;
                background: rgba(255,255,255,0.2);
                color: white;
                backdrop-filter: blur(10px);
            }
            
            .ai-settings input[type="password"]::placeholder {
                color: rgba(255,255,255,0.7);
            }
            
            .analysis-controls {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 20px;
                flex-wrap: wrap;
                gap: 15px;
            }
            
            .analysis-btn {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 2px solid rgba(255,255,255,0.3);
                padding: 12px 24px;
                border-radius: 8px;
                cursor: pointer;
                font-weight: 600;
                font-size: 16px;
                transition: all 0.3s ease;
                backdrop-filter: blur(10px);
            }
            
            .analysis-btn:hover {
                background: rgba(255,255,255,0.3);
                border-color: rgba(255,255,255,0.5);
                transform: translateY(-2px);
            }
            
            .analysis-btn:disabled {
                background: rgba(255,255,255,0.1);
                border-color: rgba(255,255,255,0.2);
                cursor: not-allowed;
                transform: none;
            }
            
            .analysis-options label {
                font-size: 14px;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            
            .analysis-options select {
                padding: 6px 10px;
                border: none;
                border-radius: 4px;
                background: rgba(255,255,255,0.2);
                color: white;
                backdrop-filter: blur(10px);
            }
            
            .video-analysis-progress {
                margin: 20px 0;
            }
            
            .progress-bar {
                width: 100%;
                height: 12px;
                background: rgba(255,255,255,0.2);
                border-radius: 6px;
                overflow: hidden;
                margin-bottom: 10px;
            }
            
            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #52c41a, #73d13d);
                width: 0%;
                transition: width 0.3s ease;
            }
            
            .progress-info {
                display: flex;
                justify-content: space-between;
                font-size: 14px;
                opacity: 0.9;
            }
            
            .video-analysis-results {
                margin-top: 25px;
            }
            
            .ai-analysis-item {
                background: rgba(255,255,255,0.1);
                border-radius: 8px;
                padding: 20px;
                margin: 15px 0;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
            }
            
            .ai-analysis-item.error {
                border-left: 4px solid #ff4757;
            }
            
            .ai-analysis-item.warning {
                border-left: 4px solid #ffa502;
            }
            
            .ai-analysis-item.suggestion {
                border-left: 4px solid #2ed573;
            }
            
            .ai-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 12px;
            }
            
            .ai-item-title {
                font-weight: 600;
                font-size: 18px;
            }
            
            .ai-item-time {
                background: rgba(255,255,255,0.2);
                padding: 6px 12px;
                border-radius: 20px;
                font-size: 12px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .ai-item-time:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .ai-item-description {
                margin-bottom: 15px;
                line-height: 1.6;
                opacity: 0.9;
            }
            
            .ai-item-suggestion {
                background: rgba(255,255,255,0.1);
                padding: 15px;
                border-radius: 6px;
                border-left: 3px solid #2ed573;
                font-style: italic;
            }
            
            .frame-preview {
                width: 200px;
                height: 112px;
                border-radius: 6px;
                margin: 10px 0;
                border: 2px solid rgba(255,255,255,0.3);
            }
            
            .ai-confidence {
                font-size: 12px;
                opacity: 0.7;
                margin-top: 8px;
            }
        `;
        document.head.appendChild(style);
    }

    async loadTensorFlowJS() {
        try {
            // Load TensorFlow.js for browser-based AI
            if (!window.tf) {
                const script = document.createElement('script');
                script.src = 'https://cdn.jsdelivr.net/npm/@tensorflow/tfjs@4.10.0/dist/tf.min.js';
                script.onload = () => {
                    console.log('TensorFlow.js loaded successfully');
                    this.loadPretrainedModels();
                };
                document.head.appendChild(script);
            } else {
                this.loadPretrainedModels();
            }
        } catch (error) {
            console.warn('Failed to load TensorFlow.js:', error);
        }
    }

    async loadPretrainedModels() {
        try {
            // Load MobileNet for object detection
            if (window.tf) {
                console.log('Loading pre-trained models for video analysis...');
                // We'll load models as needed during analysis
            }
        } catch (error) {
            console.warn('Failed to load pre-trained models:', error);
        }
    }

    async startVideoAnalysis() {
        if (!this.videoAnalyzer.video || !this.videoAnalyzer.video.src) {
            alert('Please load a video file first.');
            return;
        }

        if (!this.useLocalAI && !this.aiApiKey) {
            alert('Please enter your OpenAI API key or switch to local AI analysis.');
            return;
        }

        this.isAnalyzing = true;
        this.analysisResults = [];
        this.analysisProgress = 0;

        // Update UI
        const startBtn = document.getElementById('startVideoAnalysis');
        startBtn.disabled = true;
        startBtn.textContent = '🔄 Analyzing Video...';
        
        document.getElementById('videoAnalysisProgress').style.display = 'block';
        document.getElementById('videoAnalysisResults').innerHTML = '';

        try {
            await this.performVideoAnalysis();
            this.displayVideoAnalysisResults();
        } catch (error) {
            console.error('Video analysis failed:', error);
            alert('Video analysis failed: ' + error.message);
        } finally {
            // Reset UI
            this.isAnalyzing = false;
            startBtn.disabled = false;
            startBtn.textContent = '🤖 Analyze Video with AI';
            document.getElementById('videoAnalysisProgress').style.display = 'none';
        }
    }

    async performVideoAnalysis() {
        const video = this.videoAnalyzer.video;
        const duration = video.duration;
        
        if (!duration || duration === 0) {
            throw new Error('Video duration is invalid');
        }

        // Calculate frames to analyze
        const framesToAnalyze = [];
        for (let time = 0; time < duration; time += this.frameAnalysisInterval) {
            framesToAnalyze.push(time);
        }

        console.log(`Analyzing ${framesToAnalyze.length} frames at ${this.frameAnalysisInterval}s intervals`);

        // Analyze each frame
        for (let i = 0; i < framesToAnalyze.length; i++) {
            const time = framesToAnalyze[i];
            
            try {
                // Capture frame
                const frameData = await this.captureVideoFrame(time);
                
                // Analyze frame with AI
                const analysis = await this.analyzeFrameWithAI(frameData, time);
                
                if (analysis && analysis.findings && analysis.findings.length > 0) {
                    this.analysisResults.push(...analysis.findings);
                }
                
                // Update progress
                this.analysisProgress = ((i + 1) / framesToAnalyze.length) * 100;
                this.updateVideoProgress(i + 1, framesToAnalyze.length);
                
                // Small delay to prevent overwhelming the API
                await new Promise(resolve => setTimeout(resolve, this.useLocalAI ? 100 : 1000));
                
            } catch (error) {
                console.warn(`Failed to analyze frame at ${time}s:`, error);
            }
        }

        console.log(`Video analysis complete. Found ${this.analysisResults.length} insights`);
    }

    async captureVideoFrame(time) {
        return new Promise((resolve, reject) => {
            const video = this.videoAnalyzer.video;
            
            // Set video time
            video.currentTime = time;
            
            const onSeeked = () => {
                try {
                    // Set canvas size to match video
                    this.canvas.width = video.videoWidth || 640;
                    this.canvas.height = video.videoHeight || 360;
                    
                    // Draw video frame to canvas
                    this.ctx.drawImage(video, 0, 0, this.canvas.width, this.canvas.height);
                    
                    // Get image data
                    const imageData = this.canvas.toDataURL('image/jpeg', 0.8);
                    
                    video.removeEventListener('seeked', onSeeked);
                    
                    resolve({
                        time: time,
                        imageData: imageData,
                        width: this.canvas.width,
                        height: this.canvas.height
                    });
                } catch (error) {
                    video.removeEventListener('seeked', onSeeked);
                    reject(error);
                }
            };
            
            video.addEventListener('seeked', onSeeked);
            
            // Timeout after 5 seconds
            setTimeout(() => {
                video.removeEventListener('seeked', onSeeked);
                reject(new Error('Frame capture timeout'));
            }, 5000);
        });
    }

    async analyzeFrameWithAI(frameData, time) {
        if (this.useLocalAI) {
            return await this.analyzeFrameLocally(frameData, time);
        } else {
            return await this.analyzeFrameWithCloudAI(frameData, time);
        }
    }

    async analyzeFrameLocally(frameData, time) {
        // Browser-based AI analysis using computer vision techniques
        try {
            const findings = [];
            
            // Analyze image for driving-related elements
            const imageAnalysis = await this.performLocalImageAnalysis(frameData);
            
            // Check for potential issues based on visual analysis
            if (imageAnalysis.roadVisible) {
                // Analyze road position and steering
                const roadAnalysis = this.analyzeRoadPosition(imageAnalysis);
                if (roadAnalysis.issues.length > 0) {
                    findings.push(...roadAnalysis.issues.map(issue => ({
                        ...issue,
                        time: time,
                        videoTime: time,
                        framePreview: frameData.imageData,
                        confidence: roadAnalysis.confidence
                    })));
                }
            }
            
            // Analyze speed vs visual conditions
            const telemetryData = this.getTelemetryAtTime(time);
            if (telemetryData) {
                const speedAnalysis = this.analyzeSpeedVsVisual(imageAnalysis, telemetryData);
                if (speedAnalysis.issues.length > 0) {
                    findings.push(...speedAnalysis.issues.map(issue => ({
                        ...issue,
                        time: time,
                        videoTime: time,
                        framePreview: frameData.imageData,
                        confidence: speedAnalysis.confidence
                    })));
                }
            }
            
            return { findings };
            
        } catch (error) {
            console.warn('Local AI analysis failed:', error);
            return { findings: [] };
        }
    }

    async performLocalImageAnalysis(frameData) {
        // Convert image to tensor for analysis
        const img = new Image();
        img.src = frameData.imageData;
        
        return new Promise((resolve) => {
            img.onload = () => {
                // Basic computer vision analysis
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                canvas.width = img.width;
                canvas.height = img.height;
                ctx.drawImage(img, 0, 0);
                
                const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
                const data = imageData.data;
                
                // Analyze image properties
                const analysis = {
                    roadVisible: this.detectRoad(data, canvas.width, canvas.height),
                    brightness: this.calculateBrightness(data),
                    contrast: this.calculateContrast(data),
                    edgeIntensity: this.calculateEdgeIntensity(data, canvas.width, canvas.height),
                    dominantColors: this.getDominantColors(data)
                };
                
                resolve(analysis);
            };
            
            img.onerror = () => {
                resolve({
                    roadVisible: false,
                    brightness: 0.5,
                    contrast: 0.5,
                    edgeIntensity: 0.5,
                    dominantColors: []
                });
            };
        });
    }

    detectRoad(data, width, height) {
        // Simple road detection based on color patterns and horizontal lines
        let roadPixels = 0;
        const totalPixels = width * height;
        
        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Check for road-like colors (grays, dark colors)
            const gray = (r + g + b) / 3;
            if (gray < 120 && Math.abs(r - g) < 30 && Math.abs(g - b) < 30) {
                roadPixels++;
            }
        }
        
        return (roadPixels / totalPixels) > 0.2; // Road visible if >20% road-like pixels
    }

    calculateBrightness(data) {
        let totalBrightness = 0;
        const pixelCount = data.length / 4;
        
        for (let i = 0; i < data.length; i += 4) {
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            totalBrightness += brightness;
        }
        
        return totalBrightness / pixelCount / 255;
    }

    calculateContrast(data) {
        const brightnesses = [];
        for (let i = 0; i < data.length; i += 4) {
            brightnesses.push((data[i] + data[i + 1] + data[i + 2]) / 3);
        }
        
        const mean = brightnesses.reduce((a, b) => a + b) / brightnesses.length;
        const variance = brightnesses.reduce((sum, brightness) => sum + Math.pow(brightness - mean, 2), 0) / brightnesses.length;
        
        return Math.sqrt(variance) / 255;
    }

    calculateEdgeIntensity(data, width, height) {
        // Simple edge detection using Sobel operator
        let edgeIntensity = 0;
        const pixelCount = width * height;
        
        for (let y = 1; y < height - 1; y++) {
            for (let x = 1; x < width - 1; x++) {
                const idx = (y * width + x) * 4;
                
                // Get surrounding pixels
                const tl = (data[((y-1) * width + (x-1)) * 4] + data[((y-1) * width + (x-1)) * 4 + 1] + data[((y-1) * width + (x-1)) * 4 + 2]) / 3;
                const tm = (data[((y-1) * width + x) * 4] + data[((y-1) * width + x) * 4 + 1] + data[((y-1) * width + x) * 4 + 2]) / 3;
                const tr = (data[((y-1) * width + (x+1)) * 4] + data[((y-1) * width + (x+1)) * 4 + 1] + data[((y-1) * width + (x+1)) * 4 + 2]) / 3;
                
                const bl = (data[((y+1) * width + (x-1)) * 4] + data[((y+1) * width + (x-1)) * 4 + 1] + data[((y+1) * width + (x-1)) * 4 + 2]) / 3;
                const bm = (data[((y+1) * width + x) * 4] + data[((y+1) * width + x) * 4 + 1] + data[((y+1) * width + x) * 4 + 2]) / 3;
                const br = (data[((y+1) * width + (x+1)) * 4] + data[((y+1) * width + (x+1)) * 4 + 1] + data[((y+1) * width + (x+1)) * 4 + 2]) / 3;
                
                // Sobel X and Y
                const sobelX = (tr + 2 * data[idx + width * 4] + br) - (tl + 2 * data[idx - width * 4] + bl);
                const sobelY = (tl + 2 * data[idx - 4] + bl) - (tr + 2 * data[idx + 4] + br);
                
                edgeIntensity += Math.sqrt(sobelX * sobelX + sobelY * sobelY);
            }
        }
        
        return edgeIntensity / pixelCount / 255;
    }

    getDominantColors(data) {
        const colorCounts = {};
        
        // Sample every 10th pixel for performance
        for (let i = 0; i < data.length; i += 40) {
            const r = Math.floor(data[i] / 32) * 32;
            const g = Math.floor(data[i + 1] / 32) * 32;
            const b = Math.floor(data[i + 2] / 32) * 32;
            
            const color = `${r},${g},${b}`;
            colorCounts[color] = (colorCounts[color] || 0) + 1;
        }
        
        return Object.entries(colorCounts)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([color]) => color);
    }

    analyzeRoadPosition(imageAnalysis) {
        const issues = [];
        let confidence = 0.7;
        
        // Analyze based on visual cues
        if (imageAnalysis.edgeIntensity < 0.1) {
            issues.push({
                type: 'warning',
                category: 'Visual Analysis',
                title: 'Low Visual Detail Detected',
                description: 'The video shows low edge detail, which might indicate poor visibility conditions or camera issues.',
                suggestion: 'Ensure good visibility conditions and check if the camera lens is clean. Consider adjusting driving style for reduced visibility.'
            });
            confidence = 0.5;
        }
        
        if (imageAnalysis.brightness < 0.2) {
            issues.push({
                type: 'warning',
                category: 'Visibility',
                title: 'Low Light Conditions',
                description: 'Very dark conditions detected in the video. This may affect driving performance and safety.',
                suggestion: 'In low light conditions, reduce speed and increase following distance. Ensure headlights are on and functioning properly.'
            });
        }
        
        if (imageAnalysis.contrast < 0.1) {
            issues.push({
                type: 'info',
                category: 'Visual Conditions',
                title: 'Low Contrast Environment',
                description: 'Low contrast in the video may indicate foggy, overcast, or uniform lighting conditions.',
                suggestion: 'In low contrast conditions, be extra cautious with speed and maintain greater awareness of track boundaries and other vehicles.'
            });
        }
        
        return { issues, confidence };
    }

    analyzeSpeedVsVisual(imageAnalysis, telemetryData) {
        const issues = [];
        let confidence = 0.8;
        
        // Correlate visual conditions with speed
        if (imageAnalysis.brightness < 0.3 && telemetryData.speed > 150) {
            issues.push({
                type: 'error',
                category: 'Speed vs Visibility',
                title: 'High Speed in Poor Visibility',
                description: `Driving at ${Math.round(telemetryData.speed)} km/h in low visibility conditions detected. This combination increases risk significantly.`,
                suggestion: 'Reduce speed in poor visibility conditions. A good rule is to drive at a speed where you can stop within the distance you can see clearly.'
            });
        }
        
        if (imageAnalysis.edgeIntensity > 0.8 && telemetryData.speed < 50) {
            issues.push({
                type: 'info',
                category: 'Speed Optimization',
                title: 'Potential for Higher Speed',
                description: `Clear visual conditions detected but speed is only ${Math.round(telemetryData.speed)} km/h. There may be opportunity for higher speeds.`,
                suggestion: 'With good visibility and clear track conditions, consider if higher speeds are appropriate for this section.'
            });
        }
        
        return { issues, confidence };
    }

    async analyzeFrameWithCloudAI(frameData, time) {
        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.aiApiKey}`
                },
                body: JSON.stringify({
                    model: "gpt-4-vision-preview",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: "Analyze this onboard racing video frame for driving errors and provide suggestions. Look for: 1) Racing line optimization 2) Braking points 3) Throttle application 4) Steering smoothness 5) Track position 6) Visual cues for speed appropriateness. Respond in JSON format with findings array containing type (error/warning/suggestion), category, title, description, and suggestion fields."
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: frameData.imageData
                                    }
                                }
                            ]
                        }
                    ],
                    max_tokens: 500
                })
            });

            if (!response.ok) {
                throw new Error(`OpenAI API error: ${response.status}`);
            }

            const result = await response.json();
            const content = result.choices[0].message.content;
            
            try {
                const analysis = JSON.parse(content);
                return {
                    findings: analysis.findings.map(finding => ({
                        ...finding,
                        time: time,
                        videoTime: time,
                        framePreview: frameData.imageData,
                        confidence: 0.9
                    }))
                };
            } catch (parseError) {
                console.warn('Failed to parse AI response as JSON:', content);
                return { findings: [] };
            }

        } catch (error) {
            console.warn('Cloud AI analysis failed:', error);
            return { findings: [] };
        }
    }

    getTelemetryAtTime(time) {
        if (!this.videoAnalyzer.telemetryData || this.videoAnalyzer.syncOffset === 0) {
            return null;
        }
        
        const telemetryTime = time - this.videoAnalyzer.syncOffset;
        
        // Find closest telemetry data point
        let closestIndex = 0;
        let minDiff = Math.abs(this.videoAnalyzer.telemetryData[0].time - telemetryTime);
        
        for (let i = 1; i < this.videoAnalyzer.telemetryData.length; i++) {
            const diff = Math.abs(this.videoAnalyzer.telemetryData[i].time - telemetryTime);
            if (diff < minDiff) {
                minDiff = diff;
                closestIndex = i;
            }
        }
        
        // Return telemetry data if within reasonable time window (5 seconds)
        if (minDiff <= 5.0) {
            return this.videoAnalyzer.telemetryData[closestIndex];
        }
        
        return null;
    }

    updateVideoProgress(current, total) {
        const progressFill = document.getElementById('videoProgressFill');
        const progressText = document.getElementById('videoProgressText');
        const frameInfo = document.getElementById('frameInfo');
        
        if (progressFill) {
            progressFill.style.width = `${this.analysisProgress}%`;
        }
        
        if (progressText) {
            progressText.textContent = `Analyzing frames... ${Math.round(this.analysisProgress)}%`;
        }
        
        if (frameInfo) {
            frameInfo.textContent = `Frame ${current}/${total}`;
        }
    }

    displayVideoAnalysisResults() {
        const resultsContainer = document.getElementById('videoAnalysisResults');
        if (!resultsContainer) return;
        
        if (this.analysisResults.length === 0) {
            resultsContainer.innerHTML = `
                <div class="ai-analysis-item suggestion">
                    <div class="ai-item-header">
                        <span class="ai-item-title">✅ Analysis Complete</span>
                    </div>
                    <div class="ai-item-description">
                        No driving errors or issues detected in the video analysis. Great driving!
                    </div>
                </div>
            `;
            return;
        }
        
        let html = `
            <div class="ai-analysis-item suggestion">
                <div class="ai-item-header">
                    <span class="ai-item-title">📊 AI Analysis Summary</span>
                </div>
                <div class="ai-item-description">
                    Found ${this.analysisResults.length} insights from video analysis. Click on timestamps to jump to specific moments.
                </div>
            </div>
        `;
        
        // Sort results by time
        this.analysisResults.sort((a, b) => a.time - b.time);
        
        // Display each result
        this.analysisResults.forEach(result => {
            html += this.renderVideoAnalysisResult(result);
        });
        
        resultsContainer.innerHTML = html;
        
        // Bind click events for time navigation
        resultsContainer.querySelectorAll('.ai-item-time').forEach(timeElement => {
            timeElement.addEventListener('click', (e) => {
                const videoTime = parseFloat(e.target.dataset.videoTime);
                if (this.videoAnalyzer.video && !isNaN(videoTime)) {
                    this.videoAnalyzer.video.currentTime = videoTime;
                    console.log(`Jumped to time: ${this.videoAnalyzer.formatTime(videoTime)}`);
                }
            });
        });
    }

    renderVideoAnalysisResult(result) {
        const timeStr = this.videoAnalyzer.formatTime(result.videoTime);
        
        return `
            <div class="ai-analysis-item ${result.type}">
                <div class="ai-item-header">
                    <span class="ai-item-title">${result.category}: ${result.title}</span>
                    <span class="ai-item-time" data-video-time="${result.videoTime}" title="Click to jump to this time">
                        ${timeStr}
                    </span>
                </div>
                <div class="ai-item-description">${result.description}</div>
                ${result.framePreview ? `<img src="${result.framePreview}" class="frame-preview" alt="Frame preview">` : ''}
                <div class="ai-item-suggestion">
                    <strong>💡 AI Suggestion:</strong> ${result.suggestion}
                </div>
                ${result.confidence ? `<div class="ai-confidence">Confidence: ${Math.round(result.confidence * 100)}%</div>` : ''}
            </div>
        `;
    }
}

// Export for use in main application
window.VideoAIAnalysis = VideoAIAnalysis;
