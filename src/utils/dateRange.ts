import { AppError } from "./AppError";

// Africa/Nairobi is UTC+3 year-round (no DST), so a fixed offset is exact -
// no timezone database or Mongo version dependency needed.
export const NAIROBI_UTC_OFFSET_MS = 3 * 60 * 60 * 1000;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface DayRange {
  start: Date;
  end: Date;
}

/** Bounds a calendar day ("YYYY-MM-DD", interpreted in Africa/Nairobi) as UTC instants, for querying Score.createdAt. */
export const getDayRangeUtc = (dateStr: string): DayRange => {
  if (!DATE_RE.test(dateStr)) {
    throw new AppError(`"${dateStr}" is not a valid date (expected YYYY-MM-DD)`, 400);
  }

  const start = new Date(`${dateStr}T00:00:00+03:00`);
  if (Number.isNaN(start.getTime())) {
    throw new AppError(`"${dateStr}" is not a valid date`, 400);
  }

  return { start, end: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
};
