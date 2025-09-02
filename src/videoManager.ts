import { LapData } from './types.js';

export class VideoManager {
    private videos: Map<string, HTMLVideoElement> = new Map(); // sessionId -> video element
    private studio: any;
    private isVideoSeeking: Map<string, boolean> = new Map(); // sessionId -> seeking state
    private onTimeUpdateCallback: ((time: number, source: 'video' | 'ui') => void) | null = null;

    constructor(studio: any) {
        this.studio = studio;
    }

    setTimeUpdateCallback(callback: (time: number, source: 'video' | 'ui') => void): void {
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
            if (!this.isVideoSeeking.get(sessionId) && this.onTimeUpdateCallback) {
                // Convert video time to session time using the sync offset
                const sessionTime = video.currentTime + this.studio.videoSyncOffset;
                this.onTimeUpdateCallback(sessionTime, 'video');
            }
        });

        video.addEventListener('seeking', () => {
            this.isVideoSeeking.set(sessionId, true);
        });

        video.addEventListener('seeked', () => {
            this.isVideoSeeking.set(sessionId, false);
            if (this.onTimeUpdateCallback) {
                const sessionTime = video.currentTime + this.studio.videoSyncOffset;
                this.onTimeUpdateCallback(sessionTime, 'video');
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

        // Calculate the sync offset
        // Video time at current frame should correspond to the start of the selected lap
        this.studio.videoSyncOffset = selectedLap.lapStartTime - video.currentTime;
        
        // Hide sync controls
        syncControls.style.display = 'none';
        
        console.log(`Video synced: Lap ${selectedLapIndex} start (${selectedLap.lapStartTime}s) = Video time ${video.currentTime}s`);
        console.log(`Sync offset: ${this.studio.videoSyncOffset}s`);
    }

    cancelSync(sessionId: string): void {
        const syncControls = document.getElementById(`sync-controls-${sessionId}`);
        if (syncControls) {
            syncControls.style.display = 'none';
        }
    }

    // Update video time from external source (graphs, lap selection) for active session
    updateVideoTime(sessionTime: number, activeSessionId: string): void {
        const video = this.videos.get(activeSessionId);
        if (!video || this.isVideoSeeking.get(activeSessionId)) return;

        // Convert session time to video time using the sync offset
        const videoTime = sessionTime - this.studio.videoSyncOffset;
        
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

    private formatTime(seconds: number): string {
        if (seconds < 60) {
            return seconds.toFixed(3) + 's';
        }
        
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toFixed(3).padStart(6, '0')}`;
    }
}
