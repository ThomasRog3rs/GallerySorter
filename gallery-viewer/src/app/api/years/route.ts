import { NextResponse } from "next/server";

import { listDemoYears } from "@/lib/demo-gallery";

export async function GET() {
  try {
    const years = listDemoYears();
    return NextResponse.json({ years });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read years.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
