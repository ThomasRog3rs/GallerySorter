import { NextResponse } from "next/server";

import { ensureDirectoryExists, readConfig, writeConfig } from "@/lib/config";

export async function GET() {
  const config = await readConfig();
  return NextResponse.json({
    photoRoot: config.photoRoot ?? "demo-mode",
  });
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { photoRoot?: unknown };
    if (typeof body.photoRoot !== "string" || !body.photoRoot.trim()) {
      return NextResponse.json({ error: "photoRoot is required." }, { status: 400 });
    }

    const validatedPath = await ensureDirectoryExists(body.photoRoot);
    const nextConfig = { photoRoot: validatedPath };
    await writeConfig(nextConfig);

    return NextResponse.json(nextConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save config.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
