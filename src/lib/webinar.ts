import { formatDate } from "./date";
import type { Webinar } from "./microcms";

export function getWebinarTitle(item: Webinar) {
  return item.title || item.webinar_title || item.id;
}

export function getApplicationStatus(start?: string, end?: string) {
  const now = Date.now();
  const startTime = start ? Date.parse(start) : Number.NaN;
  const endTime = end ? Date.parse(end) : Number.NaN;

  if (Number.isNaN(startTime) && Number.isNaN(endTime)) return null;
  if (!Number.isNaN(startTime) && now < startTime) {
    return { label: "受付前", className: "webinar-card__status--before" };
  }
  if (!Number.isNaN(endTime) && now > endTime) {
    return { label: "受付終了", className: "webinar-card__status--closed" };
  }
  return { label: "受付中", className: "webinar-card__status--open" };
}

export function formatApplicationPeriod(start?: string, end?: string) {
  const startLabel = formatDate(start);
  const endLabel = formatDate(end);
  if (startLabel && endLabel) return `${startLabel}〜${endLabel}`;
  return startLabel || endLabel || "";
}
