"use client";

import { FormEvent, useEffect, useState } from "react";

type ConfigResponse = {
  photoRoot: string | null;
  error?: string;
};

type YearsResponse = {
  years?: string[];
  error?: string;
};

type MonthsResponse = {
  months?: string[];
  error?: string;
};

type Photo = {
  name: string;
  url: string;
};

type PhotosResponse = {
  photos?: Photo[];
  error?: string;
};

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

function monthLabel(year: string, month: string): string {
  const index = Number(month);
  if (!Number.isInteger(index) || index < 1 || index > 12) {
    return `${year}-${month}`;
  }

  const date = new Date(Number(year), index - 1, 1);
  return `${monthFormatter.format(date)} ${year}`;
}

export default function Home() {
  const [photoRoot, setPhotoRoot] = useState("");
  const [savedRoot, setSavedRoot] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [years, setYears] = useState<string[]>([]);
  const [selectedYear, setSelectedYear] = useState<string | null>(null);

  const [months, setMonths] = useState<string[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);

  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);

  const isConfigured = Boolean(savedRoot);

  async function loadConfig() {
    const response = await fetch("/api/config", { cache: "no-store" });
    const data = (await response.json()) as ConfigResponse;
    setSavedRoot(data.photoRoot ?? null);
    setPhotoRoot(data.photoRoot ?? "");
  }

  async function loadYears() {
    setLoadingGallery(true);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/years", { cache: "no-store" });
      const data = (await response.json()) as YearsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load years.");
      }

      setYears(data.years ?? []);
      // Instead of auto-selecting, we stay at the years level
      setSelectedYear(null);
      setSelectedMonth(null);
      setMonths([]);
      setPhotos([]);
    } catch (error) {
      setYears([]);
      setSelectedYear(null);
      setMonths([]);
      setSelectedMonth(null);
      setPhotos([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load years.");
    } finally {
      setLoadingGallery(false);
    }
  }

  async function loadMonths(year: string) {
    setLoadingGallery(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/years/${year}/months`, { cache: "no-store" });
      const data = (await response.json()) as MonthsResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load months.");
      }

      setMonths(data.months ?? []);
      // Instead of auto-selecting, we stay at the months level
      setSelectedMonth(null);
      setPhotos([]);
    } catch (error) {
      setMonths([]);
      setSelectedMonth(null);
      setPhotos([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load months.");
    } finally {
      setLoadingGallery(false);
    }
  }

  async function loadPhotos(year: string, month: string) {
    setLoadingGallery(true);
    setErrorMessage(null);

    try {
      const response = await fetch(`/api/years/${year}/months/${month}/photos`, { cache: "no-store" });
      const data = (await response.json()) as PhotosResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to load photos.");
      }

      setPhotos(data.photos ?? []);
    } catch (error) {
      setPhotos([]);
      setErrorMessage(error instanceof Error ? error.message : "Failed to load photos.");
    } finally {
      setLoadingGallery(false);
    }
  }

  useEffect(() => {
    loadConfig().catch(() => setErrorMessage("Failed to read current configuration."));
  }, []);

  useEffect(() => {
    if (!isConfigured) {
      return;
    }

    loadYears().catch(() => setErrorMessage("Failed to load gallery years."));
  }, [isConfigured]);

  useEffect(() => {
    if (!selectedYear || !isConfigured) {
      return;
    }

    loadMonths(selectedYear).catch(() => setErrorMessage("Failed to load months."));
  }, [isConfigured, selectedYear]);

  useEffect(() => {
    if (!selectedYear || !selectedMonth || !isConfigured) {
      return;
    }

    loadPhotos(selectedYear, selectedMonth).catch(() => setErrorMessage("Failed to load photos."));
  }, [isConfigured, selectedMonth, selectedYear]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatusMessage(null);
    setErrorMessage(null);

    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ photoRoot }),
      });

      const data = (await response.json()) as ConfigResponse;
      if (!response.ok) {
        throw new Error(data.error ?? "Failed to save configuration.");
      }

      setSavedRoot(data.photoRoot ?? null);
      setStatusMessage("Photo directory saved.");
      await loadYears();
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Failed to save configuration.");
    }
  }

  return (
    <main className="appShell">
      <section className="card">
        <h1>Gallery Viewer</h1>
        <p className="muted">Connect your sorted photo directory and browse photos by year and month.</p>

        <form className="settingsForm" onSubmit={handleSave}>
          <label htmlFor="photoRoot">Photo directory</label>
          <input
            id="photoRoot"
            type="text"
            placeholder="/Users/you/Pictures/Sorted"
            value={photoRoot}
            onChange={(event) => setPhotoRoot(event.target.value)}
          />
          <button type="submit">Save</button>
        </form>

        {savedRoot && <p className="muted" style={{ marginTop: "0.5rem" }}>Current: {savedRoot}</p>}
        {statusMessage && <p className="success">{statusMessage}</p>}
        {errorMessage && <p className="error">{errorMessage}</p>}
      </section>

      {isConfigured && (
        <section className="card galleryLayout">
          <header className="navigationHeader">
            {!selectedYear && <h2>Years</h2>}
            
            {selectedYear && !selectedMonth && (
              <>
                <button className="secondaryButton" onClick={() => setSelectedYear(null)}>← Back to Years</button>
                <h2>{selectedYear}</h2>
              </>
            )}

            {selectedYear && selectedMonth && (
              <>
                <button className="secondaryButton" onClick={() => setSelectedMonth(null)}>← Back to Months</button>
                <h2>{selectedYear} / {monthLabel(selectedYear, selectedMonth)}</h2>
              </>
            )}
          </header>

          {!selectedYear && (
            <div className="listPanel">
              {years.length === 0 && !loadingGallery && <p className="muted">No year folders found.</p>}
              {loadingGallery && <p className="muted">Loading…</p>}
              <ul>
                {years.map((year) => (
                  <li key={year}>
                    <button
                      className="listButton"
                      onClick={() => {
                        setSelectedYear(year);
                        setSelectedMonth(null);
                        setPhotos([]);
                      }}
                      type="button"
                    >
                      {year}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedYear && !selectedMonth && (
            <div className="listPanel">
              {months.length === 0 && !loadingGallery && <p className="muted">No month folders found.</p>}
              {loadingGallery && <p className="muted">Loading…</p>}
              <ul>
                {months.map((month) => (
                  <li key={month}>
                    <button
                      className="listButton"
                      onClick={() => {
                        setSelectedMonth(month);
                        setPhotos([]);
                      }}
                      type="button"
                    >
                      {monthLabel(selectedYear, month)}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {selectedYear && selectedMonth && (
            <div className="photosPanel">
              {loadingGallery && <p className="muted">Loading…</p>}
              {!loadingGallery && photos.length === 0 && (
                <p className="muted">No photos found for this month.</p>
              )}

              <div className="photoGrid">
                {photos.map((photo) => (
                  <figure key={photo.url} className="photoCard">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={photo.url} alt={photo.name} loading="lazy" />
                    <figcaption>{photo.name}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
