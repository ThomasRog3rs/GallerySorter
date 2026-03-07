import { assertMonth, assertYear, ThroughYearsScope, type MediaItem, type ThisWeekMediaItem } from "@/lib/gallery";

const TOTAL_DEMO_YEARS = 5;
const DEMO_MONTHS = Array.from({ length: 12 }, (_, index) => String(index + 1).padStart(2, "0"));
const MONTH_PHOTO_COUNT = 24;

function buildPicsumUrl(seed: string, width = 1200, height = 800): string {
  return `https://picsum.photos/seed/${encodeURIComponent(seed)}/${width}/${height}`;
}

export function listDemoYears(now: Date = new Date()): string[] {
  const currentYear = now.getFullYear();
  return Array.from({ length: TOTAL_DEMO_YEARS }, (_, offset) => String(currentYear - offset));
}

export function listDemoMonths(year: string): string[] {
  assertYear(year);
  return [...DEMO_MONTHS];
}

export function listDemoPhotos(year: string, month: string): MediaItem[] {
  const safeYear = assertYear(year);
  const safeMonth = assertMonth(month);

  return Array.from({ length: MONTH_PHOTO_COUNT }, (_, index) => {
    const sequence = String(index + 1).padStart(2, "0");
    const name = `demo-${safeYear}-${safeMonth}-${sequence}.jpg`;
    const url = buildPicsumUrl(`demo-${safeYear}-${safeMonth}-${sequence}`);

    return { name, url, type: "image" };
  });
}

function buildTakenAtForYear(now: Date, year: string, daysAgo: number): Date {
  const date = new Date(now);
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() - daysAgo);
  date.setFullYear(Number(year));
  return date;
}

export function listDemoThroughYearsPhotos(
  scope: ThroughYearsScope,
  now: Date = new Date(),
): ThisWeekMediaItem[] {
  const years = listDemoYears(now);
  const days = scope === "week" ? 7 : 1;
  const photos: ThisWeekMediaItem[] = [];

  for (const year of years) {
    for (let dayOffset = 0; dayOffset < days; dayOffset++) {
      const takenAt = buildTakenAtForYear(now, year, dayOffset);
      const month = String(takenAt.getMonth() + 1).padStart(2, "0");
      const day = String(takenAt.getDate()).padStart(2, "0");

      for (let variant = 1; variant <= 2; variant++) {
        const sequence = String(variant).padStart(2, "0");
        const name = `through-years-${scope}-${year}-${month}-${day}-${sequence}.jpg`;
        const url = buildPicsumUrl(`through-years-${scope}-${year}-${month}-${day}-${sequence}`);

        photos.push({
          name,
          url,
          type: "image",
          year,
          month,
          dateTaken: takenAt.toISOString(),
        });
      }
    }
  }

  photos.sort((a, b) => {
    const dateDiff = new Date(b.dateTaken).getTime() - new Date(a.dateTaken).getTime();
    if (dateDiff !== 0) {
      return dateDiff;
    }
    return a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  });

  return photos;
}
