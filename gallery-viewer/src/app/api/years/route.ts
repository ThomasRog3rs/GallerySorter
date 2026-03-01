import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { listYears } from "@/lib/gallery";

export async function GET() {
  try {
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ years: [], error: "Photo directory is not configured." }, { status: 400 });
    }

    const years = await listYears(photoRoot);
    return NextResponse.json({ years });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read years.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
