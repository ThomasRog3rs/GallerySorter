import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { listPhotos } from "@/lib/gallery";

type Params = {
  params: Promise<{ year: string; month: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { year, month } = await params;
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ photos: [], error: "Photo directory is not configured." }, { status: 400 });
    }

    const photos = await listPhotos(photoRoot, year, month);
    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read photos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
