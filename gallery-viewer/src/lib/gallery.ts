import { promises as fs } from "node:fs";
import path from "node:path";

const YEAR_RE = /^\d{4}$/;
const MONTH_RE = /^\d{2}$/;

const IMAGE_EXTENSIONS = new Set([
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

export type PhotoItem = {
  name: string;
  url: string;
};

export async function listPhotos(photoRoot: string, year: string, month: string): Promise<PhotoItem[]> {
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
      return IMAGE_EXTENSIONS.has(extension);
    })
    .map((entry) => ({
      name: entry.name,
      url: `/api/photos/serve?year=${safeYear}&month=${safeMonth}&file=${encodeURIComponent(entry.name)}`,
    }))
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
}
