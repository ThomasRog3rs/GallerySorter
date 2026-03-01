"use client";

import {
  FormEvent,
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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

type MediaItem = {
  name: string;
  url: string;
  type: "image" | "video";
};

type PhotosResponse = {
  photos?: MediaItem[];
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

  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [loadingGallery, setLoadingGallery] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

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

  const closeLightbox = useCallback(() => {
    setLightboxOpen(false);
  }, []);

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxOpen(true);
  }

  const hasMedia = photos.length > 0;
  const activeMedia = useMemo(() => {
    if (!hasMedia) {
      return null;
    }

    const safeIndex = ((lightboxIndex % photos.length) + photos.length) % photos.length;
    return photos[safeIndex];
  }, [hasMedia, lightboxIndex, photos]);

  const showNext = useCallback(() => {
    if (!hasMedia) {
      return;
    }

    setLightboxIndex((prev) => (prev + 1) % photos.length);
  }, [hasMedia, photos.length]);

  const showPrevious = useCallback(() => {
    if (!hasMedia) {
      return;
    }

    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [hasMedia, photos.length]);

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

  useEffect(() => {
    if (!lightboxOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeLightbox();
      } else if (event.key === "ArrowRight") {
        showNext();
      } else if (event.key === "ArrowLeft") {
        showPrevious();
      } else if (event.key === "Tab" && lightboxRef.current) {
        const focusable = lightboxRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) {
          return;
        }

        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        const active = document.activeElement as HTMLElement | null;

        if (event.shiftKey && active === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && active === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };

    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      lastFocusedRef.current?.focus();
    };
  }, [closeLightbox, lightboxOpen, showNext, showPrevious]);

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
                        setLightboxOpen(false);
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
                        setLightboxOpen(false);
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
                {photos.map((photo, index) => (
                  <figure key={photo.url} className="photoCard">
                    <button
                      className="mediaCardButton"
                      type="button"
                      onClick={() => openLightbox(index)}
                      aria-label={`Open ${photo.name}`}
                    >
                      {photo.type === "image" ? (
                        <>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={photo.url} alt={photo.name} loading="lazy" />
                        </>
                      ) : (
                        <div className="videoThumb" aria-hidden="true">
                          <span className="videoBadge">Video</span>
                        </div>
                      )}
                    </button>
                    <figcaption>{photo.name}</figcaption>
                  </figure>
                ))}
              </div>
            </div>
          )}
        </section>
      )}
      {lightboxOpen && activeMedia && (
        <div
          ref={lightboxRef}
          className="lightboxOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Viewer for ${activeMedia.name}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              closeLightbox();
            }
          }}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Escape") {
              closeLightbox();
            }
          }}
        >
          <button
            ref={closeButtonRef}
            className="lightboxClose"
            type="button"
            onClick={closeLightbox}
            aria-label="Close viewer"
          >
            ×
          </button>
          {photos.length > 1 && (
            <>
              <button
                className="lightboxNav lightboxNavPrev"
                type="button"
                onClick={showPrevious}
                aria-label="Previous item"
              >
                ‹
              </button>
              <button
                className="lightboxNav lightboxNavNext"
                type="button"
                onClick={showNext}
                aria-label="Next item"
              >
                ›
              </button>
            </>
          )}
          <div className="lightboxContent">
            {activeMedia.type === "image" ? (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="lightboxImage" src={activeMedia.url} alt={activeMedia.name} />
              </>
            ) : (
              <video key={activeMedia.url} className="lightboxVideo" src={activeMedia.url} controls autoPlay />
            )}
            <p className="lightboxCaption">{activeMedia.name}</p>
          </div>
        </div>
      )}
    </main>
  );
}
