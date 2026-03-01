import { promises as fs } from "node:fs";
import path from "node:path";
import exifr from "exifr";

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{2}$/;

export const IMAGE_EXTENSIONS = new Set([
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
]);

export const VIDEO_EXTENSIONS = new Set([
  ".mp4",
  ".webm",
  ".mov",
  ".m4v",
  ".avi",
  ".mkv",
]);

function isReasonableDate(value: Date): boolean {
  if (!(value instanceof Date)) {
    return false;
  }

  const timestamp = value.getTime();
  if (Number.isNaN(timestamp)) {
    return false;
  }

  return timestamp > Date.UTC(1970, 0, 1) && timestamp <= Date.now() + 24 * 60 * 60 * 1000;
}

export function isSupportedMediaExtension(extension: string): boolean {
  const normalized = extension.toLowerCase();
  return IMAGE_EXTENSIONS.has(normalized) || VIDEO_EXTENSIONS.has(normalized);
}

export function assertYear(input: string): string {
  if (!YEAR_RE.test(input)) {
    throw new Error("Invalid year.");
  }

  return input;
}

export function assertMonth(input: string): string {
  if (!MONTH_RE.test(input)) {
    throw new Error("Invalid month.");
  }

  return input;
}

export function assertFileName(fileName: string): string {
  const clean = fileName.trim();
  if (!clean || clean.includes("/") || clean.includes("\\") || clean.includes("..")) {
    throw new Error("Invalid file name.");
  }

  return clean;
}

export function resolveInsideRoot(rootPath: string, ...segments: string[]): string {
  const resolvedRoot = path.resolve(rootPath);
  const candidate = path.resolve(resolvedRoot, ...segments);
  const relative = path.relative(resolvedRoot, candidate);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path traversal detected.");
  }

  return candidate;
}

export async function listNumericDirectories(directoryPath: string, pattern: RegExp): Promise<string[]> {
  const entries = await fs.readdir(directoryPath, { withFileTypes: true });

  return entries
    .filter((entry) => entry.isDirectory() && pattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
}

export async function listYears(photoRoot: string): Promise<string[]> {
  return listNumericDirectories(photoRoot, YEAR_RE);
}

export async function listMonths(photoRoot: string, year: string): Promise<string[]> {
  const safeYear = assertYear(year);
  const yearPath = resolveInsideRoot(photoRoot, safeYear);
  return listNumericDirectories(yearPath, MONTH_RE);
}

export type MediaItem = {
  name: string;
  url: string;
  type: "image" | "video";
};

export type ThisWeekMediaItem = MediaItem & {
  year: string;
  month: string;
  dateTaken: string;
};

export type ThroughYearsScope = "today" | "week";

export async function getBestDateForOrganize(filePath: string): Promise<Date | null> {
  const extension = path.extname(filePath).toLowerCase();
  if (!isSupportedMediaExtension(extension)) {
    return null;
  }

  const stat = await fs.stat(filePath);
  const candidateDates: Date[] = [];

  if (isReasonableDate(stat.birthtime)) {
    candidateDates.push(stat.birthtime);
  }

  if (isReasonableDate(stat.mtime)) {
    candidateDates.push(stat.mtime);
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    try {
      const parsed = await exifr.parse(filePath, [
        "DateTimeOriginal",
        "CreateDate",
        "ModifyDate",
        "DateTimeDigitized",
      ]);

      if (parsed instanceof Date) {
        if (isReasonableDate(parsed)) {
          candidateDates.push(parsed);
        }
      } else if (parsed && typeof parsed === "object") {
        const values = Object.values(parsed);
        for (const value of values) {
          if (value instanceof Date && isReasonableDate(value)) {
            candidateDates.push(value);
          }
        }
      }
    } catch {
      // Fall back to filesystem dates when metadata cannot be parsed.
    }
  }

  if (candidateDates.length === 0) {
    return null;
  }

  return candidateDates.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest,
  );
}

export async function resolveDestinationPath(
  photoRoot: string,
  year: string,
  month: string,
  originalFileName: string,
): Promise<string> {
  const safeYear = assertYear(year);
  const safeMonth = assertMonth(month);
  const cleanFileName = assertFileName(originalFileName);
  const baseName = path.parse(cleanFileName).name;
  const extension = path.extname(cleanFileName).toLowerCase();

  let suffix = 0;
  while (true) {
    const nextName = suffix === 0 ? cleanFileName : `${baseName}_${suffix}${extension}`;
    const candidate = resolveInsideRoot(photoRoot, safeYear, safeMonth, nextName);

    try {
      await fs.access(candidate);
      suffix++;
    } catch {
      return candidate;
    }
  }
}

