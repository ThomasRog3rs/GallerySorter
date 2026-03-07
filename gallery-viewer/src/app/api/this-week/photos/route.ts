import { NextResponse } from "next/server";

import { listDemoThroughYearsPhotos } from "@/lib/demo-gallery";
import { ThroughYearsScope } from "@/lib/gallery";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const requestedScope = searchParams.get("scope");
    const scope: ThroughYearsScope = requestedScope === "week" ? "week" : "today";
    const photos = listDemoThroughYearsPhotos(scope);
    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read this week photos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
