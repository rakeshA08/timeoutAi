'use client';

import { useState } from 'react';
import { 
  FolderGit2, Video, Database, Settings, ArrowLeft, GitBranch, 
  ExternalLink, Trash2, AlertTriangle, Loader2, Save, CheckCircle2, RefreshCw
} from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

type Project = {
  id: string;
  name: string;
  githubUrl: string | null;
  createdAt: Date | string;
};

export default function SettingsClient({ project }: { project: Project }) {
  const router = useRouter();
  const [name, setName] = useState(project.name);
  const [githubUrl, setGithubUrl] = useState(project.githubUrl || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: project.id,
          name: name.trim(),
          githubUrl: githubUrl.trim() || null,
        }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2500);
        router.refresh();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to update project');
      }
    } catch (e) {
      console.error('Failed to update project', e);
      alert('Failed to update project');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(project.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        router.push('/');
        router.refresh();
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete project');
        setIsDeleting(false);
      }
    } catch (error) {
      console.error('Failed to delete project', error);
      alert('Failed to delete project');
      setIsDeleting(false);
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
                {name}
              </h1>
              {githubUrl && (
                <div className="mt-2 flex items-center gap-2">
                  <a
                    href={githubUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-gray-900 border border-gray-800 px-3 py-1 rounded-full transition-colors"
                  >
                    <GitBranch size={13} />
                    <span>{githubUrl}</span>
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
                className="text-gray-400 hover:bg-gray-900 hover:text-gray-200 border border-transparent px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-colors"
              >
                <Database size={18} />
                Dataset
              </Link>
              <Link
                href={`/project/${project.id}/settings`}
                className="bg-indigo-600/15 text-indigo-400 border border-indigo-500/30 px-4 py-3 rounded-xl flex items-center gap-3 font-medium transition-all"
              >
                <Settings size={18} />
                Settings & Delete
              </Link>
            </nav>
          </div>

          <div className="md:col-span-3 space-y-6">
            {/* Project Overview & Edit Card */}
            <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-xl font-semibold text-white">Project & Repository Settings</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Edit project title, linked GitHub repository, and identifiers</p>
                </div>
                {saveSuccess && (
                  <span className="text-xs text-green-400 font-medium flex items-center gap-1 bg-green-950/50 border border-green-500/30 px-3 py-1.5 rounded-lg animate-in fade-in">
                    <CheckCircle2 size={13} /> Saved successfully!
                  </span>
                )}
              </div>

              <form onSubmit={handleSaveChanges} className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">Project Name</label>
                  <input
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-300 mb-1.5">GitHub Repository URL</label>
                  <input
                    type="url"
                    value={githubUrl}
                    onChange={(e) => setGithubUrl(e.target.value)}
                    placeholder="https://github.com/username/repo"
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3.5 py-2 text-white text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Internal Project ID</label>
                  <div className="text-xs font-mono text-gray-500 bg-gray-950 px-3.5 py-2 rounded-lg border border-gray-800 select-all">
                    {project.id}
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    disabled={isSaving || !name.trim()}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 text-white px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 cursor-pointer shadow-sm"
                  >
                    {isSaving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                    {isSaving ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </form>
            </div>

            {/* Danger Zone Card */}
            <div className="bg-gray-900/80 border border-red-900/40 rounded-2xl p-6 sm:p-8">
              <div className="flex items-center gap-2.5 text-red-400 mb-1">
                <AlertTriangle size={18} />
                <h2 className="text-lg font-semibold">Danger Zone</h2>
              </div>
              <p className="text-xs text-gray-400 mb-6">
                Irreversible actions for this repository and dataset workspace.
              </p>

              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-4 rounded-xl bg-red-950/20 border border-red-900/30">
                <div>
                  <h3 className="text-sm font-medium text-gray-200">Delete this Repository / Project</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Once deleted, this project and its database records cannot be recovered.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(true)}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white px-4 py-2 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 shadow-sm"
                >
                  <Trash2 size={14} />
                  Delete Project
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Delete Confirmation Modal */}
        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-900/40 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Project Permanently?</h2>
              <p className="text-sm text-gray-300 mb-4">
                Are you sure you want to remove <span className="font-semibold text-white">"{project.name}"</span>?
              </p>
              <p className="text-xs text-gray-400 mb-6 bg-gray-950 p-3 rounded-lg border border-gray-800">
                This will delete the project record and its associated video metadata and frame annotations.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteModal(false)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg font-medium text-xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && <Loader2 size={13} className="animate-spin" />}
                  {isDeleting ? 'Deleting...' : 'Delete Project'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
