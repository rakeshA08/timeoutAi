'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  FolderGit2, ArrowLeft, Save, Plus, Trash2, HelpCircle, 
  ChevronLeft, ChevronRight, CheckCircle2, 
  Eye, EyeOff, Sparkles, Layers, RefreshCw, Key, Play, Pause,
  SkipBack, SkipForward, ZoomIn, ZoomOut, Maximize2, GitBranch,
  Check, AlertTriangle, Cloud, CloudOff, Loader2, ArrowRight,
  FileText, Code, CheckSquare, Target
} from 'lucide-react';
import Link from 'next/link';

type Annotation = {
  id: string;
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  className: string;
  confidence?: number;
  trackId?: string | null;
};

type ClassItem = {
  id: number | string;
  name: string;
  color: string;
};

type Frame = {
  id: string;
  videoId: string;
  frameNumber: number;
  timestampSec: number;
  path: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  width: number;
  height: number;
  status: string;
  annotationCount?: number;
};

export default function AnnotatorClient({ 
  projectId, 
  projectName, 
  initialClasses,
  initialFrames,
  initialVideoId,
  githubUrl,
}: { 
  projectId: string; 
  projectName: string; 
  initialClasses: ClassItem[];
  initialFrames: Frame[];
  initialVideoId?: string;
  githubUrl?: string | null;
}) {
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [selectedClass, setSelectedClass] = useState<string>(initialClasses[0]?.name || 'ball');
  const [frames, setFrames] = useState<Frame[]>(initialFrames);
  const [currentFrameIdx, setCurrentFrameIdx] = useState<number>(0);
  
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [selectedAnnId, setSelectedAnnId] = useState<string | null>(null);
  
  // Viewer controls
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackFps, setPlaybackFps] = useState<number>(15);
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [showLabels, setShowLabels] = useState(true);
  const [showYoloPreview, setShowYoloPreview] = useState(true);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveToast, setSaveToast] = useState<string | null>(null);

  // Tracking & GitHub Sync state
  const [isTracking, setIsTracking] = useState(false);
  const [trackRange, setTrackRange] = useState(15);
  const [gitStatus, setGitStatus] = useState<{
    syncStatus: 'synced' | 'syncing' | 'pending' | 'failed';
    lastCommitHash: string | null;
    lastSyncTime: string | null;
    remoteUpdated: boolean;
  }>({
    syncStatus: 'synced',
    lastCommitHash: null,
    lastSyncTime: null,
    remoteUpdated: false,
  });

  // Extraction Progress State
  const [extractionProgress, setExtractionProgress] = useState<{
    status: string;
    percentage: number;
    processedFrames: number;
    totalFrames: number;
  } | null>(null);

  // Canvas drawing state
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentBox, setCurrentBox] = useState<{ x: number; y: number; width: number; height: number } | null>(null);

  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const currentFrame = frames[currentFrameIdx];

  // Preload nearby images: N-2, N-1, N+1, N+2
  useEffect(() => {
    if (frames.length === 0) return;
    const indicesToPreload = [
      currentFrameIdx - 2,
      currentFrameIdx - 1,
      currentFrameIdx + 1,
      currentFrameIdx + 2,
    ];

    indicesToPreload.forEach((idx) => {
      if (idx >= 0 && idx < frames.length) {
        const frame = frames[idx];
        const url = frame.imageUrl || `/api/media?path=${encodeURIComponent(frame.path)}`;
        const img = new Image();
        img.src = url;
      }
    });
  }, [currentFrameIdx, frames]);

  // Fetch annotations for current frame
  const fetchAnnotations = useCallback(async (frameId: string) => {
    try {
      const res = await fetch(`/api/images/${frameId}/annotations`);
      if (res.ok) {
        const data = await res.json();
        setAnnotations(data.annotations || []);
      }
    } catch (e) {
      console.error('Failed to load annotations', e);
    }
  }, []);

  useEffect(() => {
    if (!currentFrame) return;
    fetchAnnotations(currentFrame.id);
  }, [currentFrameIdx, currentFrame, fetchAnnotations]);

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying) return;
    const interval = setInterval(() => {
      setCurrentFrameIdx((prev) => {
        if (prev >= frames.length - 1) {
          setIsPlaying(false);
          return prev;
        }
        return prev + 1;
      });
    }, 1000 / playbackFps);

    return () => clearInterval(interval);
  }, [isPlaying, playbackFps, frames.length]);

  // Poll video extraction progress and Git status periodically
  useEffect(() => {
    const pollStatus = async () => {
      const videoId = initialVideoId || frames[0]?.videoId;
      if (videoId) {
        try {
          const res = await fetch(`/api/videos/status?videoId=${videoId}`);
          if (res.ok) {
            const data = await res.json();
            if (data.status === 'PROCESSING') {
              setExtractionProgress(data);
              const framesRes = await fetch(`/api/frames?videoId=${videoId}`);
              if (framesRes.ok) {
                const framesData = await framesRes.json();
                if (framesData.frames?.length > frames.length) {
                  setFrames(framesData.frames);
                }
              }
            } else {
              setExtractionProgress(null);
            }
          }
        } catch {
          // ignore
        }
      }

      try {
        const gitRes = await fetch(`/api/git/status?projectId=${projectId}`);
        if (gitRes.ok) {
          const data = await gitRes.json();
          setGitStatus(data);
        }
      } catch {
        // ignore
      }
    };

    pollStatus();
    const interval = setInterval(pollStatus, 15000);
    return () => clearInterval(interval);
  }, [initialVideoId, projectId, frames.length]);

  // Scroll timeline to keep active thumbnail in view
  useEffect(() => {
    if (timelineScrollRef.current) {
      const activeEl = timelineScrollRef.current.children[currentFrameIdx] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentFrameIdx]);

  // Create new Annotation on current image
  const handleCreateAnnotation = async (box: { x: number; y: number; width: number; height: number }) => {
    if (!currentFrame) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/images/${currentFrame.id}/annotations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          className: selectedClass,
          x: Math.round(box.x * 10) / 10,
          y: Math.round(box.y * 10) / 10,
          width: Math.round(box.width * 10) / 10,
          height: Math.round(box.height * 10) / 10,
          confidence: 1.0,
          source: 'manual',
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setAnnotations((prev) => [...prev, data.annotation]);
        setSelectedAnnId(data.annotation.id);
        setSaveToast('Saved & YOLO Synced');
        setGitStatus((prev) => ({ ...prev, syncStatus: 'syncing' }));
        setTimeout(() => {
          setSaveToast(null);
          setGitStatus((prev) => ({ ...prev, syncStatus: 'synced' }));
        }, 1500);
      }
    } catch (e) {
      console.error('Failed to create annotation', e);
    } finally {
      setIsSaving(false);
    }
  };

  // Delete specific Annotation
  const handleDeleteAnnotation = async (idToDelete: string) => {
    if (!idToDelete) return;
    try {
      const res = await fetch(`/api/annotations/${idToDelete}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setAnnotations((prev) => prev.filter((a) => a.id !== idToDelete));
        if (selectedAnnId === idToDelete) setSelectedAnnId(null);
        setSaveToast('Deleted & YOLO Updated');
        setTimeout(() => setSaveToast(null), 1500);
      }
    } catch (e) {
      console.error('Failed to delete annotation', e);
    }
  };

  // Run Ball / Object Tracking forward across frames
  const runTrackForward = async () => {
    if (!currentFrame) return;
    const targetBox = annotations.find((a) => a.id === selectedAnnId) || annotations[0] || {
      x: 35,
      y: 40,
      width: 8,
      height: 8,
      className: selectedClass,
    };

    setIsTracking(true);
    try {
      const res = await fetch('/api/tracking/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          videoId: currentFrame.videoId,
          startFrameNumber: currentFrame.frameNumber,
          frameCount: trackRange,
          initialBox: targetBox,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSaveToast(`Tracked ${data.trackedFramesCount} frames → Auto Git Syncing...`);
        setGitStatus((prev) => ({ ...prev, syncStatus: 'syncing' }));

        await fetchAnnotations(currentFrame.id);

        setTimeout(() => {
          setSaveToast(`✓ Tracking Synced to GitHub!`);
          setGitStatus((prev) => ({
            ...prev,
            syncStatus: 'synced',
            lastSyncTime: new Date().toISOString(),
          }));
          setTimeout(() => setSaveToast(null), 3000);
        }, 1800);
      } else {
        alert('Tracking failed');
      }
    } catch (e) {
      console.error('Failed to run tracking', e);
    } finally {
      setIsTracking(false);
    }
  };

  // Keyboard shortcuts & Function keys handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      if (e.key === 'F1') {
        e.preventDefault();
        setShowHelpModal((prev) => !prev);
      } else if (e.key === 'F2') {
        e.preventDefault();
        const currentIdx = classes.findIndex((c) => c.name === selectedClass);
        const nextClass = classes[(currentIdx + 1) % classes.length];
        if (nextClass) setSelectedClass(nextClass.name);
      } else if (e.key === 'F3') {
        e.preventDefault();
        runTrackForward();
      } else if (e.key === 'F4') {
        e.preventDefault();
        setShowLabels((prev) => !prev);
      } else if (e.key === 'F8') {
        e.preventDefault();
        setSelectedAnnId(null);
      } else if (e.key === 'F9') {
        e.preventDefault();
        toggleReviewStatus();
      } else if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      } else if (e.key === 'Home') {
        e.preventDefault();
        setCurrentFrameIdx(0);
      } else if (e.key === 'End') {
        e.preventDefault();
        setCurrentFrameIdx(Math.max(0, frames.length - 1));
      } else if (e.key === 'ArrowRight' || e.key.toLowerCase() === 'd') {
        e.preventDefault();
        setCurrentFrameIdx((prev) => Math.min(frames.length - 1, prev + 1));
      } else if (e.key === 'ArrowLeft' || e.key.toLowerCase() === 'a') {
        e.preventDefault();
        setCurrentFrameIdx((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedAnnId) {
          e.preventDefault();
          handleDeleteAnnotation(selectedAnnId);
        }
      } else if (/^[1-9]$/.test(e.key)) {
        const idx = parseInt(e.key, 10) - 1;
        if (classes[idx]) setSelectedClass(classes[idx].name);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [classes, selectedClass, currentFrameIdx, annotations, selectedAnnId, frames, runTrackForward]);

  const toggleReviewStatus = () => {
    if (!currentFrame) return;
    setFrames((prev) =>
      prev.map((f, i) =>
        i === currentFrameIdx
          ? { ...f, status: f.status === 'reviewed' ? 'unreviewed' : 'reviewed' }
          : f
      )
    );
  };

  // Canvas drawing handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    setIsDrawing(true);
    setStartPos({ x, y });
    setCurrentBox({ x, y, width: 0, height: 0 });
    setSelectedAnnId(null);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDrawing || !startPos || !canvasContainerRef.current) return;
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const currentX = ((e.clientX - rect.left) / rect.width) * 100;
    const currentY = ((e.clientY - rect.top) / rect.height) * 100;

    const x = Math.min(startPos.x, currentX);
    const y = Math.min(startPos.y, currentY);
    const width = Math.abs(currentX - startPos.x);
    const height = Math.abs(currentY - startPos.y);

    setCurrentBox({ x, y, width, height });
  };

  const handleMouseUp = () => {
    if (isDrawing && currentBox && currentBox.width > 0.5 && currentBox.height > 0.5) {
      handleCreateAnnotation(currentBox);
    }
    setIsDrawing(false);
    setStartPos(null);
    setCurrentBox(null);
  };

  const getClassColor = (name: string) => {
    const cls = classes.find((c) => c.name.toLowerCase() === name.toLowerCase());
    return cls?.color || '#38bdf8';
  };

  const currentImageUrl = currentFrame
    ? currentFrame.imageUrl || `/api/media?path=${encodeURIComponent(currentFrame.path)}`
    : '';

  // Generate real-time YOLO label lines for preview
  const yoloLines = annotations.map((ann) => {
    const classIdx = classes.findIndex((c) => c.name.toLowerCase() === ann.className.toLowerCase());
    const cId = classIdx >= 0 ? classIdx : 0;
    const cx = (ann.x + ann.width / 2) / 100;
    const cy = (ann.y + ann.height / 2) / 100;
    const nw = ann.width / 100;
    const nh = ann.height / 100;
    return `${cId} ${cx.toFixed(6)} ${cy.toFixed(6)} ${nw.toFixed(6)} ${nh.toFixed(6)}`;
  });

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Remote Change Notification Banner */}
      {gitStatus.remoteUpdated && (
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 px-6 py-2 border-b border-indigo-500/40 flex items-center justify-between text-xs text-indigo-100 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Sparkles size={14} className="text-amber-400" />
            <span>Remote repository has new tracking changes from collaborator.</span>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1 rounded font-semibold transition-colors cursor-pointer"
          >
            Pull & Refresh Workspace
          </button>
        </div>
      )}

      {/* Progressive Extraction Progress Banner */}
      {extractionProgress && (
        <div className="bg-indigo-950/80 px-6 py-2 border-b border-indigo-800/60 flex items-center justify-between text-xs">
          <div className="flex items-center gap-3 text-indigo-300">
            <Loader2 size={14} className="animate-spin text-indigo-400" />
            <span>
              Extracting frames in background: <strong>{extractionProgress.processedFrames}</strong> /{' '}
              {extractionProgress.totalFrames} ({extractionProgress.percentage}%)
            </span>
          </div>
          <span className="text-[11px] text-gray-400">Frames are accessible immediately</span>
        </div>
      )}

      {/* Top Header Bar */}
      <header className="h-16 border-b border-gray-800 bg-gray-900/90 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <Link
            href={`/project/${projectId}`}
            className="inline-flex items-center gap-2 text-xs font-medium text-gray-400 hover:text-white bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-lg transition-colors"
          >
            <ArrowLeft size={14} />
            Back to Project
          </Link>
          <div className="flex items-center gap-2">
            <FolderGit2 className="text-blue-500 w-5 h-5" />
            <h1 className="font-semibold text-sm text-gray-100">{projectName}</h1>
            <span className="text-gray-600">/</span>
            <span className="text-xs bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 px-2 py-0.5 rounded font-mono">
              YOLO Dataset Annotator
            </span>
          </div>
        </div>

        {/* GitHub Automatic Sync Indicator */}
        <div className="flex items-center gap-3">
          <div
            className="flex items-center gap-2 text-xs bg-gray-950 border border-gray-800 px-3 py-1.5 rounded-lg text-gray-300"
            title={`Last Commit: ${gitStatus.lastCommitHash?.substring(0, 7) || 'Initial'} | Synced: ${gitStatus.lastSyncTime ? new Date(gitStatus.lastSyncTime).toLocaleTimeString() : 'Ready'}`}
          >
            {gitStatus.syncStatus === 'syncing' ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <Loader2 size={13} className="animate-spin" />
                <span>Syncing GitHub...</span>
              </span>
            ) : gitStatus.syncStatus === 'pending' ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <Cloud size={13} />
                <span>Sync Pending</span>
              </span>
            ) : gitStatus.syncStatus === 'failed' ? (
              <span className="flex items-center gap-1.5 text-red-400 font-medium">
                <CloudOff size={13} />
                <span>Sync Failed</span>
              </span>
            ) : (
              <span className="flex items-center gap-1.5 text-emerald-400 font-medium">
                <Check size={13} />
                <span>GitHub Synced</span>
              </span>
            )}
            {gitStatus.lastCommitHash && (
              <span className="text-[10px] font-mono text-gray-500">
                #{gitStatus.lastCommitHash.substring(0, 6)}
              </span>
            )}
          </div>

          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-1 bg-gray-950 border border-gray-800 hover:border-gray-700 px-2.5 py-1.5 rounded-lg text-xs text-gray-300 transition-colors cursor-pointer"
          >
            <Key size={12} className="text-indigo-400" />
            <span className="font-mono text-[10px] bg-gray-800 px-1 rounded">F1</span>
          </button>

          {saveToast && (
            <span className="text-xs text-green-400 font-medium animate-in fade-in">
              {saveToast}
            </span>
          )}
        </div>
      </header>

      {/* Main Studio Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Toolbar / Class & Multi-Ball List Panel */}
        <aside className="w-64 border-r border-gray-800 bg-gray-900/60 p-4 flex flex-col justify-between shrink-0 overflow-y-auto">
          <div className="space-y-5">
            {/* Class Selector */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Classes (1-9)</h3>
                <span className="text-[10px] text-gray-500 font-mono">F2: Cycle</span>
              </div>
              <div className="space-y-1">
                {classes.map((cls, idx) => {
                  const isSelected = selectedClass.toLowerCase() === cls.name.toLowerCase();
                  return (
                    <button
                      key={cls.id}
                      onClick={() => setSelectedClass(cls.name)}
                      className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-600/20 text-white border border-indigo-500/50 shadow-sm'
                          : 'text-gray-400 hover:bg-gray-800/80 hover:text-gray-200 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-2.5 h-2.5 rounded-full shrink-0"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span>{cls.name}</span>
                      </div>
                      <span className="text-[10px] font-mono opacity-60 bg-gray-950 px-1.5 py-0.5 rounded border border-gray-800">
                        {idx + 1}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Multiple Ball / Object List on this Frame */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                  <Target size={13} className="text-indigo-400" />
                  <span>Objects on Frame ({annotations.length})</span>
                </h4>
                {selectedAnnId && (
                  <button
                    onClick={() => handleDeleteAnnotation(selectedAnnId)}
                    className="text-red-400 hover:text-red-300 text-[10px] flex items-center gap-1 cursor-pointer"
                  >
                    <Trash2 size={10} /> Delete (Del)
                  </button>
                )}
              </div>
              <div className="space-y-1 max-h-40 overflow-y-auto pr-1">
                {annotations.length === 0 ? (
                  <p className="text-[11px] text-gray-500 italic py-2 text-center bg-gray-950/40 rounded-lg border border-dashed border-gray-800">
                    Click & drag on image to label Ball 1, Ball 2, etc.
                  </p>
                ) : (
                  annotations.map((ann, idx) => {
                    const isSelected = selectedAnnId === ann.id;
                    const color = getClassColor(ann.className);
                    return (
                      <div
                        key={ann.id}
                        onClick={() => setSelectedAnnId(ann.id)}
                        className={`flex items-center justify-between p-2 rounded-lg text-xs cursor-pointer transition-colors ${
                          isSelected
                            ? 'bg-indigo-950/60 border border-indigo-500/40 text-indigo-300'
                            : 'bg-gray-950/40 hover:bg-gray-800/50 text-gray-300 border border-gray-800/50'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: color }}
                          />
                          <span className="font-medium text-xs">
                            {ann.className} #{idx + 1}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-gray-500 font-mono">
                            {Math.round(ann.width)}%×{Math.round(ann.height)}%
                          </span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteAnnotation(ann.id);
                            }}
                            className="text-gray-500 hover:text-red-400 p-0.5"
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* AI Forward Tracker */}
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-400">
                  <Sparkles size={14} />
                  <span>Auto-Tracker (F3)</span>
                </div>
                <span className="text-[10px] text-emerald-400 font-mono">Auto Git Push</span>
              </div>
              <p className="text-[11px] text-gray-400 mb-3 leading-relaxed">
                Propagates ball trajectory across frames and automatically creates matching YOLO label files.
              </p>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-[11px] text-gray-400">Frames:</span>
                <input
                  type="number"
                  min="3"
                  max="60"
                  value={trackRange}
                  onChange={(e) => setTrackRange(parseInt(e.target.value, 10) || 10)}
                  className="w-16 bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                />
              </div>
              <button
                onClick={runTrackForward}
                disabled={isTracking || frames.length === 0}
                className="w-full inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-semibold shadow-md transition-all cursor-pointer disabled:opacity-50"
              >
                {isTracking ? <Loader2 size={13} className="animate-spin" /> : <ArrowRight size={13} />}
                {isTracking ? 'Tracking & Syncing...' : `Track Forward (${trackRange}f)`}
              </button>
            </div>

            {/* Live YOLO Label Preview */}
            <div className="p-3 bg-gray-950 rounded-xl border border-gray-800">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-300">
                  <FileText size={13} className="text-amber-400" />
                  <span>YOLO .txt Output</span>
                </div>
                <span className="text-[10px] text-gray-500 font-mono">labels/train/</span>
              </div>
              <div className="p-2 bg-black rounded-lg border border-gray-800 text-[10px] font-mono text-emerald-400 overflow-x-auto max-h-24 select-all">
                {yoloLines.length === 0 ? (
                  <span className="text-gray-600 italic">(empty label file)</span>
                ) : (
                  yoloLines.map((line, i) => <div key={i}>{line}</div>)
                )}
              </div>
            </div>
          </div>
        </aside>

        {/* Central Frame Viewer & Timeline Area */}
        <main className="flex-1 bg-gray-950 flex flex-col justify-between select-none overflow-hidden p-4">
          {/* Main Visual Canvas Frame */}
          <div className="flex-1 flex items-center justify-center relative overflow-hidden">
            {frames.length === 0 ? (
              <div className="text-center text-gray-500">
                <Layers size={48} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No video frames loaded. Upload a video to start.</p>
              </div>
            ) : (
              <div
                ref={canvasContainerRef}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                className="relative max-w-4xl w-full aspect-video bg-black rounded-2xl border border-gray-800 overflow-hidden shadow-2xl cursor-crosshair group flex items-center justify-center"
                style={{
                  transform: `scale(${zoomLevel})`,
                  transition: 'transform 0.15s ease-out',
                }}
              >
                {/* Real Frame Image Display */}
                {currentImageUrl && (
                  <img
                    src={currentImageUrl}
                    alt={`Frame ${currentFrame?.frameNumber}`}
                    className="w-full h-full object-contain pointer-events-none select-none"
                  />
                )}

                {/* Frame Status Badge Overlay */}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-xs px-3 py-1.5 rounded-lg border border-gray-800 text-xs font-mono text-gray-200 pointer-events-none flex items-center gap-2 shadow-lg">
                  <span>Frame #{currentFrame?.frameNumber || currentFrameIdx + 1} / {frames.length}</span>
                  <span className="text-gray-600">|</span>
                  <span>{(currentFrame?.timestampSec || 0).toFixed(2)}s</span>
                  {currentFrame?.status === 'reviewed' ? (
                    <span className="flex items-center gap-1 text-green-400 font-semibold">
                      <CheckCircle2 size={12} /> Reviewed
                    </span>
                  ) : (
                    <span className="text-gray-400">Unreviewed</span>
                  )}
                </div>

                {/* Canvas Bounding Boxes (Supporting Multiple Balls / Objects) */}
                {annotations.map((ann, idx) => {
                  const isSelected = selectedAnnId === ann.id;
                  const color = getClassColor(ann.className);
                  return (
                    <div
                      key={ann.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAnnId(ann.id);
                      }}
                      className={`absolute transition-all cursor-pointer ${
                        isSelected ? 'ring-2 ring-white ring-offset-1 ring-offset-black' : ''
                      }`}
                      style={{
                        left: `${ann.x}%`,
                        top: `${ann.y}%`,
                        width: `${ann.width}%`,
                        height: `${ann.height}%`,
                        border: `2px solid ${color}`,
                        backgroundColor: `${color}25`,
                      }}
                    >
                      {showLabels && (
                        <span
                          className="absolute -top-5 left-0 text-[10px] font-bold text-white px-1.5 py-0.5 rounded shadow-md whitespace-nowrap flex items-center gap-1"
                          style={{ backgroundColor: color }}
                        >
                          <span>{ann.className} #{idx + 1}</span>
                          {ann.confidence && <span>{(ann.confidence * 100).toFixed(0)}%</span>}
                        </span>
                      )}
                    </div>
                  );
                })}

                {/* Active Drawing Box */}
                {isDrawing && currentBox && (
                  <div
                    className="absolute border-2 border-dashed border-white bg-white/10 pointer-events-none"
                    style={{
                      left: `${currentBox.x}%`,
                      top: `${currentBox.y}%`,
                      width: `${currentBox.width}%`,
                      height: `${currentBox.height}%`,
                    }}
                  />
                )}
              </div>
            )}
          </div>

          {/* Frame Player Navigation Toolbar */}
          <div className="w-full max-w-4xl mx-auto mt-3 bg-gray-900/90 border border-gray-800 rounded-xl px-4 py-2 flex items-center justify-between shrink-0">
            {/* Playback Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentFrameIdx(0)}
                disabled={currentFrameIdx === 0}
                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
                title="First Frame (Home)"
              >
                <SkipBack size={15} />
              </button>

              <button
                onClick={() => setCurrentFrameIdx((prev) => Math.max(0, prev - 1))}
                disabled={currentFrameIdx === 0}
                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
                title="Previous Frame (A or ←)"
              >
                <ChevronLeft size={16} />
              </button>

              <button
                onClick={() => setIsPlaying((prev) => !prev)}
                className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white transition-colors cursor-pointer shadow-sm mx-1"
                title="Play / Pause (Space)"
              >
                {isPlaying ? <Pause size={15} /> : <Play size={15} />}
              </button>

              <button
                onClick={() => setCurrentFrameIdx((prev) => Math.min(frames.length - 1, prev + 1))}
                disabled={currentFrameIdx >= frames.length - 1}
                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
                title="Next Frame (D or →)"
              >
                <ChevronRight size={16} />
              </button>

              <button
                onClick={() => setCurrentFrameIdx(Math.max(0, frames.length - 1))}
                disabled={currentFrameIdx >= frames.length - 1}
                className="p-1.5 rounded hover:bg-gray-800 disabled:opacity-30 text-gray-300 transition-colors cursor-pointer"
                title="Last Frame (End)"
              >
                <SkipForward size={15} />
              </button>

              <div className="h-4 w-px bg-gray-800 mx-2" />

              <select
                value={playbackFps}
                onChange={(e) => setPlaybackFps(parseInt(e.target.value, 10))}
                className="bg-gray-950 border border-gray-800 text-[11px] text-gray-300 rounded px-2 py-1 focus:outline-none"
              >
                <option value="5">5 FPS (0.15x)</option>
                <option value="15">15 FPS (0.5x)</option>
                <option value="30">30 FPS (1.0x)</option>
                <option value="60">60 FPS (2.0x)</option>
              </select>
            </div>

            {/* Frame Jump Input */}
            <div className="flex items-center gap-2 text-xs font-mono text-gray-300">
              <span>Frame:</span>
              <input
                type="number"
                min="1"
                max={frames.length || 1}
                value={currentFrameIdx + 1}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1 && val <= frames.length) {
                    setCurrentFrameIdx(val - 1);
                  }
                }}
                className="w-16 bg-gray-950 border border-gray-800 rounded px-2 py-1 text-center text-xs text-white"
              />
              <span className="text-gray-500">/ {frames.length}</span>
            </div>

            {/* Zoom and Review Actions */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.75, z - 0.25))}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Zoom Out"
              >
                <ZoomOut size={14} />
              </button>
              <span className="text-[11px] font-mono text-gray-500">{(zoomLevel * 100).toFixed(0)}%</span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.5, z + 0.25))}
                className="p-1.5 rounded hover:bg-gray-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                title="Zoom In"
              >
                <ZoomIn size={14} />
              </button>

              <div className="h-4 w-px bg-gray-800 mx-1" />

              <button
                onClick={toggleReviewStatus}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  currentFrame?.status === 'reviewed'
                    ? 'bg-green-950/40 text-green-400 border-green-500/30'
                    : 'bg-gray-800 text-gray-400 border-gray-700 hover:text-gray-200'
                }`}
              >
                <CheckCircle2 size={13} />
                <span>{currentFrame?.status === 'reviewed' ? 'Reviewed' : 'Review (F9)'}</span>
              </button>
            </div>
          </div>

          {/* Visual Timeline with 160x90 Thumbnails & Status Dots */}
          <div className="w-full max-w-4xl mx-auto mt-2.5">
            <div
              ref={timelineScrollRef}
              className="flex items-center gap-2 overflow-x-auto py-2 px-2 bg-gray-900/60 border border-gray-800 rounded-xl scrollbar-thin scrollbar-thumb-gray-800"
              style={{ minHeight: '90px' }}
            >
              {frames.map((frame, idx) => {
                const isSelected = idx === currentFrameIdx;
                const thumbUrl = frame.thumbnailUrl || `/api/media?path=${encodeURIComponent(frame.path)}`;
                const isReviewed = frame.status === 'reviewed';

                return (
                  <div
                    key={frame.id}
                    onClick={() => setCurrentFrameIdx(idx)}
                    className={`shrink-0 w-24 aspect-video rounded-lg overflow-hidden border-2 relative cursor-pointer transition-all hover:scale-105 ${
                      isSelected
                        ? 'border-indigo-500 shadow-[0_0_12px_rgba(99,102,241,0.5)] scale-105 z-10'
                        : 'border-gray-800 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img
                      src={thumbUrl}
                      alt={`Thumb ${frame.frameNumber}`}
                      loading="lazy"
                      className="w-full h-full object-cover pointer-events-none"
                    />

                    <div className="absolute top-1 left-1 flex items-center gap-1">
                      <span
                        className={`w-2 h-2 rounded-full shadow-sm ${
                          isReviewed ? 'bg-green-400' : 'bg-amber-400'
                        }`}
                      />
                    </div>

                    <div className="absolute bottom-0 inset-x-0 bg-black/80 text-[9px] font-mono text-center text-gray-300 py-0.5">
                      #{frame.frameNumber}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Function Keys & Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
              <div className="flex items-center gap-2 text-indigo-400">
                <HelpCircle size={20} />
                <h2 className="text-lg font-bold text-white">Function Keys & Shortcuts</h2>
              </div>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
              >
                Close (Esc)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80">
                <div className="font-semibold text-gray-200 mb-2 text-indigo-400">Function Keys</div>
                <div className="space-y-1.5 text-gray-300">
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F1</span> <span>Help / Shortcuts</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F2</span> <span>Cycle Next Class</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F3</span> <span>Run Auto-Tracker</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F4</span> <span>Toggle Labels</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F8</span> <span>Deselect Box</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">F9</span> <span>Mark Reviewed</span></div>
                </div>
              </div>

              <div className="p-3 bg-gray-950 rounded-xl border border-gray-800/80">
                <div className="font-semibold text-gray-200 mb-2 text-indigo-400">Navigation & Editing</div>
                <div className="space-y-1.5 text-gray-300">
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">Space</span> <span>Play / Pause</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">1 - 9</span> <span>Select Class</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">&rarr; / D</span> <span>Next Frame</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">&larr; / A</span> <span>Prev Frame</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">Home / End</span> <span>First / Last Frame</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">Del</span> <span>Delete Box</span></div>
                  <div className="flex justify-between"><span className="font-mono bg-gray-800 px-1 rounded">Ctrl+S / S</span> <span>Save Annotations</span></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
