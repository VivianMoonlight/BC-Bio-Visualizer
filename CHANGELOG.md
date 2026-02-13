# Changelog

All notable changes to BC-Bio-Visualizer will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2026-02-14

### Added

#### Mobile & Responsive UI
- **Device Detection**: Automatic desktop/mobile detection via UA + touch + screen size
- **Screen Size Categories**: Three breakpoints — small (≤600px), medium (601-1024px), large (>1024px)
- **Mobile Navigation Bar**: Floating bottom nav with filter, fit, extract, detail, and close buttons
- **Slide-in Overlay Panels**: Left (filters) and right (details) panels slide in as overlays on mobile
- **Panel Backdrop**: Semi-transparent backdrop behind overlay panels with tap-to-close
- **Swipe Gestures**: Swipe-to-close on overlay panels (left swipe closes left panel, right swipe closes right panel)
- **Auto Detail Panel**: Tapping a node on mobile auto-opens the detail panel overlay
- **Touch-optimized Controls**: Larger tap targets (40px min), bigger checkboxes/radios (20px), always-visible action buttons
- **Orientation Change Handling**: Layout adapts on device rotation with debounced resize detection
- **Compact Graph Options**: Smaller node labels, adjusted physics, and slower zoom on mobile
- **Scroll Lock**: Prevents background page scrolling when visualizer is open on mobile
- **Touch Splitter Support**: Touch events for panel splitters (on tablet landscape)
- **Responsive Header**: Toolbar wraps and buttons auto-size on narrow screens
- **Dynamic Layout Change Listener**: `DeviceDetector.onChange()` callback for runtime adaptation

## [2.0.0] - 2026-02-13

### 🎉 Major Release - Tampermonkey Migration

Complete rewrite as a Tampermonkey userscript with enhanced features and better user experience.

### Added

#### Core Features
- **Tampermonkey Integration**: Full browser extension support
- **Shadow DOM Isolation**: Complete style isolation from target website
- **Data Extraction Module**: Automatic IndexedDB reading with LZString decoding
- **Smart Caching**: 5-minute cache to reduce repeated data extraction
- **Progress UI**: Loading overlay with real-time progress messages

#### Visualization
- **vis-network Integration**: Professional graph rendering with physics engine
- **Node Selection**: Click to view details, double-click to pin
- **Auto Layout**: Automatic graph layout with Barnes-Hut physics
- **Manual Physics Toggle**: Turn physics on/off with spacebar

#### Search & Filter
- **Multi-field Search**: Search by name, nickname, or ID (debounced 300ms)
- **Title Filter**: Filter members by title
- **Relationship Filters**: Toggle ownership/lovership edges
- **Hide Isolated**: Option to hide isolated nodes
- **Filtered List**: Clickable list of filtered members (limit 50)

#### Group Management
- **Create Groups**: Create custom groups with unique colors
- **Edit Groups**: Rename groups with inline editing
- **Delete Groups**: Remove groups with confirmation
- **Assign Nodes**: Assign members to groups via radio buttons
- **Group Search**: Filter groups by name
- **Auto Colors**: Deterministic HSL color generation based on group ID
- **Visual Feedback**: Colored borders and backgrounds for grouped nodes

#### Node Pinning
- **Pin Nodes**: Double-click to pin/unpin nodes
- **Always Visible**: Pinned nodes remain visible when filters applied
- **Pin List**: Display all pinned nodes in sidebar
- **Visual Indicator**: Blue border and glow effect for pinned nodes

#### Data Persistence
- **GM API Storage**: Cross-origin persistent storage using Tampermonkey APIs
- **Import/Export**: JSON-based backup and restore
- **Data Migration**: Compatible with v2 data format from HTML version
- **Auto Save**: Automatic saving on every change

#### User Interface
- **Three-Column Layout**: Left panel (filters), center (graph), right panel (details)
- **Draggable Splitters**: Adjust panel widths by dragging
- **Responsive Design**: Mobile-friendly with media queries
- **Toast Notifications**: Non-blocking success/error/info messages
- **Statistics Display**: Real-time member and relationship counts
- **Help Tooltips**: Built-in usage instructions

#### User Experience
- **Keyboard Shortcuts**:
  - `Ctrl+Shift+V`: Toggle visualizer
  - `Space`: Toggle physics engine
  - `Enter`: Save edits
  - `Escape`: Cancel edits
- **Floating Button**: Always-accessible trigger button
- **Loading Animations**: Smooth transitions and progress indicators
- **Error Handling**: User-friendly error messages

### Changed
- Migrated from standalone HTML to Tampermonkey userscript
- Replaced localStorage with GM API for better cross-origin support
- Improved UI with Shadow DOM for style isolation
- Enhanced performance with smart caching
- Better error handling and user feedback

### Technical Improvements
- **Architecture**: Modular design with clear separation of concerns
- **Code Quality**: ~2200 lines of well-documented code
- **Performance**: Optimized for large datasets (tested with 700+ profiles)
- **Dependencies**: vis-network 9.1.9, LZ-String 1.4.4
- **Browser Support**: Chrome, Firefox, Edge with Tampermonkey

### Not Implemented (Optional Features)
- Circle management UI
- Convex hull visualization for circles
- Circle-based filtering

### Fixed
- Style conflicts with target website (via Shadow DOM)
- Data persistence issues (via GM API)
- Performance issues with large datasets (via caching)

## [1.0.0] - Previous Version

### Features
- Standalone HTML application
- Manual data extraction via console
- Basic graph visualization
- Group and circle management
- Convex hull rendering
- localStorage-based persistence

---

**Note**: Version 2.0.0 represents a complete rewrite with 75% of planned features implemented. All core functionality is working and the script is fully usable. Optional advanced features (circles) can be added in future versions.
