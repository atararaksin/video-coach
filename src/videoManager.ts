import { LapData } from './types.js';

export class VideoManager {
    private videos: Map<string, HTMLVideoElement> = new Map(); // sessionId -> video element
    private studio: any;
    private isVideoSeeking: Map<string, boolean> = new Map(); // sessionId -> seeking state
    private isVideoSynced: Map<string, boolean> = new Map(); // sessionId -> sync state
    private onTimeUpdateCallback: ((time: number, source: 'video' | 'ui', sessionId: string) => void) | null = null;
    private animationFrameId: number | null = null;
    private lastUpdateTime: number = 0;

    constructor(studio: any) {
        this.studio = studio;
        this.startSmoothUpdates();
    }

    setTimeUpdateCallback(callback: (time: number, source: 'video' | 'ui', sessionId: string) => void): void {
        this.onTimeUpdateCallback = callback;
    }


    loadVideo(sessionId: string): void {
        const fileInput = document.getElementById(`video-file-${sessionId}`) as HTMLInputElement;
        fileInput.click();
        
        fileInput.onchange = (event: Event) => {
            const target = event.target as HTMLInputElement;
            if (target.files && target.files.length > 0) {
                this.handleVideoFile(sessionId, target.files[0]);
            }
        };
    }

    private handleVideoFile(sessionId: string, file: File): void {
        const video = document.getElementById(`video-${sessionId}`) as HTMLVideoElement;
        const placeholder = document.getElementById(`video-placeholder-${sessionId}`);
        const syncBtn = document.querySelector(`button[onclick="syncVideo('${sessionId}')"]`) as HTMLButtonElement;
        
        if (!video || !placeholder || !syncBtn) return;

        // Create object URL for the video file
        const videoUrl = URL.createObjectURL(file);
        video.src = videoUrl;
        
        // Show video, hide placeholder
        video.style.display = 'block';
        placeholder.style.display = 'none';
        syncBtn.disabled = false;
        
        // Set up video event listeners
        this.setupVideoEventListeners(sessionId, video);
        
        // Store video reference
        this.videos.set(sessionId, video);
        this.isVideoSeeking.set(sessionId, false);
    }

    private setupVideoEventListeners(sessionId: string, video: HTMLVideoElement): void {
        video.addEventListener('timeupdate', () => {
            // Only sync UI with video if video is synced and not seeking
            if (!this.isVideoSeeking.get(sessionId) && 
                this.isVideoSynced.get(sessionId) && 
                this.onTimeUpdateCallback) {
                // Convert video time to session time using the session-specific sync offset
                const syncOffset = this.studio.videoSyncOffsets.get(sessionId) || 0;
                const sessionTime = video.currentTime + syncOffset;
                this.onTimeUpdateCallback(sessionTime, 'video', sessionId);
            }
        });

        video.addEventListener('seeking', () => {
            this.isVideoSeeking.set(sessionId, true);
        });

        video.addEventListener('seeked', () => {
            this.isVideoSeeking.set(sessionId, false);
            // Only sync UI with video if video is synced
            if (this.isVideoSynced.get(sessionId) && this.onTimeUpdateCallback) {
                const syncOffset = this.studio.videoSyncOffsets.get(sessionId) || 0;
                const sessionTime = video.currentTime + syncOffset;
                this.onTimeUpdateCallback(sessionTime, 'video', sessionId);
            }
        });
    }

    syncVideo(sessionId: string): void {
        const video = this.videos.get(sessionId);
        const syncControls = document.getElementById(`sync-controls-${sessionId}`);
        const lapSelect = document.getElementById(`lap-select-${sessionId}`) as HTMLSelectElement;
        
        if (!video || !syncControls || !lapSelect) return;

        // Pause the video
        video.pause();
        
        // Populate lap options
        this.populateLapOptions(sessionId, lapSelect);
        
        // Show sync controls
        syncControls.style.display = 'block';
    }

    private populateLapOptions(sessionId: string, lapSelect: HTMLSelectElement): void {
        const session = this.studio.sessions.get(sessionId);
        if (!session) return;

        // Clear existing options
        lapSelect.innerHTML = '';
        
        // Add options for complete laps (excluding first and last incomplete laps)
        const completeLaps = session.laps.slice(1, -1);
        completeLaps.forEach((lap: LapData) => {
            const option = document.createElement('option');
            option.value = lap.lapIndex.toString();
            option.textContent = `Lap ${lap.lapIndex} - ${this.formatTime(lap.lapTime)}`;
            lapSelect.appendChild(option);
        });
    }

