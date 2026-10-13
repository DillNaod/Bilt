import React, { useState } from "react";

export function UploadModal() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    const data = new FormData();
    data.append("file", file);
    await fetch("/api/upload", { method: "POST", body: data });
    setUploading(false);
    setUploadSuccess(true);
  };

  return (
    <div>
      <input type="file" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      <button onClick={handleUpload} disabled={uploading}>
        {uploading ? "Uploading..." : "Upload"}
      </button>
      {uploadSuccess && <p>Upload completed!</p>}
    </div>
  );
}
