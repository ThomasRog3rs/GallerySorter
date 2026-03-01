"use client";

import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

type MediaItem = {
  name: string;
  url: string;
  type: "image" | "video";
};

type ThisWeekMediaItem = MediaItem & {
  year: string;
  month: string;
  dateTaken: string;
};

type ThroughYearsScope = "today" | "week";

type GalleryState = {
  photoRoot: string | null;
  configured: boolean;
  years: string[];
  months: string[];
  photos: MediaItem[];
  thisWeekPhotos: ThisWeekMediaItem[];
  throughYearsScope: ThroughYearsScope;
  selectedYear: string | null;
  selectedMonth: string | null;
  loadingYears: boolean;
  loadingMonths: boolean;
  loadingPhotos: boolean;
  loadingThisWeekPhotos: boolean;
  error: string | null;
  deletingFileName: string | null;
  selectYear: (year: string | null) => void;
  selectMonth: (month: string | null) => void;
  setThroughYearsScope: (scope: ThroughYearsScope) => void;
  deletePhoto: (fileName: string) => Promise<void>;
  refreshConfig: () => Promise<void>;
};

const GalleryContext = createContext<GalleryState | null>(null);

export function useGallery(): GalleryState {
  const ctx = useContext(GalleryContext);
  if (!ctx) {
    throw new Error("useGallery must be used within a GalleryProvider");
  }
  return ctx;
}

export function GalleryProvider({ children }: { children: ReactNode }) {
  const [photoRoot, setPhotoRoot] = useState<string | null>(null);
  const [years, setYears] = useState<string[]>([]);
  const [months, setMonths] = useState<string[]>([]);
  const [photos, setPhotos] = useState<MediaItem[]>([]);
  const [thisWeekPhotos, setThisWeekPhotos] = useState<ThisWeekMediaItem[]>([]);
  const [throughYearsScope, setThroughYearsScope] = useState<ThroughYearsScope>("today");
  const [selectedYear, setSelectedYear] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingMonths, setLoadingMonths] = useState(false);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const [loadingThisWeekPhotos, setLoadingThisWeekPhotos] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deletingFileName, setDeletingFileName] = useState<string | null>(null);
  const [configLoaded, setConfigLoaded] = useState(false);

  const configured = Boolean(photoRoot);

  const loadConfig = useCallback(async () => {
    try {
      const res = await fetch("/api/config", { cache: "no-store" });
      const data = await res.json();
      setPhotoRoot(data.photoRoot ?? null);
    } catch {
      setPhotoRoot(null);
    } finally {
      setConfigLoaded(true);
    }
  }, []);

  const loadYears = useCallback(async () => {
    setLoadingYears(true);
    setError(null);
    try {
      const res = await fetch("/api/years", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load years.");
      setYears(data.years ?? []);
    } catch (e) {
      setYears([]);
      setError(e instanceof Error ? e.message : "Failed to load years.");
    } finally {
      setLoadingYears(false);
    }
  }, []);

  const loadMonths = useCallback(async (year: string) => {
    setLoadingMonths(true);
    setError(null);
    try {
      const res = await fetch(`/api/years/${year}/months`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load months.");
      setMonths(data.months ?? []);
    } catch (e) {
      setMonths([]);
      setError(e instanceof Error ? e.message : "Failed to load months.");
    } finally {
      setLoadingMonths(false);
    }
  }, []);

  const loadPhotos = useCallback(async (year: string, month: string) => {
    setLoadingPhotos(true);
    setError(null);
    try {
      const res = await fetch(`/api/years/${year}/months/${month}/photos`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load photos.");
      setPhotos(data.photos ?? []);
    } catch (e) {
      setPhotos([]);
      setError(e instanceof Error ? e.message : "Failed to load photos.");
    } finally {
      setLoadingPhotos(false);
    }
  }, []);

  const loadThisWeekPhotos = useCallback(async (scope: ThroughYearsScope) => {
    setLoadingThisWeekPhotos(true);
    setError(null);
    try {
      const res = await fetch(`/api/this-week/photos?scope=${scope}`, { cache: "no-store" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to load this week photos.");
      setThisWeekPhotos(data.photos ?? []);
    } catch (e) {
      setThisWeekPhotos([]);
      setError(e instanceof Error ? e.message : "Failed to load this week photos.");
    } finally {
      setLoadingThisWeekPhotos(false);
    }
  }, []);

  const refreshConfig = useCallback(async () => {
    await loadConfig();
  }, [loadConfig]);

  const deletePhoto = useCallback(
    async (fileName: string) => {
      if (!selectedYear || !selectedMonth) {
        throw new Error("Select a year and month first.");
      }

      setDeletingFileName(fileName);
      setError(null);

      try {
        const res = await fetch("/api/photos", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            year: selectedYear,
            month: selectedMonth,
            file: fileName,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error ?? "Failed to delete photo.");
        }

        setPhotos((prev) => prev.filter((photo) => photo.name !== fileName));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to delete photo.");
        throw e;
      } finally {
        setDeletingFileName(null);
      }
    },
    [selectedMonth, selectedYear],
  );

  const selectYear = useCallback(
    (year: string | null) => {
      setSelectedYear(year);
      setSelectedMonth(null);
      setMonths([]);
      setPhotos([]);
      if (year) loadMonths(year);
    },
    [loadMonths],
  );

  const selectMonth = useCallback(
    (month: string | null) => {
      setSelectedMonth(month);
      setPhotos([]);
      setThisWeekPhotos([]);
      if (month && selectedYear) loadPhotos(selectedYear, month);
    },
    [loadPhotos, selectedYear],
  );

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (configLoaded && configured) {
      loadYears();
    } else if (configLoaded && !configured) {
      setYears([]);
      setSelectedYear(null);
      setSelectedMonth(null);
      setMonths([]);
      setPhotos([]);
      setThisWeekPhotos([]);
    }
  }, [configLoaded, configured, loadYears]);

  useEffect(() => {
    if (configLoaded && configured && !selectedMonth) {
      loadThisWeekPhotos(throughYearsScope);
    }
  }, [configLoaded, configured, loadThisWeekPhotos, selectedMonth, throughYearsScope]);

  return (
    <GalleryContext.Provider
      value={{
        photoRoot,
        configured,
        years,
        months,
        photos,
        thisWeekPhotos,
        throughYearsScope,
        selectedYear,
        selectedMonth,
        loadingYears,
        loadingMonths,
        loadingPhotos,
        loadingThisWeekPhotos,
        error,
        deletingFileName,
        selectYear,
        selectMonth,
        setThroughYearsScope,
        deletePhoto,
        refreshConfig,
      }}
    >
      {children}
    </GalleryContext.Provider>
  );
}
