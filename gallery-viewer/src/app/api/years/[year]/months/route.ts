import { NextResponse } from "next/server";

import { listDemoMonths } from "@/lib/demo-gallery";

type Params = {
  params: Promise<{ year: string }>;
};

export async function GET(_request: Request, { params }: Params) {
  try {
    const { year } = await params;
    const months = listDemoMonths(year);
    return NextResponse.json({ months });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to read months.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
