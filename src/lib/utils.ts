import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Standardised date/time formatter for the whole app.
 * Uses 24-hour clock. Defaults to user's local timezone.
 */
export function formatAppDate(date: Date | any, options: Intl.DateTimeFormatOptions = {}) {
  const d = date instanceof Date ? date : (date?.toDate ? date.toDate() : new Date(date));
  
  return new Intl.DateTimeFormat(undefined, {
    hour12: false,
    ...options
  }).format(d);
}

/**
 * Specifically for 24h time formatting
 */
export function formatAppTime(date: Date | any) {
  return formatAppDate(date, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

/**
 * Specifically for short 24h time (no seconds)
 */
export function formatAppTimeShort(date: Date | any) {
  return formatAppDate(date, {
    hour: '2-digit',
    minute: '2-digit'
  });
}
