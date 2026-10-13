import React from 'react';

export default function Loading() {
  return (
    <div className="p-8 space-y-4">
      <div className="h-8 w-48 bg-neutral-200 animate-pulse rounded" />
      <div className="h-64 bg-neutral-100 animate-pulse rounded" />
    </div>
  );
}
