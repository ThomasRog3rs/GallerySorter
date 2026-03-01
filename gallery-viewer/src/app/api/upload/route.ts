import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import convert from "heic-convert";
import exifr from "exifr";

import { ensureDirectoryExists, readConfig } from "@/lib/config";
import {
  IMAGE_EXTENSIONS,
  VIDEO_EXTENSIONS,
  isSupportedMediaExtension,
  resolveDestinationPath,
} from "@/lib/gallery";

type UploadSuccess = {
  name: string;
  year: string;
  month: string;
};

type UploadError = {
  name: string;
  error: string;
};

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);
const HEIC_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);
const BROWSER_SUPPORTED_EXTENSIONS = new Set([
  ".apng",
  ".avif",
  ".bmp",
  ".gif",
  ".jpeg",
  ".jpg",
  ".png",
  ".svg",
  ".webp",
]);

const isHeicBuffer = (buffer: Buffer) => {
  if (buffer.length < 12) {
    return false;
  }

  const boxType = buffer.toString("ascii", 4, 8);
  if (boxType !== "ftyp") {
    return false;
  }

  const brand = buffer.toString("ascii", 8, 12).toLowerCase();
  return HEIC_BRANDS.has(brand);
};

function tryParseDateFromFileName(fileName: string): Date | null {
  const baseName = path.parse(fileName).name;
  const patterns: Array<{ regex: RegExp; order: readonly ["y", "m", "d"] | readonly ["d", "m", "y"] }> = [
    { regex: /(?:^|[^0-9])(\d{4})(\d{2})(\d{2})(?=$|[^0-9])/, order: ["y", "m", "d"] },
    { regex: /(?:^|[^0-9])(\d{4})[-_.](\d{2})[-_.](\d{2})(?=$|[^0-9])/, order: ["y", "m", "d"] },
    { regex: /(?:^|[^0-9])(\d{2})[-_.](\d{2})[-_.](\d{4})(?=$|[^0-9])/, order: ["d", "m", "y"] },
  ];

  for (const { regex, order } of patterns) {
    const match = regex.exec(baseName);
    if (!match) {
      continue;
    }

    const y = order.indexOf("y") + 1;
    const m = order.indexOf("m") + 1;
    const d = order.indexOf("d") + 1;
    const year = Number.parseInt(match[y] ?? "", 10);
    const month = Number.parseInt(match[m] ?? "", 10);
    const day = Number.parseInt(match[d] ?? "", 10);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
      continue;
    }

    const parsed = new Date(year, month - 1, day);
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getFullYear() !== year ||
      parsed.getMonth() !== month - 1 ||
      parsed.getDate() !== day
    ) {
      continue;
    }

    return parsed;
  }

  return null;
}

function isReasonableDate(value: Date): boolean {
  const time = value.getTime();
  return !Number.isNaN(time) && time > Date.UTC(1970, 0, 1) && time <= Date.now() + 24 * 60 * 60 * 1000;
}

function earliestDate(values: Date[]): Date | null {
  if (values.length === 0) {
    return null;
  }

  return values.reduce((earliest, current) =>
    current.getTime() < earliest.getTime() ? current : earliest,
  );
}

async function getEarliestMetadataDate(filePath: string): Promise<Date | null> {
  try {
    const parsed = await exifr.parse(filePath, [
      "DateTimeOriginal",
      "CreateDate",
      "ModifyDate",
      "DateTimeDigitized",
    ]);

    const candidates: Date[] = [];
    if (parsed instanceof Date) {
      if (isReasonableDate(parsed)) {
        candidates.push(parsed);
      }
    } else if (parsed && typeof parsed === "object") {
      for (const value of Object.values(parsed)) {
        if (value instanceof Date && isReasonableDate(value)) {
          candidates.push(value);
        }
      }
    }

    return earliestDate(candidates);
  } catch {
    return null;
  }
}

async function removeTempFile(filePath: string): Promise<void> {
  try {
    await fs.unlink(filePath);
  } catch {
    // Ignore cleanup failures.
  }
}

export async function POST(request: Request) {
  try {
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ error: "Photo directory is not configured." }, { status: 400 });
    }

    const validatedRoot = await ensureDirectoryExists(photoRoot);
    const formData = await request.formData();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.name.trim().length > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "No files were provided." }, { status: 400 });
    }

    const ok: UploadSuccess[] = [];
    const errors: UploadError[] = [];

    for (const file of files) {
      const extension = path.extname(file.name).toLowerCase();
      if (!isSupportedMediaExtension(extension)) {
        errors.push({ name: file.name, error: "Only image and video files are allowed." });
        continue;
      }

      const tempPath = path.join(os.tmpdir(), `gallery-upload-${randomUUID()}${extension}`);

      try {
        const data = Buffer.from(await file.arrayBuffer());
        await fs.writeFile(tempPath, data);

        const fileNameDate = tryParseDateFromFileName(file.name);
        const metadataDate = await getEarliestMetadataDate(tempPath);
        const lastModifiedDate = new Date(file.lastModified);
        const fallbackDate = isReasonableDate(lastModifiedDate) ? lastModifiedDate : null;
        const bestDate = fileNameDate ?? metadataDate ?? fallbackDate;
        if (!bestDate) {
          throw new Error("No valid file-name or metadata date found.");
        }

        const year = bestDate.getFullYear().toString().padStart(4, "0");
        const month = (bestDate.getMonth() + 1).toString().padStart(2, "0");
        const isImage = IMAGE_EXTENSIONS.has(extension);
        const isVideo = VIDEO_EXTENSIONS.has(extension);

        let outputBuffer = data;
        let outputFileName = file.name;
        if (isImage && !isVideo && !BROWSER_SUPPORTED_EXTENSIONS.has(extension)) {
          const shouldConvertHeic = HEIC_EXTENSIONS.has(extension) || isHeicBuffer(data);
          if (!shouldConvertHeic) {
            throw new Error("Unsupported image type. Convert to a browser-compatible format.");
          }

          const converted = await convert({
            buffer: data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
            format: "PNG",
          });

          outputBuffer = Buffer.from(converted);
          outputFileName = `${path.parse(file.name).name}.png`;
        }

        const destinationPath = await resolveDestinationPath(validatedRoot, year, month, outputFileName);

        await fs.mkdir(path.dirname(destinationPath), { recursive: true });
        await fs.writeFile(destinationPath, outputBuffer);
        ok.push({ name: outputFileName, year, month });
      } catch (error) {
        errors.push({
          name: file.name,
          error: error instanceof Error ? error.message : "Upload failed.",
        });
      } finally {
        await removeTempFile(tempPath);
      }
    }

    return NextResponse.json({ ok, errors });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
