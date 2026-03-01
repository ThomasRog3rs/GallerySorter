import { promises as fs } from "node:fs";
import path from "node:path";

export type AppConfig = {
  photoRoot: string | null;
};

const CONFIG_PATH = path.join(process.cwd(), "config.json");

function normalizePath(input: string): string {
  return path.resolve(input.trim());
}

export async function readConfig(): Promise<AppConfig> {
  const envPath = process.env.PHOTO_ROOT?.trim();
  if (envPath) {
    return { photoRoot: normalizePath(envPath) };
  }

  try {
    const raw = await fs.readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppConfig>;
    const photoRoot = typeof parsed.photoRoot === "string" ? normalizePath(parsed.photoRoot) : null;
    return { photoRoot };
  } catch {
    return { photoRoot: null };
  }
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