export async function listPhotos(photoRoot: string, year: string, month: string): Promise<MediaItem[]> {
  const safeYear = assertYear(year);
  const safeMonth = assertMonth(month);
  const monthPath = resolveInsideRoot(photoRoot, safeYear, safeMonth);
  const entries = await fs.readdir(monthPath, { withFileTypes: true });

  return entries
    .filter((entry) => {
      if (!entry.isFile()) {
        return false;
      }

      if (entry.name.startsWith(".")) {
        return false;
      }

      const extension = path.extname(entry.name).toLowerCase();
      return IMAGE_EXTENSIONS.has(extension) || VIDEO_EXTENSIONS.has(extension);
    })
    .map((entry) => {
      const mediaType: MediaItem["type"] = VIDEO_EXTENSIONS.has(path.extname(entry.name).toLowerCase())
        ? "video"
        : "image";

      return {
        name: entry.name,
        url: `/api/photos/serve?year=${safeYear}&month=${safeMonth}&file=${encodeURIComponent(entry.name)}`,
        type: mediaType,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}

function isMissingDirectoryError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "ENOENT"
  );
}

async function getDateTaken(filePath: string): Promise<Date> {
  const extension = path.extname(filePath).toLowerCase();
  const stat = await fs.stat(filePath);
  const fallbackDate = stat.mtime;

  if (VIDEO_EXTENSIONS.has(extension)) {
    return fallbackDate;
  }

  try {
    const parsed = await exifr.parse(filePath, [
      "DateTimeOriginal",
      "CreateDate",
      "ModifyDate",
      "DateTimeDigitized",
    ]);

    if (parsed instanceof Date) {
      return parsed;
    }

    if (parsed && typeof parsed === "object") {
      const values = Object.values(parsed);
      for (const value of values) {
        if (value instanceof Date) {
          return value;
        }
      }
    }
  } catch {
    // Fall back to mtime when metadata cannot be parsed.
  }

  return fallbackDate;
}

function atStartOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function atEndOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function buildYearWindow(
  now: Date,
  year: string,
  scope: ThroughYearsScope,
): { start: Date; end: Date; monthKeys: Set<string> } {
  const windowEndCurrentYear = atEndOfDay(now);
  const windowStartCurrentYear = atStartOfDay(new Date(now));
  if (scope === "week") {
    windowStartCurrentYear.setDate(windowStartCurrentYear.getDate() - 6);
  }

  const numericYear = Number.parseInt(year, 10);
  const start = new Date(
    numericYear,
    windowStartCurrentYear.getMonth(),
    windowStartCurrentYear.getDate(),
    0,
    0,
    0,
    0,
  );
  const end = new Date(
    numericYear,
    windowEndCurrentYear.getMonth(),
    windowEndCurrentYear.getDate(),
    23,
    59,
    59,
    999,
  );

  const monthKeys = new Set<string>();
  const cursor = new Date(start);
  while (cursor <= end) {
    monthKeys.add((cursor.getMonth() + 1).toString().padStart(2, "0"));
    cursor.setDate(cursor.getDate() + 1);
  }

  return { start, end, monthKeys };
}

export async function listThroughYearsPhotos(
  photoRoot: string,
  scope: ThroughYearsScope,
  now: Date = new Date(),
): Promise<ThisWeekMediaItem[]> {
  const years = await listYears(photoRoot);
  const results: Array<ThisWeekMediaItem & { sortTimestamp: number }> = [];

  for (const year of years) {
    const { start, end, monthKeys } = buildYearWindow(now, year, scope);

    for (const month of monthKeys) {
      let photos: MediaItem[];
      try {
        photos = await listPhotos(photoRoot, year, month);
      } catch (error) {
        if (isMissingDirectoryError(error)) {
          continue;
        }
        throw error;
      }

      for (const photo of photos) {
        const absolutePath = resolveInsideRoot(photoRoot, year, month, photo.name);
        const takenAt = await getDateTaken(absolutePath);
        if (takenAt < start || takenAt > end) {
          continue;
        }

        results.push({
          ...photo,
          year,
          month,
          dateTaken: takenAt.toISOString(),
          sortTimestamp: takenAt.getTime(),
        });
      }
    }
  }

  results.sort((a, b) => {
    if (a.sortTimestamp !== b.sortTimestamp) return b.sortTimestamp - a.sortTimestamp;
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return results.map((photo) => ({
    name: photo.name,
    url: photo.url,
    type: photo.type,
    year: photo.year,
    month: photo.month,
    dateTaken: photo.dateTaken,
  }));
}

export async function listThisWeekPhotos(photoRoot: string, now: Date = new Date()): Promise<ThisWeekMediaItem[]> {
  return listThroughYearsPhotos(photoRoot, "week", now);
}

export async function deletePhoto(
  photoRoot: string,
  year: string,
  month: string,
  fileName: string,
): Promise<void> {
  const safeYear = assertYear(year);
  const safeMonth = assertMonth(month);
  const safeFileName = assertFileName(fileName);
  const extension = path.extname(safeFileName).toLowerCase();

  if (!IMAGE_EXTENSIONS.has(extension) && !VIDEO_EXTENSIONS.has(extension)) {
    throw new Error("Only image and video files can be deleted.");
  }

  const absolutePath = resolveInsideRoot(photoRoot, safeYear, safeMonth, safeFileName);
  const stat = await fs.stat(absolutePath);

  if (!stat.isFile()) {
    throw new Error("Not found.");
  }

  await fs.unlink(absolutePath);
}
