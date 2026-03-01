import { NextResponse } from "next/server";

import { readConfig } from "@/lib/config";
import { deletePhoto } from "@/lib/gallery";

type DeleteBody = {
  year?: unknown;
  month?: unknown;
  file?: unknown;
};

export async function DELETE(request: Request) {
  try {
    const { photoRoot } = await readConfig();
    if (!photoRoot) {
      return NextResponse.json({ error: "Photo directory is not configured." }, { status: 400 });
    }

    const body = (await request.json()) as DeleteBody;
    if (typeof body.year !== "string" || typeof body.month !== "string" || typeof body.file !== "string") {
      return NextResponse.json({ error: "year, month, and file are required." }, { status: 400 });
    }

    await deletePhoto(photoRoot, body.year, body.month, body.file);
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to delete photo.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
