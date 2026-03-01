import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { listMonths } from "@/lib/gallery";

type Params = {
  params: Promise<{ year: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { year } = await params;
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ months: [], error: "Photo directory is not configured." }, { status: 400 });
    }

    const months = await listMonths(photoRoot, year);
    return NextResponse.json({ months });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read months.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
