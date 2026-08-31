# CV Studio — Collaborative Computer Vision & YOLO Dataset Platform

A high-performance, local-first computer vision annotation and dataset management platform designed for video frame extraction, multi-object labeling (e.g. table tennis multi-ball tracking), automatic YOLOv8/YOLOv11 label generation, and automated GitHub dataset synchronization.

---

## Key Architecture & Features

```text
VIDEO UPLOAD
      ↓
FFmpeg SERVER-SIDE EXTRACTION (JPG Frames + 160x90 Thumbnails)
      ↓
PROGRESSIVE SQLITE INDEXING (Zero-Wait Frame Access)
      ↓
FRAME-BY-FRAME CANVAS VIEWER (Preloading N-2..N+2, Shortcuts F1-F9)
      ↓
IMAGE-BY-IMAGE ANNOTATION (Multiple Ball/Object Support)
      ↓
AUTOMATIC YOLO LABEL GENERATION (Normalized Coordinates [0..1])
      ↓
AUTOMATIC GITHUB SYNCHRONIZATION QUEUE (Debounced Commits & Push)
      ↓
MULTI-USER COLLABORATION & REMOTE CHANGE DETECTION
```

---

## 1. Installation & Setup

### Prerequisites
- Node.js 18+ (tested with Node 20 / 22 / 24)
- npm or yarn

### Quick Start
```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Build optimized production bundle
npm run build
```

The application will start on `http://localhost:3000`.

---

## 2. Environment Variables

Create a `.env` file in the root directory (refer to `.env.example`):

```bash
# Database connection
DATABASE_URL="file:./.cvstudio/cvstudio.db"

# Root path for local datasets and video frames
DATA_ROOT="./.cvstudio"

# Port
PORT=3000
```

---

## 3. Video Processing & Frame Extraction Pipeline

- **Server-Side FFmpeg**: Automatic video stream inspection parsing exact duration, FPS, width, height, and codec.
- **Progressive Frame Exposure**: Emits real `.jpg` frames into `images/train/<videoId>_frame_XXXXXX.jpg` and indexes them into SQLite every 400ms so the user can navigate frames while extraction is running.
- **Timeline Thumbnails**: Extracts $160\times90$ small thumbnails into `thumbnails/` for fast virtualized scrolling.

---

## 4. Multi-Ball Annotation & YOLO Dataset Format

Every frame is an independent dataset image with a paired `.txt` YOLO label file:
```text
project/
├── images/
│   └── train/
│       ├── video1_frame_000001.jpg
│       ├── video1_frame_000002.jpg
│       └── ...
├── labels/
│   └── train/
│       ├── video1_frame_000001.txt
│       ├── video1_frame_000002.txt
│       └── ...
└── dataset.yaml
```

### Multiple Object Support on a Single Image
A single frame can contain multiple balls/objects. Each object is independently editable, movable, and removable:
```text
0 0.512345 0.417823 0.018200 0.020100
0 0.721150 0.551200 0.019400 0.018900
```
- Coordinates are normalized to $[0.0, 1.0]$:
  $$\text{center}_x = \frac{x + w/2}{W}, \quad \text{center}_y = \frac{y + h/2}{H}, \quad \text{norm}_w = \frac{w}{W}, \quad \text{norm}_h = \frac{h}{H}$$
- Any annotation **Create**, **Update**, or **Delete** instantly recalculates and updates the `.txt` label file on disk.

---

## 5. Automatic GitHub Synchronization & Multi-User Collaboration

- **Zero Manual Uploads**: Completed frame extractions, annotations, and tracking sequences automatically stage and create batched Git commits (`isomorphic-git`).
- **Sync Status**: Real-time indicator (`✓ Synced`, `↻ Syncing...`, `⚠ Sync pending`, `✕ Sync failed`) with commit hash and timestamp.
- **Remote Change Detection**: Periodically polls remote repository commits every 15–30s and alerts collaborators when remote dataset updates arrive, allowing instant local synchronization without full page reload.

---

## 6. Keyboard Shortcuts & Function Keys

| Key | Action |
| :--- | :--- |
| **`F1`** | Open Shortcuts & Help Cheat Sheet |
| **`F2`** | Cycle Next Annotation Class |
| **`F3`** | Run Auto-Tracker Forward across frame range + Auto Git Sync |
| **`F4`** | Toggle Box Labels Overlay |
| **`F8`** | Deselect active bounding box |
| **`F9`** | Toggle Reviewed / Unreviewed Frame Status |
| **`1` – `9`** | Quick switch class (Ball, Player, Paddle, Table, Net) |
| **`Space`** | Play / Pause sequence playback |
| **`←` / `A`** | Previous Frame |
| **`→` / `D`** | Next Frame |
| **`Home` / `End`** | Jump to First / Last Frame |
| **`Delete` / `Backspace`** | Delete selected bounding box |
| **`Ctrl+S` / `S`** | Save & Index Annotations |

---

## 7. Verification & Tests

Run the comprehensive end-to-end acceptance test suite:
```bash
node test_production_e2e.js
```
The test suite validates:
1. Video upload and FFmpeg frame extraction.
2. Progressive indexing and media serving.
3. Multi-ball annotation creation (3 balls).
4. Automatic YOLO `.txt` generation with 3 lines.
5. Annotation updates and automatic file synchronization.
6. Annotation deletion and line count reduction.
7. Automated Git commit creation and sync state tracking.
8. `dataset.yaml` maintenance.
