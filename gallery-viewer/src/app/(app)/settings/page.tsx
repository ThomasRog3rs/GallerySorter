"use client";

import { FormEvent, useEffect, useState } from "react";
import { useGallery } from "@/components/GalleryContext";

export default function SettingsPage() {
  const { photoRoot, refreshConfig } = useGallery();

  const [inputValue, setInputValue] = useState("");
  const [savedRoot, setSavedRoot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    setInputValue(photoRoot ?? "");
    setSavedRoot(photoRoot);
  }, [photoRoot]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoRoot: inputValue }),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Failed to save configuration.");

      setSavedRoot(data.photoRoot ?? null);
      setStatusMessage("Photo directory saved successfully.");
      await refreshConfig();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save configuration.");
    }
  }

  return (
    <div className="settingsPage">
      <h1 className="settingsPageTitle">Settings</h1>
      <p className="settingsPageDescription">
        Configure where your sorted photos are stored on disk.
      </p>

      <div className="settingsCard">
        <h2 className="settingsCardTitle">Photo directory</h2>
        <p className="settingsCardDescription">
          The root folder that contains year/month sub-folders with your photos.
        </p>

        <form className="settingsForm" onSubmit={handleSave}>
          <label htmlFor="photoRoot" className="srOnly">Photo directory path</label>
          <input
            id="photoRoot"
            type="text"
            placeholder="/Users/you/Pictures/Sorted"
            value={inputValue}
            onChange={(event) => setInputValue(event.target.value)}
          />
          <button type="submit" className="primaryButton">
            Save
          </button>
        </form>

        {savedRoot && (
          <p className="currentPath">
            Current: <span className="currentPathValue">{savedRoot}</span>
          </p>
        )}

        {statusMessage && <p className="successMessage">{statusMessage}</p>}
        {errorMessage && <p className="errorMessage">{errorMessage}</p>}
      </div>
    </div>
  );
}
