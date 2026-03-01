import { promises as fs } from "node:fs";
import mime from "mime";
import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { assertFileName, assertMonth, assertYear, resolveInsideRoot } from "@/lib/gallery";

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
