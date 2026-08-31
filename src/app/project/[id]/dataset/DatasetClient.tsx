'use client';

import { useState } from 'react';
import { 
  FolderGit2, Video, Database, Settings, ArrowLeft, GitBranch, 
  ExternalLink, Layers, Tag, Plus, Download, Check, Copy, Loader2, Sparkles
} from 'lucide-react';
import Link from 'next/link';

type ClassItem = {
  id: string;
  name: string;
  color: string;
};

type Project = {
  id: string;
  name: string;
  githubUrl: string | null;
};

export default function DatasetClient({
  project,
  initialClasses,
  totalFrames,
  totalAnnotations,
}: {
  project: Project;
  initialClasses: ClassItem[];
  totalFrames: number;
  totalAnnotations: number;
}) {
  const [classes, setClasses] = useState<ClassItem[]>(initialClasses);
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [newClassName, setNewClassName] = useState('');
  const [newClassColor, setNewClassColor] = useState('#818cf8');
  const [isAddingClass, setIsAddingClass] = useState(false);

  const [showExportModal, setShowExportModal] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [exportYaml, setExportYaml] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Splits
  const [trainSplit, setTrainSplit] = useState(70);
  const [valSplit, setValSplit] = useState(20);
  const testSplit = Math.max(0, 100 - trainSplit - valSplit);

  const handleAddClass = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;

    setIsAddingClass(true);
    try {
      const res = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newClassName.trim(), color: newClassColor }),
      });
      if (res.ok) {
        const data = await res.json();
        setClasses(data.classes || [...classes, data.class]);
        setShowAddClassModal(false);
        setNewClassName('');
      }
    } catch (e) {
      console.error('Failed to add class', e);
    } finally {
      setIsAddingClass(false);
    }
  };

  const handleExportYolo = async () => {
    setIsExporting(true);
    setShowExportModal(true);
    try {
      const res = await fetch(`/api/export?projectId=${project.id}&format=yolo`);
      if (res.ok) {
        const data = await res.json();
        setExportYaml(data.yamlContent || '');
      }
    } catch (e) {
      console.error('Failed to export dataset', e);
    } finally {
      setIsExporting(false);
    }
  };

  const copyYaml = () => {
    navigator.clipboard.writeText(exportYaml);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const COLOR_PRESETS = ['#38bdf8', '#818cf8', '#34d399', '#fbbf24', '#f87171', '#c084fc', '#fb923c'];

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
              Open Annotator
            </Link>
          </div>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="md:col-span-1 space-y-2">
            <nav className="flex flex-col gap-2">
              <Link
                href={`/project/${project.id}`}
                className="text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors"
              >
                <Video size={18} />
                Videos
              </Link>
              <Link
                href={`/project/${project.id}/dataset`}
                className="bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-all"
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

          <div className="md:col-span-3 space-y-6">
            {/* Top Action Bar */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-white">Dataset Annotations & Splits</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Manage labeled classes, split distributions, and YOLO export format</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleExportYolo}
                    className="inline-flex items-center gap-1.5 bg-gray-800 hover:bg-gray-700 active:bg-gray-800 text-gray-200 px-3.5 py-2 rounded-lg text-xs font-semibold transition-colors border border-gray-700 cursor-pointer"
                  >
                    <Download size={14} />
                    Export YOLO
                  </button>
                  <button
                    onClick={() => setShowAddClassModal(true)}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2 rounded-lg text-xs font-semibold transition-colors shadow-sm cursor-pointer"
                  >
                    <Plus size={14} />
                    Add Class
                  </button>
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Layers size={14} className="text-blue-400" />
                    <span>Total Frames</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{totalFrames}</div>
                </div>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Tag size={14} className="text-green-400" />
                    <span>Annotations</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{totalAnnotations}</div>
                </div>
                <div className="bg-gray-950 p-4 rounded-xl border border-gray-800/80">
                  <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                    <Database size={14} className="text-purple-400" />
                    <span>Active Classes</span>
                  </div>
                  <div className="text-2xl font-bold text-white">{classes.length}</div>
                </div>
              </div>

              {/* Dataset Splits Config */}
              <div className="p-4 bg-gray-950 rounded-xl border border-gray-800 mb-6">
                <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-3">Dataset Partition Splits</h3>
                <div className="flex items-center gap-4 text-xs">
                  <div className="flex-1">
                    <div className="flex justify-between text-gray-400 mb-1">
                      <span>Train: <strong className="text-indigo-400">{trainSplit}%</strong></span>
                      <span>Val: <strong className="text-emerald-400">{valSplit}%</strong></span>
                      <span>Test: <strong className="text-amber-400">{testSplit}%</strong></span>
                    </div>
                    <div className="h-2.5 rounded-full overflow-hidden flex bg-gray-800">
                      <div style={{ width: `${trainSplit}%` }} className="bg-indigo-500" />
                      <div style={{ width: `${valSplit}%` }} className="bg-emerald-500" />
                      <div style={{ width: `${testSplit}%` }} className="bg-amber-500" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Classes List */}
              <div>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Annotated Classes</h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {classes.map((cls, idx) => (
                    <div
                      key={cls.id}
                      className="flex items-center justify-between p-2.5 rounded-xl bg-gray-950 border border-gray-800/80 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: cls.color }}
                        />
                        <span className="font-semibold text-gray-200">{cls.name}</span>
                      </div>
                      <span className="text-[10px] font-mono text-gray-500 bg-gray-900 px-1.5 py-0.5 rounded border border-gray-800">
                        #{idx}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Add Class Modal */}
        {showAddClassModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-xl font-bold text-white mb-1">Add Dataset Class</h2>
              <p className="text-xs text-gray-400 mb-6">Create a new label class for bounding box annotations</p>

              <form onSubmit={handleAddClass} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Class Name</label>
                  <input
                    type="text"
                    required
                    value={newClassName}
                    onChange={(e) => setNewClassName(e.target.value)}
                    placeholder="e.g. PingPongBall, Paddle, Player"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-white placeholder-gray-600 text-xs focus:outline-none focus:border-indigo-500"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Class Color Tag</label>
                  <div className="flex items-center gap-2 mb-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => setNewClassColor(c)}
                        className={`w-7 h-7 rounded-full border-2 transition-transform cursor-pointer ${
                          newClassColor === c ? 'scale-110 border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <input
                    type="color"
                    value={newClassColor}
                    onChange={(e) => setNewClassColor(e.target.value)}
                    className="w-full h-8 bg-gray-950 border border-gray-800 rounded-lg cursor-pointer"
                  />
                </div>

                <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowAddClassModal(false)}
                    disabled={isAddingClass}
                    className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newClassName.trim() || isAddingClass}
                    className="inline-flex items-center gap-1.5 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2 rounded-lg font-medium text-xs transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {isAddingClass && <Loader2 size={13} className="animate-spin" />}
                    {isAddingClass ? 'Adding...' : 'Add Class'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Export YOLO Modal */}
        {showExportModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 max-w-lg w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Sparkles size={20} className="text-indigo-400" />
                  YOLO Dataset Export
                </h2>
                <button
                  onClick={() => setShowExportModal(false)}
                  className="text-gray-400 hover:text-white text-xs px-2 py-1 bg-gray-800 rounded"
                >
                  Close
                </button>
              </div>
              <p className="text-xs text-gray-400 mb-4">
                Configuration file generated for Ultralytics YOLOv8/YOLOv11 model training.
              </p>

              {isExporting ? (
                <div className="py-12 flex flex-col items-center justify-center text-gray-400 gap-2">
                  <Loader2 size={24} className="animate-spin text-indigo-500" />
                  <span className="text-xs">Generating data.yaml...</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <pre className="p-4 bg-gray-950 border border-gray-800 rounded-xl text-xs font-mono text-gray-300 overflow-x-auto max-h-60">
                      {exportYaml}
                    </pre>
                    <button
                      onClick={copyYaml}
                      className="absolute top-3 right-3 bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-gray-700"
                    >
                      {copied ? <Check size={13} className="text-green-400" /> : <Copy size={13} />}
                      {copied ? 'Copied' : 'Copy YAML'}
                    </button>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <a
                      href={`data:text/yaml;charset=utf-8,${encodeURIComponent(exportYaml)}`}
                      download="data.yaml"
                      className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Download size={14} /> Download data.yaml
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
