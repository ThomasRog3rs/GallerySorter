import { NextResponse } from "next/server";

import { DEFAULT_SITE_NAME, ensureDirectoryExists, readConfig, writeConfig } from "@/lib/config";

export async function GET() {
  const config = await readConfig();
  return NextResponse.json(config);
}

export async function PUT(request: Request) {
  try {
    const body = (await request.json()) as { photoRoot?: unknown; siteName?: unknown };
    if (body.photoRoot !== undefined && (typeof body.photoRoot !== "string" || !body.photoRoot.trim())) {
      return NextResponse.json({ error: "photoRoot must be a non-empty string." }, { status: 400 });
    }
    if (body.siteName !== undefined && typeof body.siteName !== "string") {
      return NextResponse.json({ error: "siteName must be a string." }, { status: 400 });
    }

    const currentConfig = await readConfig();
    let validatedPath = currentConfig.photoRoot;
    if (typeof body.photoRoot === "string") {
      validatedPath = await ensureDirectoryExists(body.photoRoot);
    }

    const normalizedSiteName = body.siteName?.trim() || currentConfig.siteName || DEFAULT_SITE_NAME;
    const nextConfig = { photoRoot: validatedPath, siteName: normalizedSiteName };
    await writeConfig(nextConfig);

    return NextResponse.json(nextConfig);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save config.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
