import { promises as fs } from "node:fs";
import path from "node:path";

export type AppConfig = {
  photoRoot: string | null;
  siteName: string;
};

const CONFIG_PATH = path.join(process.cwd(), "config.json");
export const DEFAULT_SITE_NAME = "Image Vault";

function normalizePath(input: string): string {
  return path.resolve(input.trim());
}

function normalizeSiteName(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const trimmed = input.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function readConfig(): Promise<AppConfig> {
  const envPath = process.env.PHOTO_ROOT?.trim();
  const envSiteName = normalizeSiteName(process.env.SITE_NAME);
  let photoRoot: string | null = envPath ? normalizePath(envPath) : null;
  let siteName: string | null = envSiteName;

  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    if (!photoRoot && typeof parsed.photoRoot === "string") {
      photoRoot = normalizePath(parsed.photoRoot);
    }
    if (!siteName) {
      siteName = normalizeSiteName(parsed.siteName);
    }
  } catch {
    // Ignore missing or invalid config file and fall back to defaults.
  }

  return { photoRoot, siteName: siteName ?? DEFAULT_SITE_NAME };
}

export async function writeConfig(next: AppConfig): Promise<void> {
  await fs.writeFile(CONFIG_PATH, `${JSON.stringify(next, null, 2)}\n`, "utf8");
}

export async function ensureDirectoryExists(directoryPath: string): Promise<string> {
  const resolved = normalizePath(directoryPath);
  const stat = await fs.stat(resolved);
  if (!stat.isDirectory()) {
    throw new Error("Configured path is not a directory.");
  }

  return resolved;
}
