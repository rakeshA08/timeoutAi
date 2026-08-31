'use client';

import { useState, useEffect } from 'react';
import { FolderGit2, Plus, GitBranch, Clock, Trash2, AlertTriangle, ExternalLink, Loader2 } from 'lucide-react';
import Link from 'next/link';

type Project = {
  id: string;
  name: string;
  githubUrl: string | null;
  createdAt: string;
};

export default function Dashboard() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectGithub, setNewProjectGithub] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [projectToDelete, setProjectToDelete] = useState<Project | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchProjects();
  }, []);

  const fetchProjects = async () => {
    try {
      const res = await fetch('/api/projects');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
      }
    } catch (error) {
      console.error('Failed to fetch projects', error);
    } finally {
      setLoading(false);
    }
  };

  const createProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName.trim(), githubUrl: newProjectGithub.trim() }),
      });
      if (res.ok) {
        setShowCreateModal(false);
        setNewProjectName('');
        setNewProjectGithub('');
        await fetchProjects();
      }
    } catch (error) {
      console.error('Failed to create project', error);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!projectToDelete) return;

    setIsDeleting(true);
    try {
      const res = await fetch(`/api/projects?id=${encodeURIComponent(projectToDelete.id)}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== projectToDelete.id));
        setProjectToDelete(null);
      } else {
        const errorData = await res.json();
        alert(errorData.error || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Failed to delete project', error);
      alert('Failed to delete project');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-6 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-10 border-b border-gray-800 pb-6">
          <div>
            <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400 flex items-center gap-3">
              <FolderGit2 className="text-blue-500 w-8 h-8" />
              CV Studio
            </h1>
            <p className="text-gray-400 mt-1 text-sm">Local-First Computer Vision Platform & Repository Hub</p>
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 px-4 py-2.5 rounded-lg font-medium shadow-lg shadow-indigo-600/20 transition-all cursor-pointer"
          >
            <Plus size={18} />
            New Project
          </button>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 text-gray-400 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-sm">Loading repositories...</p>
          </div>
        ) : projects.length === 0 ? (
          <div className="text-center py-20 border border-dashed border-gray-800 rounded-2xl bg-gray-900/40 p-8">
            <div className="w-16 h-16 bg-gray-800/80 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-gray-700/50">
              <FolderGit2 size={32} className="text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-200">No repositories or projects yet</h2>
            <p className="text-gray-400 mt-2 max-w-md mx-auto text-sm leading-relaxed">
              Create a project to connect your GitHub repository, upload video clips, extract frames, and manage annotated datasets.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-6 inline-flex items-center gap-2 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-5 py-2.5 rounded-lg font-medium transition-all cursor-pointer"
            >
              <Plus size={16} />
              Create your first project
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-gray-900/90 border border-gray-800/90 rounded-xl p-6 hover:border-indigo-500/60 transition-all hover:shadow-[0_4px_24px_rgba(79,70,229,0.12)] group flex flex-col justify-between relative"
              >
                <div>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <Link
                      href={`/project/${project.id}`}
                      className="text-lg font-semibold text-gray-100 group-hover:text-indigo-400 transition-colors flex-1 hover:underline"
                    >
                      {project.name}
                    </Link>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setProjectToDelete(project);
                      }}
                      title="Delete Repository"
                      className="text-gray-500 hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/10 transition-colors cursor-pointer"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>

                  {project.githubUrl ? (
                    <a
                      href={project.githubUrl}
                      target="_blank"
                      rel="noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 bg-indigo-950/50 border border-indigo-900/40 px-2.5 py-1 rounded-md mb-4 max-w-full truncate group/gh"
                    >
                      <GitBranch size={12} className="shrink-0" />
                      <span className="truncate">{project.githubUrl.replace(/^https?:\/\/(www\.)?github\.com\//, '')}</span>
                      <ExternalLink size={10} className="shrink-0 opacity-70 group-hover/gh:opacity-100" />
                    </a>
                  ) : (
                    <div className="text-xs text-gray-500 mb-4 italic">No GitHub repo linked</div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-800/80 text-xs text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <Clock size={12} />
                    <span>{new Date(project.createdAt).toLocaleDateString()}</span>
                  </div>
                  <Link
                    href={`/project/${project.id}`}
                    className="text-xs font-medium text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    Open Workspace &rarr;
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Create Project Modal */}
        {showCreateModal && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <h2 className="text-2xl font-bold mb-2 text-white">Create New Project</h2>
              <p className="text-sm text-gray-400 mb-6">Initialize a vision dataset workspace and link your repository.</p>
              
              <form onSubmit={createProject} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    Project / Dataset Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={newProjectName}
                    onChange={(e) => setNewProjectName(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    placeholder="e.g. Table Tennis Tracking"
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1.5">
                    GitHub Repository URL <span className="text-gray-500 text-xs">(Optional)</span>
                  </label>
                  <input
                    type="url"
                    value={newProjectGithub}
                    onChange={(e) => setNewProjectGithub(e.target.value)}
                    className="w-full bg-gray-950 border border-gray-800 rounded-lg px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm"
                    placeholder="https://github.com/username/repository"
                  />
                </div>
                <div className="flex justify-end gap-3 mt-8 pt-4 border-t border-gray-800">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    disabled={submitting}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={!newProjectName.trim() || submitting}
                    className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg font-medium text-sm transition-all disabled:opacity-50 cursor-pointer"
                  >
                    {submitting && <Loader2 size={14} className="animate-spin" />}
                    {submitting ? 'Creating...' : 'Create Project'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {projectToDelete && (
          <div className="fixed inset-0 bg-black/75 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-gray-900 border border-red-900/40 rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl animate-in fade-in zoom-in-95 duration-150">
              <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 flex items-center justify-center mb-4">
                <AlertTriangle size={24} />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Delete Repository / Project?</h2>
              <p className="text-sm text-gray-300 mb-4">
                Are you sure you want to remove <span className="font-semibold text-white">"{projectToDelete.name}"</span>?
              </p>
              <p className="text-xs text-gray-400 mb-6 bg-gray-950 p-3 rounded-lg border border-gray-800">
                This action will delete the project record and associated video/annotation references from the database.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setProjectToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteProject}
                  disabled={isDeleting}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 text-white px-5 py-2 rounded-lg font-medium text-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isDeleting && <Loader2 size={14} className="animate-spin" />}
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
