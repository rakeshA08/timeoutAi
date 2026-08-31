'use client';

import { useState } from 'react';
import { 
  FolderGit2, Video, Database, Settings, ArrowLeft, GitBranch, 
  ExternalLink, Plus, Trash2, Edit3, Loader2, Film, CheckCircle2, Play, Layers
} from 'lucide-react';
import Link from 'next/link';

type VideoItem = {
  id: string;
  projectId: string;
  filename: string;
  fps: number;
  totalFrames: number | null;
  status: string;
  createdAt: string | Date;
};

type Project = {
  id: string;
  name: string;
  githubUrl: string | null;
};

export default function VideosClient({ 
  project, 
  initialVideos 
}: { 
  project: Project; 
  initialVideos: VideoItem[];
}) {
  const [videos, setVideos] = useState<VideoItem[]>(initialVideos);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [filename, setFilename] = useState('');
  const [fps, setFps] = useState('30');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchVideos = async () => {
    try {
      const res = await fetch(`/api/videos?projectId=${project.id}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch (e) {
      console.error('Failed to fetch videos', e);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsUploading(true);

    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('projectId', project.id);
        formData.append('file', selectedFile);
        formData.append('fps', fps);

        const res = await fetch('/api/videos', {
          method: 'POST',
          body: formData,
        });
        if (res.ok) {
          setShowUploadModal(false);
          setSelectedFile(null);
          setFilename('');
          await fetchVideos();
        }
      } else if (filename.trim()) {
        const res = await fetch('/api/videos', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: project.id,
            filename: filename.trim(),
            fps: parseFloat(fps) || 30,
            totalFrames: 45,
          }),
        });
        if (res.ok) {
          setShowUploadModal(false);
          setFilename('');
          await fetchVideos();
        }
      }
    } catch (error) {
      console.error('Failed to upload video', error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteVideo = async (videoId: string) => {
    if (!confirm('Are you sure you want to delete this video and its frames?')) return;
    setDeletingId(videoId);
    try {
      const res = await fetch(`/api/videos?id=${videoId}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setVideos((prev) => prev.filter((v) => v.id !== videoId));
      }
    } catch (e) {
      console.error('Failed to delete video', e);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8 border-b border-gray-800 pb-6">
          <Link href="/" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-white mb-6 transition-colors group">
            <ArrowLeft size={16} className="group-hover:-translate-x-0.5 transition-transform" />
            Back to Dashboard
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <FolderGit2 className="text-blue-500" />
                {project.name}
              </h1>
              {project.githubUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={project.githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full transition-colors"
                  >
                    <GitBranch size={13} />
                    <span>{project.githubUrl}</span>
                    <ExternalLink size={11} className="opacity-70" />
                  </a>
                </div>
              )}
            </div>

            <Link
              href={`/project/${project.id}/annotate`}
              className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-5 py-2.5 rounded-xl font-medium text-sm shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
            >
              <Edit3 size={16} />
              Open Annotator (Canvas & Hotkeys)
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-2">
            <nav className="flex flex-col gap-2">
              <Link
                href={`/project/${project.id}`}
                className="bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-all"
              >
                <Video size={18} />
                Videos
              </Link>
              <Link
                href={`/project/${project.id}/dataset`}
                className="text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors"
              >
                <Database size={18} />
                Dataset
              </Link>
              <Link
                href={`/project/${project.id}/settings`}
                className="text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors"
              >
                <Settings size={18} />
                Settings & Delete
              </Link>
            </nav>
          </div>

          <div className="md:col-span-3 bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-8">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-white">Video Feeds & Recordings</h2>
                <p className="text-xs text-gray-400 mt-0.5">Upload and process video files to extract dataset frames</p>
              </div>
              <button
                onClick={() => setShowUploadModal(true)}
                className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-semibold transition-all shadow-sm cursor-pointer"
              >
                <Plus size={14} />
                Upload Video
              </button>
            </div>

            {videos.length === 0 ? (
              <div className="text-center py-16 border border-dashed border-gray-800 rounded-xl bg-gray-950/60 p-6">
                <div className="w-14 h-14 bg-gray-900 rounded-xl flex items-center justify-center mx-auto mb-3 border border-gray-800 text-gray-600">
                  <Video size={28} />
                </div>
                <h3 className="text-base font-medium text-gray-300">No videos uploaded yet</h3>
                <p className="text-gray-500 mt-1 max-w-sm mx-auto text-xs leading-relaxed mb-4">
                  Upload your video file to extract frames and begin labeling annotations.
                </p>
                <button
                  onClick={() => setShowUploadModal(true)}
                  className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-medium cursor-pointer"
                >
                  <Plus size={14} /> Upload first video
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                {videos.map((vid) => (
                  <div
                    key={vid.id}
                    className="p-4 bg-gray-950 border border-gray-800/80 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-gray-700 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-indigo-950/50 border border-indigo-900/40 flex items-center justify-center text-indigo-400 shrink-0">
                        <Film size={20} />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-gray-200">{vid.filename}</h4>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{vid.fps} FPS</span>
                          <span>&bull;</span>
                          <span>{vid.totalFrames || 30} Frames extracted</span>
                          <span>&bull;</span>
                          <span className="text-green-400 font-medium flex items-center gap-1">
                            <CheckCircle2 size={11} /> Ready
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                      <Link
                        href={`/project/${project.id}/annotate`}
                        className="inline-flex items-center gap-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                      >
                        <Edit3 size={13} />
                        Annotate
                      </Link>
                      <button
                        onClick={() => handleDeleteVideo(vid.id)}
                        disabled={deletingId === vid.id}
                        className="text-gray-500 hover:text-red-400 p-2 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer disabled:opacity-50"
                        title="Delete video"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Upload Video Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-1">Upload Video Feed</h2>
              <p className="text-xs text-gray-400 mb-6">Select a video file or enter clip name to extract frames</p>

              <form onSubmit={handleUpload} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Select File (.mp4, .webm, .mov)
                  </label>
                  <input
                    type="file"
                    accept="video/*"
                    onChange={(e) => {
                      if (e.target.files?.[0]) {
                        setSelectedFile(e.target.files[0]);
                        setFilename(e.target.files[0].name);
                      }
                    }}
                    className="w-full text-xs text-gray-400 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Clip Name
                  </label>
                  <input
                    type="text"
                    required
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    placeholder="e.g. rally_clip_01.mp4"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">
                    Frame Rate (FPS)
                  </label>
                  <select
                    value={fps}
                    onChange={(e) => setFps(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="15">15 FPS (Fast Extraction)</option>
                    <option value="30">30 FPS (Standard)</option>
                    <option value="60">60 FPS (High Speed Tracking)</option>
                  </select>
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowUploadModal(false)}
                    disabled={isUploading}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!filename.trim() || isUploading}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isUploading && <Loader2 size={13} className="animate-spin" />}
                    {isUploading ? 'Extracting...' : 'Upload & Extract'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
