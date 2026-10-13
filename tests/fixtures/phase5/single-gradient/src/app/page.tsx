import React from 'react';

export default function SingleGradientPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <header className="mb-8">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-indigo-400 bg-clip-text text-transparent">
          Account Settings
        </h1>
        <p className="text-slate-400 mt-2">Manage your preferences and profile details.</p>
      </header>
      <main className="max-w-xl space-y-4">
        <div className="p-4 rounded-lg bg-slate-900 border border-slate-800">
          <label className="block text-sm font-medium mb-1">Display Name</label>
          <input
            type="text"
            defaultValue="Alex Rivers"
            className="w-full px-3 py-2 rounded bg-slate-800 border border-slate-700 text-sm"
          />
        </div>
      </main>
    </div>
  );
}
