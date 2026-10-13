import React, { useState } from 'react';

interface Project {
  id: string;
  name: string;
  status: string;
}

export default function DashboardPage({
  projects,
  isLoading,
  error,
}: {
  projects?: Project[];
  isLoading?: boolean;
  error?: Error;
}) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 1. Loading state
  if (isLoading) {
    return (
      <div className="p-8 space-y-4">
        <div className="h-8 w-48 bg-neutral-200 animate-pulse rounded" />
        <div className="h-32 bg-neutral-100 animate-pulse rounded" />
      </div>
    );
  }

  // 2. Error state with retry
  if (error) {
    return (
      <div className="p-8 text-center" role="alert">
        <h2 className="text-xl font-bold text-red-600">Failed to load projects</h2>
        <p className="text-neutral-600 mt-2">{error.message}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  // 3. Empty state
  if (!projects || projects.length === 0) {
    return (
      <div className="p-12 text-center border rounded-lg bg-neutral-50">
        <h3 className="text-lg font-semibold text-neutral-800">No projects found</h3>
        <p className="text-sm text-neutral-500 mt-1">Get started by creating your first workspace project.</p>
        <a
          href="/dashboard/new"
          className="mt-4 inline-block px-4 py-2 bg-blue-600 text-white rounded font-medium"
        >
          Create Project
        </a>
      </div>
    );
  }

  // 4. Loaded state
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold mb-6">Projects</h1>
      <table className="min-w-full divide-y divide-neutral-200">
        <thead>
          <tr>
            <th className="text-left text-xs font-medium text-neutral-500 uppercase">Name</th>
            <th className="text-left text-xs font-medium text-neutral-500 uppercase">Status</th>
            <th className="text-right text-xs font-medium text-neutral-500 uppercase">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {projects.map((p) => (
            <tr key={p.id}>
              <td className="py-3 text-sm font-medium">{p.name}</td>
              <td className="py-3 text-sm">{p.status}</td>
              <td className="py-3 text-right">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedId(p.id);
                    setShowDeleteConfirm(true);
                  }}
                  className="text-red-600 hover:text-red-800 text-sm font-medium"
                >
                  Delete
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Confirmation modal for destructive action */}
      {showDeleteConfirm && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 bg-black/50 flex items-center justify-center p-4"
        >
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-bold">Confirm Deletion</h3>
            <p className="text-sm text-neutral-600 mt-2">
              Are you sure you want to delete project {selectedId}? This action cannot be undone.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 border rounded"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Delete permanently
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
