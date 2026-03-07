"use client";

import {
  KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ImageIcon, Settings, Trash2 } from "lucide-react";
import Link from "next/link";
import { useGallery } from "@/components/GalleryContext";

const monthFormatter = new Intl.DateTimeFormat(undefined, { month: "long" });

function monthLabel(year: string, month: string): string {
  const index = Number(month);
  if (!Number.isInteger(index) || index < 1 || index > 12) return `${year}-${month}`;
  return `${monthFormatter.format(new Date(Number(year), index - 1, 1))} ${year}`;
}

function formatTakenDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

export default function GalleryPage() {
  const {
    configured,
    siteName,
    photos,
    thisWeekPhotos,
    throughYearsScope,
    selectedYear,
    selectedMonth,
    loadingPhotos,
    loadingThisWeekPhotos,
    error,
    deletingFileName,
    deletePhoto,
    setThroughYearsScope,
  } = useGallery();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxSelectionKey, setLightboxSelectionKey] = useState("");
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const showingThroughYears = !selectedMonth;
  const displayedMedia = showingThroughYears ? thisWeekPhotos : photos;
  const isLoadingMedia = showingThroughYears ? loadingThisWeekPhotos : loadingPhotos;
  const selectionKey = `${selectedYear ?? "none"}:${selectedMonth ?? "none"}`;
  const hasMedia = displayedMedia.length > 0;
  const canShowLightbox = lightboxOpen && lightboxSelectionKey === selectionKey;

  const activeMedia = useMemo(() => {
    if (!hasMedia) return null;
    const safeIndex = ((lightboxIndex % displayedMedia.length) + displayedMedia.length) % displayedMedia.length;
    return displayedMedia[safeIndex];
  }, [displayedMedia, hasMedia, lightboxIndex]);

  const throughYearsByYear = useMemo(() => {
    if (!showingThroughYears) return [];

    const groups = new Map<string, typeof thisWeekPhotos>();
    for (const photo of thisWeekPhotos) {
      const existing = groups.get(photo.year);
      if (existing) {
        existing.push(photo);
      } else {
        groups.set(photo.year, [photo]);
      }
    }

    return Array.from(groups.entries()).sort(([yearA], [yearB]) => Number(yearB) - Number(yearA));
  }, [showingThroughYears, thisWeekPhotos]);

  const closeLightbox = useCallback(() => setLightboxOpen(false), []);

  const handleDelete = useCallback(
    async (fileName: string): Promise<boolean> => {
      const confirmed = window.confirm(
        `Delete "${fileName}"?\n\nThis action cannot be undone.`,
      );

      if (!confirmed) {
        return false;
      }

      await deletePhoto(fileName);
      return true;
    },
    [deletePhoto],
  );

  function openLightbox(index: number) {
    setLightboxIndex(index);
    setLightboxSelectionKey(selectionKey);
    setLightboxOpen(true);
  }

  const showNext = useCallback(() => {
    if (!hasMedia) return;
    setLightboxIndex((prev) => (prev + 1) % displayedMedia.length);
  }, [displayedMedia.length, hasMedia]);

  const showPrevious = useCallback(() => {
    if (!hasMedia) return;
    setLightboxIndex((prev) => (prev - 1 + displayedMedia.length) % displayedMedia.length);
  }, [displayedMedia.length, hasMedia]);

  useEffect(() => {
    if (!lightboxOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeLightbox();
      else if (event.key === "ArrowRight") showNext();
      else if (event.key === "ArrowLeft") showPrevious();
      else if (event.key === "Tab" && lightboxRef.current) {
        const focusable = lightboxRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (focusable.length === 0) return;
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

  if (!configured) {
    return (
      <div className="emptyState">
        <ImageIcon className="emptyStateIcon" />
        <h2 className="emptyStateTitle">Welcome to {siteName}</h2>
        <p className="emptyStateDescription">
          Set your photo directory to start browsing your memories.
        </p>
        <Link href="/settings" className="primaryButton">
          <Settings size={16} />
          Open Settings
        </Link>
      </div>
    );
  }

  return (
    <>
      <header className="galleryHeader">
        <div className="galleryHeaderTopRow">
          <h1 className="galleryHeaderTitle">
            {showingThroughYears
              ? throughYearsScope === "today"
                ? "Today through the years"
                : "This week through the years"
              : monthLabel(selectedYear ?? "", selectedMonth)}
          </h1>
          {showingThroughYears && (
            <div className="throughYearsScope">
              <button
                className={`scopeButton ${throughYearsScope === "today" ? "scopeButtonActive" : ""}`}
                type="button"
                onClick={() => setThroughYearsScope("today")}
                aria-pressed={throughYearsScope === "today"}
              >
                Today
              </button>
              <button
                className={`scopeButton ${throughYearsScope === "week" ? "scopeButtonActive" : ""}`}
                type="button"
                onClick={() => setThroughYearsScope("week")}
                aria-pressed={throughYearsScope === "week"}
              >
                This week
              </button>
            </div>
          )}
        </div>

        {!isLoadingMedia && (
          <p className="galleryHeaderCount">
            {displayedMedia.length} {displayedMedia.length === 1 ? "item" : "items"}
          </p>
        )}
      </header>

      {error && <p className="errorMessage">{error}</p>}

      {isLoadingMedia && (
        <div className="loadingState">
          <span className="spinner" />
          Loading photos…
        </div>
      )}

      {!isLoadingMedia && displayedMedia.length === 0 && (
        <div className="emptyState" style={{ minHeight: "40vh" }}>
          <ImageIcon className="emptyStateIcon" />
          <h2 className="emptyStateTitle">
            {showingThroughYears
              ? throughYearsScope === "today"
                ? "No photos from today"
                : "No photos from this week"
              : "No photos"}
          </h2>
          <p className="emptyStateDescription">
            {showingThroughYears
              ? throughYearsScope === "today"
                ? "No photos were found from this date in previous years."
                : "No photos were found from this week in previous years."
              : "This month doesn&apos;t have any photos yet."}
          </p>
        </div>
      )}

      {!isLoadingMedia && displayedMedia.length > 0 && !showingThroughYears && (
        <div className="photoGrid">
          {displayedMedia.map((photo, index) => (
            <figure key={photo.url} className="photoCard">
              <button
                className="mediaCardButton"
                type="button"
                onClick={() => openLightbox(index)}
                aria-label={`Open ${photo.name}`}
              >
                {photo.type === "image" ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.name} loading="lazy" />
                ) : (
                  <div className="videoThumb" aria-hidden="true">
                    <span className="videoBadge">Video</span>
                  </div>
                )}
              </button>
              <figcaption className="photoCardFooter">
                <span className="photoMeta">
                  {showingThroughYears && "dateTaken" in photo ? (
                    <>
                      <span className="photoDateTaken">
                        {formatTakenDate(typeof photo.dateTaken === "string" ? photo.dateTaken : "")}
                      </span>
                      <span className="photoName">{photo.name}</span>
                    </>
                  ) : (
                    <span className="photoName">{photo.name}</span>
                  )}
                </span>
                <button
                  className="dangerIconButton"
                  type="button"
                  onClick={() => {
                    void handleDelete(photo.name);
                  }}
                  disabled={showingThroughYears || deletingFileName === photo.name}
                  aria-label={`Delete ${photo.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {!isLoadingMedia && displayedMedia.length > 0 && showingThroughYears && (
        <div className="throughYearsGroups">
          {throughYearsByYear.map(([year, yearPhotos]) => (
            <section key={year} className="throughYearsYearSection" aria-label={`Photos from ${year}`}>
              <div className="yearSeparator">
                <h2 className="yearSeparatorLabel">{year}</h2>
                <div className="yearSeparatorLine" aria-hidden="true" />
              </div>
              <div className="photoGrid">
                {yearPhotos.map((photo) => {
                  const index = displayedMedia.findIndex(
                    (item) => item.url === photo.url && item.name === photo.name,
                  );
                  return (
                    <figure key={photo.url} className="photoCard">
                      <button
                        className="mediaCardButton"
                        type="button"
                        onClick={() => openLightbox(index)}
                        aria-label={`Open ${photo.name}`}
                      >
                        {photo.type === "image" ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={photo.url} alt={photo.name} loading="lazy" />
                        ) : (
                          <div className="videoThumb" aria-hidden="true">
                            <span className="videoBadge">Video</span>
                          </div>
                        )}
                      </button>
                      <figcaption className="photoCardFooter">
                        <span className="photoMeta">
                          <span className="photoDateTaken">
                            {formatTakenDate(typeof photo.dateTaken === "string" ? photo.dateTaken : "")}
                          </span>
                          <span className="photoName">{photo.name}</span>
                        </span>
                        <button
                          className="dangerIconButton"
                          type="button"
                          onClick={() => {
                            void handleDelete(photo.name);
                          }}
                          disabled={showingThroughYears || deletingFileName === photo.name}
                          aria-label={`Delete ${photo.name}`}
                        >
                          <Trash2 size={16} />
                        </button>
                      </figcaption>
                    </figure>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {canShowLightbox && activeMedia && (
        <div
          ref={lightboxRef}
          className="lightboxOverlay"
          role="dialog"
          aria-modal="true"
          aria-label={`Viewer for ${activeMedia.name}`}
          onClick={(event) => {
            if (event.target === event.currentTarget) closeLightbox();
          }}
          onKeyDown={(event: ReactKeyboardEvent<HTMLDivElement>) => {
            if (event.key === "Escape") closeLightbox();
          }}
        >
          <button
            ref={closeButtonRef}
            className="lightboxClose"
            type="button"
            onClick={closeLightbox}
            aria-label="Close viewer"
          >
            &times;
          </button>
          {displayedMedia.length > 1 && (
            <>
              <button
                className="lightboxNav lightboxNavPrev"
                type="button"
                onClick={showPrevious}
                aria-label="Previous item"
              >
                &lsaquo;
              </button>
              <button
                className="lightboxNav lightboxNavNext"
                type="button"
                onClick={showNext}
                aria-label="Next item"
              >
                &rsaquo;
              </button>
            </>
          )}
          <div className="lightboxContent">
            {activeMedia.type === "image" ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className="lightboxImage" src={activeMedia.url} alt={activeMedia.name} />
            ) : (
              <video
                key={activeMedia.url}
                className="lightboxVideo"
                src={activeMedia.url}
                controls
                autoPlay
              />
            )}
            <p className="lightboxCaption">{activeMedia.name}</p>
            <button
              className="dangerButton"
              type="button"
              onClick={async () => {
                const deleted = await handleDelete(activeMedia.name);
                if (deleted) closeLightbox();
              }}
              disabled={deletingFileName === activeMedia.name}
            >
              <Trash2 size={16} />
              Delete
            </button>
          </div>
        </div>
      )}
    </>
  );
}
