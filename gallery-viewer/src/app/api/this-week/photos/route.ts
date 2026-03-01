import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { listThroughYearsPhotos, ThroughYearsScope } from "@/lib/gallery";

export async function GET(request: Request) {
  try {
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ photos: [], error: "Photo directory is not configured." }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const requestedScope = searchParams.get("scope");
    const scope: ThroughYearsScope = requestedScope === "week" ? "week" : "today";
    const photos = await listThroughYearsPhotos(photoRoot, scope);
    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read this week photos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
