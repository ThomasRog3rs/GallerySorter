"use client";

import { FormEvent, useMemo, useState } from "react";
import { Upload } from "lucide-react";
import { useGallery } from "@/components/GalleryContext";

type UploadSuccess = {
  name: string;
  year: string;
  month: string;
};

type UploadError = {
  name: string;
  error: string;
};

const ACCEPTED_TYPES = [
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".heic",
  ".heif",
  ".bmp",
  ".tif",
  ".tiff",
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
].join(",");

export default function UploadPage() {
  const { configured, refreshGallery } = useGallery();
  const [files, setFiles] = useState<File[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<UploadSuccess[]>([]);
  const [failed, setFailed] = useState<UploadError[]>([]);

  const canSubmit = configured && files.length > 0 && !isUploading;

  const selectedSummary = useMemo(() => {
    if (files.length === 0) return "No files selected.";
    return `${files.length} file${files.length === 1 ? "" : "s"} selected.`;
  }, [files.length]);

  function onFileChange(nextFiles: FileList | null) {
    setStatusMessage(null);
    setErrorMessage(null);
    setUploaded([]);
    setFailed([]);
    setFiles(nextFiles ? Array.from(nextFiles) : []);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) return;

    setIsUploading(true);
    setStatusMessage("Uploading files...");
    setErrorMessage(null);
    setUploaded([]);
    setFailed([]);

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as {
        ok?: UploadSuccess[];
        errors?: UploadError[];
        error?: string;
      };

      if (!response.ok) {
        throw new Error(data.error ?? "Upload failed.");
      }

      const okItems = Array.isArray(data.ok) ? data.ok : [];
      const errorItems = Array.isArray(data.errors) ? data.errors : [];
      setUploaded(okItems);
      setFailed(errorItems);
      setStatusMessage(`Uploaded ${okItems.length} file${okItems.length === 1 ? "" : "s"}.`);
      await refreshGallery();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Upload failed.");
      setStatusMessage(null);
    } finally {
      setIsUploading(false);
    }
  }

  if (!configured) {
    return (
      <div className="settingsPage">
        <h1 className="settingsPageTitle">Bulk Upload</h1>
        <p className="settingsPageDescription">
          Configure your photo directory in Settings before uploading files.
        </p>
      </div>
    );
  }

  return (
    <div className="uploadPage">
      <h1 className="settingsPageTitle">Bulk Upload</h1>
      <p className="settingsPageDescription">
        Upload images and videos. Files are sorted into year/month folders using the earliest
        available metadata, creation, or modified date.
      </p>

      <div className="settingsCard">
        <h2 className="settingsCardTitle">Select files</h2>
        <p className="settingsCardDescription">
          Accepted formats: images and videos supported by the gallery.
        </p>

        <form className="uploadForm" onSubmit={handleSubmit}>
          <label htmlFor="bulkUploadFiles" className="primaryButton uploadPicker">
            <Upload size={16} />
            Choose files
          </label>
          <input
            id="bulkUploadFiles"
            type="file"
            className="srOnly"
            multiple
            accept={ACCEPTED_TYPES}
            onChange={(event) => onFileChange(event.target.files)}
          />

          <p className="currentPath">{selectedSummary}</p>

          <button type="submit" className="primaryButton" disabled={!canSubmit}>
            {isUploading ? "Uploading..." : "Upload"}
          </button>
        </form>

        {statusMessage && <p className="successMessage">{statusMessage}</p>}
        {errorMessage && <p className="errorMessage">{errorMessage}</p>}

        {uploaded.length > 0 && (
          <div className="uploadResults">
            <h3 className="uploadResultsTitle">Uploaded</h3>
            <ul className="uploadResultsList">
              {uploaded.map((item) => (
                <li key={`${item.name}-${item.year}-${item.month}`}>
                  {item.name} uploaded to {item.year}/{item.month}
                </li>
              ))}
            </ul>
          </div>
        )}

        {failed.length > 0 && (
          <div className="uploadResults">
            <h3 className="uploadResultsTitle">Failed</h3>
            <ul className="uploadResultsList">
              {failed.map((item) => (
                <li key={`${item.name}-${item.error}`}>
                  {item.name}: {item.error}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
