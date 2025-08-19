# Video Frame Analyzer with Telemetry

A web application for playing video files, analyzing individual frames, and synchronizing telemetry data from CSV files. Users can load racing data logs and display live GPS speed synchronized with video playback.

## Features

### Current Features
- **Video File Selection**: Support for MP4 and other video formats
- **CSV Data Log Import**: Load AiM CSV telemetry files with lap times and GPS data
- **Video Playback**: Full video player with standard controls
- **Frame Navigation**: Navigate through video frame by frame
- **Frame Selection**: Select and analyze specific frames
- **Telemetry Synchronization**: Sync video with telemetry data using lap timing
- **Live GPS Speed Display**: Real-time GPS speed display during video playback
- **Frame Information**: Display frame number and timestamp for selected frames
- **Keyboard Shortcuts**: Convenient keyboard controls for navigation
- **Responsive Design**: Works on desktop and mobile devices

### Planned Features
- Enhanced frame rate detection
- Frame extraction and export
- Multiple frame comparison
- Video metadata analysis

## How to Use

### Getting Started
1. Open `index.html` in a web browser
2. Click "Choose Video File" to select an MP4 video file
3. Click "Choose CSV Data Log" to select an AiM CSV telemetry file
4. The video player will appear once a file is selected
5. Select the frame where lap 1 starts to synchronize telemetry data

### Video Controls
- Use the standard video controls to play, pause, and seek
- The current time and total duration are displayed
- The current frame number is shown in real-time

### Frame Navigation
- **Previous Frame**: Click the ⏮ button or press Left Arrow
- **Next Frame**: Click the ⏭ button or press Right Arrow
- **Play/Pause**: Press Spacebar
- **Select Frame**: Click "Select Current Frame" button or press Enter

### Frame Selection and Telemetry Sync
When you select a frame:
- The frame number and timestamp are recorded
- A green information panel appears showing the selected frame details
- If CSV data is loaded, this frame is used as the sync point for lap 1 start
- GPS speed will be displayed live during video playback once synced

### Telemetry Data
The application supports AiM CSV format with the following features:
- **Lap Time Parsing**: Extracts segment times to identify lap boundaries
- **GPS Speed Display**: Shows real-time GPS speed rounded to nearest km/h
- **Data Synchronization**: Aligns telemetry data with video timeline
- **Live Updates**: Speed updates continuously during video playback

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| ← (Left Arrow) | Previous frame |
| → (Right Arrow) | Next frame |
| Spacebar | Play/Pause video |
| Enter | Select current frame |

## Technical Details

### File Structure
```
Video/
├── index.html          # Main HTML file
├── styles.css          # CSS styling
├── script.js           # JavaScript functionality
└── README.md           # This documentation
```

### Browser Compatibility
- Modern browsers with HTML5 video support
- Chrome, Firefox, Safari, Edge (latest versions)
- Mobile browsers on iOS and Android

### Video Format Support
- Primary: MP4 (H.264)
- Additional formats supported by the browser's video element
- File size limitations depend on browser and system memory

### CSV Format Support
- **AiM CSV Format**: Racing telemetry data with lap times and GPS information
- **Required Fields**: "Segment Times" for lap boundaries, "Time" and "GPS Speed" columns
- **Data Structure**: Expects header metadata followed by time-series data
- **Sample Rate**: Supports various sample rates (typically 20Hz for AiM systems)

## Development

### Architecture
The application uses a class-based JavaScript architecture:

- **VideoFrameAnalyzer**: Main class handling all functionality
- **Event-driven**: Responds to user interactions and video events
- **Modular design**: Easy to extend with additional features

### Frame Rate Estimation
Currently uses a default 30fps estimation. For more accurate frame counting:
- The application could be enhanced with FFmpeg.js for precise frame rate detection
- Video metadata parsing could provide exact frame rates
- Frame-perfect navigation would require additional video processing libraries

### Extending the Application
To add new features:
1. Add HTML elements in `index.html`
2. Style them in `styles.css`
3. Implement functionality in the `VideoFrameAnalyzer` class in `script.js`

## Future Enhancements

### Planned Improvements
1. **Accurate Frame Rate Detection**: Use video metadata or FFmpeg.js
2. **Frame Export**: Save selected frames as images
3. **Batch Frame Selection**: Select multiple frames at once
4. **Frame Comparison**: Side-by-side frame comparison
5. **Video Metadata Display**: Show codec, resolution, bitrate, etc.
6. **Timeline Scrubbing**: Visual timeline with frame thumbnails
7. **Annotation Tools**: Add notes or markers to specific frames

### Technical Improvements
- WebAssembly integration for better performance
- Service Worker for offline functionality
- IndexedDB for storing frame selections
- Canvas-based frame manipulation
- WebGL for advanced video processing

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve the application.
