import Link from 'next/link';
import { FolderGit2, ArrowLeft, Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        <div className="w-16 h-16 bg-indigo-950/60 border border-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 text-indigo-400">
          <FolderGit2 size={32} />
        </div>
        <div className="inline-block px-3 py-1 bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold rounded-full mb-3 uppercase tracking-wider">
          404 Not Found
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">Project / Page Not Found</h1>
        <p className="text-gray-400 text-sm mb-8 leading-relaxed">
          The requested repository, project, or page does not exist or may have been deleted.
        </p>
        <div className="flex justify-center gap-4">
          <Link
            href="/"
            className="inline-flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white px-5 py-2.5 rounded-lg font-medium text-sm transition-all shadow-lg shadow-indigo-600/20"
          >
            <Home size={16} />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
