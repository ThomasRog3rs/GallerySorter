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

export default function GalleryPage() {
  const {
    configured,
    photos,
    selectedYear,
    selectedMonth,
    loadingPhotos,
    error,
    deletingFileName,
    deletePhoto,
  } = useGallery();

  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const lastFocusedRef = useRef<HTMLElement | null>(null);
  const lightboxRef = useRef<HTMLDivElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);

  const hasMedia = photos.length > 0;

  const activeMedia = useMemo(() => {
    if (!hasMedia) return null;
    const safeIndex = ((lightboxIndex % photos.length) + photos.length) % photos.length;
    return photos[safeIndex];
  }, [hasMedia, lightboxIndex, photos]);

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
    setLightboxOpen(true);
  }

  const showNext = useCallback(() => {
    if (!hasMedia) return;
    setLightboxIndex((prev) => (prev + 1) % photos.length);
  }, [hasMedia, photos.length]);

  const showPrevious = useCallback(() => {
    if (!hasMedia) return;
    setLightboxIndex((prev) => (prev - 1 + photos.length) % photos.length);
  }, [hasMedia, photos.length]);

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

  // Close lightbox when selection changes
  useEffect(() => {
    setLightboxOpen(false);
  }, [selectedYear, selectedMonth]);

  if (!configured) {
    return (
      <div className="emptyState">
        <ImageIcon className="emptyStateIcon" />
        <h2 className="emptyStateTitle">Welcome to Tom&apos;s Life</h2>
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

  if (!selectedYear || !selectedMonth) {
    return (
      <div className="emptyState">
        <ImageIcon className="emptyStateIcon" />
        <h2 className="emptyStateTitle">Select a collection</h2>
        <p className="emptyStateDescription">
          Pick a year and month from the sidebar to view your photos.
        </p>
      </div>
    );
  }

  return (
    <>
      <header className="galleryHeader">
        <h1 className="galleryHeaderTitle">{monthLabel(selectedYear, selectedMonth)}</h1>
        {!loadingPhotos && (
          <p className="galleryHeaderCount">
            {photos.length} {photos.length === 1 ? "item" : "items"}
          </p>
        )}
      </header>

      {error && <p className="errorMessage">{error}</p>}

      {loadingPhotos && (
        <div className="loadingState">
          <span className="spinner" />
          Loading photos…
        </div>
      )}

      {!loadingPhotos && photos.length === 0 && (
        <div className="emptyState" style={{ minHeight: "40vh" }}>
          <ImageIcon className="emptyStateIcon" />
          <h2 className="emptyStateTitle">No photos</h2>
          <p className="emptyStateDescription">
            This month doesn&apos;t have any photos yet.
          </p>
        </div>
      )}

      {!loadingPhotos && photos.length > 0 && (
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
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={photo.url} alt={photo.name} loading="lazy" />
                ) : (
                  <div className="videoThumb" aria-hidden="true">
                    <span className="videoBadge">Video</span>
                  </div>
                )}
              </button>
              <figcaption className="photoCardFooter">
                <span className="photoName">{photo.name}</span>
                <button
                  className="dangerIconButton"
                  type="button"
                  onClick={() => {
                    void handleDelete(photo.name);
                  }}
                  disabled={deletingFileName === photo.name}
                  aria-label={`Delete ${photo.name}`}
                >
                  <Trash2 size={16} />
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}

      {lightboxOpen && activeMedia && (
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
          {photos.length > 1 && (
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