    confirmSync(sessionId: string): void {
        const video = this.videos.get(sessionId);
        const lapSelect = document.getElementById(`lap-select-${sessionId}`) as HTMLSelectElement;
        const syncControls = document.getElementById(`sync-controls-${sessionId}`);
        
        if (!video || !lapSelect || !syncControls) return;

        const selectedLapIndex = parseInt(lapSelect.value);
        const session = this.studio.sessions.get(sessionId);
        if (!session) return;

        const selectedLap = session.laps.find((lap: LapData) => lap.lapIndex === selectedLapIndex);
        if (!selectedLap) return;

        // Calculate the sync offset for this specific session
        // Video time at current frame should correspond to the start of the selected lap
        const syncOffset = selectedLap.lapStartTime - video.currentTime;
        this.studio.videoSyncOffsets.set(sessionId, syncOffset);
        
        // Mark video as synced
        this.isVideoSynced.set(sessionId, true);
        
        // Hide sync controls
        syncControls.style.display = 'none';
        
        console.log(`Video synced for session ${sessionId}: Lap ${selectedLapIndex} start (${selectedLap.lapStartTime}s) = Video time ${video.currentTime}s`);
        console.log(`Sync offset: ${syncOffset}s`);
    }

    cancelSync(sessionId: string): void {
        const syncControls = document.getElementById(`sync-controls-${sessionId}`);
        if (syncControls) {
            syncControls.style.display = 'none';
        }
    }

    // Check if video is synced for a session
    isVideoSyncedForSession(sessionId: string): boolean {
        return this.isVideoSynced.get(sessionId) || false;
    }

    // Update video time from external source (graphs, lap selection) for active session
    updateVideoTime(sessionTime: number, activeSessionId: string): void {
        const video = this.videos.get(activeSessionId);
        if (!video || this.isVideoSeeking.get(activeSessionId) || !this.isVideoSynced.get(activeSessionId)) return;

        // Convert session time to video time using the session-specific sync offset
        const syncOffset = this.studio.videoSyncOffsets.get(activeSessionId) || 0;
        const videoTime = sessionTime - syncOffset;
        
        // Only update if the video time is valid and different from current time
        if (videoTime >= 0 && videoTime <= video.duration && 
            Math.abs(video.currentTime - videoTime) > 0.1) {
            this.isVideoSeeking.set(activeSessionId, true);
            video.currentTime = videoTime;
            // isVideoSeeking will be reset in the 'seeked' event listener
        }
    }

    // Remove video when session is closed
    removeVideo(sessionId: string): void {
        const video = this.videos.get(sessionId);
        if (video) {
            // Clean up object URL to prevent memory leaks
            if (video.src) {
                URL.revokeObjectURL(video.src);
            }
            this.videos.delete(sessionId);
            this.isVideoSeeking.delete(sessionId);
        }
    }

    private startSmoothUpdates(): void {
        const updateLoop = () => {
            const now = performance.now();
            
            // Update at 60fps (approximately every 16ms)
            if (now - this.lastUpdateTime >= 16) {
                this.updateSmoothPositions();
                this.lastUpdateTime = now;
            }
            
            this.animationFrameId = requestAnimationFrame(updateLoop);
        };
        
        updateLoop();
    }

    private updateSmoothPositions(): void {
        // Check all videos for smooth position updates
        this.videos.forEach((video, sessionId) => {
            // Only update if video is playing, synced, and not seeking
            // The callback will handle checking if this is the active session
            if (!video.paused && 
                !this.isVideoSeeking.get(sessionId) && 
                this.isVideoSynced.get(sessionId) && 
                this.onTimeUpdateCallback) {
                
                // Convert video time to session time using the session-specific sync offset
                const syncOffset = this.studio.videoSyncOffsets.get(sessionId) || 0;
                const sessionTime = video.currentTime + syncOffset;
                this.onTimeUpdateCallback(sessionTime, 'video', sessionId);
            }
        });
    }

    // Clean up animation frame when needed
    destroy(): void {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
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
