import { promises as fs } from "node:fs";
import path from "node:path";
import convert from "heic-convert";
import mime from "mime";
import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { assertFileName, assertMonth, assertYear, resolveInsideRoot } from "@/lib/gallery";

const HEIC_EXTENSIONS = new Set([".heic", ".heif"]);

export async function GET(request: Request) {
  try {
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ error: "Photo directory is not configured." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const year = assertYear(searchParams.get("year") ?? "");
    const month = assertMonth(searchParams.get("month") ?? "");
    const file = assertFileName(searchParams.get("file") ?? "");

    const absolutePath = resolveInsideRoot(photoRoot, year, month, file);
    const stat = await fs.stat(absolutePath);
    if (!stat.isFile()) {
      return NextResponse.json({ error: "Not found." }, { status: 404 });
    }

    const buffer = await fs.readFile(absolutePath);
    const extension = path.extname(file).toLowerCase();

    if (HEIC_EXTENSIONS.has(extension)) {
      try {
        const heicInputBuffer: ArrayBufferLike = buffer.buffer.slice(
          buffer.byteOffset,
          buffer.byteOffset + buffer.byteLength,
        );

        const converted = await convert({
          buffer: heicInputBuffer,
          format: "PNG",
        });

        return new NextResponse(Buffer.from(converted), {
          status: 200,
          headers: {
            "Content-Type": "image/png",
            "Cache-Control": "private, max-age=60",
          },
        });
      } catch {
        return NextResponse.json({ error: "Unable to convert HEIC image." }, { status: 415 });
      }
    }

    const contentType = mime.getType(file) ?? "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "private, max-age=60",
      },
    });
  } catch {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
}
