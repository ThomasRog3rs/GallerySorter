import { NextResponse } from "next/server";

import { listDemoPhotos } from "@/lib/demo-gallery";

type Params = {
  params: Promise<{ year: string; month: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { year, month } = await params;
    const photos = listDemoPhotos(year, month);
    return NextResponse.json({ photos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read photos.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
